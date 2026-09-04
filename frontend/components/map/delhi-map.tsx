'use client'

/**
 * MapLibre is loaded at runtime from /vendor (self-hosted copies of the npm
 * dist files) via a native dynamic import. The bundled import breaks in the
 * Turbopack production build: the maplibre worker chunk never loads and every
 * GeoJSON source silently indexes zero features. Served from /public, the
 * worker resolves same-origin and works untouched by the bundler.
 * Types still come from the npm package.
 */
import { type ExpressionSpecification, type FilterSpecification, type GeoJSONSource, Map as MapLibreMap, type StyleSpecification } from 'maplibre-gl'
import type * as MapLibreNS from 'maplibre-gl'
import { motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { pickString } from '@/lib/api'
import { useAppState } from '@/lib/app-state'
import { useGridCells, useGridsGeoJson, useScoreBounds } from '@/lib/hooks'
import type { GridFeature } from '@/lib/types'
import { BANDS, colorStops, formatScore, humanizeFeature, resolveBand } from '@/lib/uus'
import { ApiOfflineNotice } from '@/components/api-offline-notice'
import { MapControls } from './map-controls'
import { MapHeaderOverlay } from './map-header-overlay'
import { MapHoverTooltip, type HoverInfo } from './map-hover-tooltip'
import { MapLegend } from './map-legend'
import { BASEMAP, DELHI_VIEW } from './geography'

const SOURCE_ID = 'uus-grids'
const FILL_LAYER = 'uus-cells-fill'
const OUTLINE_LAYER = 'uus-cells-outline'
const HEAT_LAYER = 'uus-heatmap'
const POINT_LAYER = 'uus-points'
const GLOW_LAYER = 'uus-glow'
const SELECTED_FILL_LAYER = 'uus-selected-fill'
const SELECTED_LAYER = 'uus-selected'

/** Keep in sync with the maplibre-gl entry in package.json. */
const MAPLIBRE_URL = '/vendor/maplibre-gl.mjs'

let maplibreLoadPromise: Promise<typeof MapLibreNS> | null = null
function loadMaplibre(): Promise<typeof MapLibreNS> {
  if (!maplibreLoadPromise) {
    maplibreLoadPromise = import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ MAPLIBRE_URL
    ).then((ns) => ns as unknown as typeof MapLibreNS)
  }
  return maplibreLoadPromise
}

// HoverInfo type is imported from './map-hover-tooltip'

function baseStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      basemap: {
        type: 'raster',
        tiles: BASEMAP.base,
        tileSize: 256,
        attribution: BASEMAP.attribution,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#E5E7EB' } },
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap',
        paint: { 'raster-opacity': 1, 'raster-saturation': -0.1 },
      },
    ],
  }
}

export function DelhiMap() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const [heatOn, setHeatOn] = useState(false)
  const { data: pointsGeojson, error: pointsError, isLoading: pointsLoading, mutate } = useGridsGeoJson()
  const { data: cellsData } = useGridCells()
  const geojson = cellsData?.features?.length ? cellsData : pointsGeojson
  const isPolygons = Boolean(geojson?.features?.[0] && 'geometry' in geojson.features[0] && geojson.features[0].geometry.type === 'Polygon')
  const error = cellsData ? undefined : pointsError
  const isLoading = cellsData ? false : pointsLoading
  const { min, max } = useScoreBounds()
  const { selectedGridId, focusToken, activeLayer, setActiveLayer, selectGrid } = useAppState()

  /** Numeric property keys actually present on the features. */
  const availableLayers = useMemo(() => {
    const sample = geojson?.features?.slice(0, 50) ?? []
    const keys = new Map<string, number>()
    for (const feature of sample) {
      for (const [key, value] of Object.entries(feature.properties ?? {})) {
        if (typeof value === 'number' && Number.isFinite(value)) keys.set(key, (keys.get(key) ?? 0) + 1)
      }
    }
    const ordered = [...keys.keys()].filter((key) => !['latitude', 'longitude', 'lat', 'lon', 'lng', 'rank', 'index'].includes(key.toLowerCase()))
    ordered.sort((a, b) => {
      const priority = (key: string) => (key.toLowerCase().includes('uus') ? 0 : 1)
      return priority(a) - priority(b) || a.localeCompare(b)
    })
    return ordered
  }, [geojson])

  /** Real min/max of the active layer field, from the API payload itself. */
  const layerRange = useMemo(() => {
    if (!geojson?.features?.length) return { min, max }
    if (activeLayer === 'uus_score') return { min, max }
    let lo = Number.POSITIVE_INFINITY
    let hi = Number.NEGATIVE_INFINITY
    for (const feature of geojson.features) {
      const value = feature.properties?.[activeLayer]
      if (typeof value === 'number' && Number.isFinite(value)) {
        if (value < lo) lo = value
        if (value > hi) hi = value
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min, max }
    return { min: lo, max: hi }
  }, [geojson, activeLayer, min, max])

  const colorExpression = useMemo<ExpressionSpecification>(() => {
    const valueExpression: ExpressionSpecification =
      activeLayer === 'uus_score'
        ? ['coalesce', ['get', 'uus_score'], ['get', 'uus'], ['get', 'score'], 0]
        : ['coalesce', ['get', activeLayer], 0]

    // Continuous sequential scale stretched over the ACTUAL score range
    // reported by the API (16–83), so low/mid/high scores are clearly
    // distinct instead of collapsing into one mostly-green hue.
    return [
      'interpolate',
      ['linear'],
      valueExpression,
      ...colorStops(layerRange.min, layerRange.max),
    ] as ExpressionSpecification
  }, [activeLayer, layerRange])

  /* ---------------- map init (waits for CDN MapLibre) ---------------- */
  const [ml, setMl] = useState<typeof MapLibreNS | null>(null)
  useEffect(() => {
    let cancelled = false
    loadMaplibre()
      .then((ns) => {
        if (!cancelled) setMl(ns)
      })
      .catch((e) => console.error('maplibre load:', e))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ml || !containerRef.current || mapRef.current) return
    const map = new ml.Map({
      container: containerRef.current,
      style: baseStyle(),
      center: DELHI_VIEW.center,
      zoom: DELHI_VIEW.zoom,
      attributionControl: { compact: true },
      dragRotate: false,
      maxZoom: 16,
      minZoom: 5,
    })
    map.touchZoomRotate.disableRotation()
    mapRef.current = map

    map.on('load', () => {
      // Locality labels come from the basemap's native tile labels
      // (CARTO Positron) — no custom label markers are added, so each
      // place name appears exactly once.
      setMapReady(true)
    })

    return () => {
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [ml])

  /* ---------------- data layers ---------------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !geojson?.features?.length) return

    const data = geojson as unknown as GeoJSON.FeatureCollection
    const pickGridId = (props: unknown) =>
      pickString(props as Record<string, unknown> | undefined, ['grid_id', 'gridId', 'id'])

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: 'geojson', data })

      if (isPolygons) {
        map.addLayer({
          id: FILL_LAYER,
          type: 'fill',
          source: SOURCE_ID,
          paint: {
            'fill-color': colorExpression,
            'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.85, 12, 0.55],
          },
        })

        map.addLayer({
          id: OUTLINE_LAYER,
          type: 'line',
          source: SOURCE_ID,
          paint: {
            'line-color': '#00000066',
            'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.4, 14, 1],
          },
        })

        map.addLayer({
          id: SELECTED_FILL_LAYER,
          type: 'fill',
          source: SOURCE_ID,
          filter: ['==', ['to-string', ['coalesce', ['get', 'grid_id'], ['get', 'id']]], '__none__'],
          paint: {
            'fill-color': 'rgba(0,0,0,0)',
            'fill-outline-color': '#ffffff',
            'fill-opacity': 1,
          },
        })
      } else {
        map.addLayer({
          id: GLOW_LAYER,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-color': colorExpression,
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 3, 9, 8, 11, 16, 14, 40],
            'circle-blur': 1.1,
            'circle-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.35, 10, 0.28, 14, 0.2],
          },
        })

        map.addLayer({
          id: POINT_LAYER,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-color': colorExpression,
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 1.2, 9, 2.8, 11, 5.5, 13, 11, 15, 20],
            'circle-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.75, 10, 0.9, 14, 0.95],
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 0, 12.5, 0.6],
            'circle-stroke-color': '#00000055',
          },
        })
      }

      map.addLayer({
        id: HEAT_LAYER,
        type: 'heatmap',
        source: SOURCE_ID,
        layout: { visibility: heatOn ? 'visible' : 'none' },
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['to-number', ['coalesce', ['get', 'uus_score'], 0]],
            Math.min(min, max), 0,
            Math.max(min, max) === Math.min(min, max) ? Math.min(min, max) + 1 : max, 1,
          ],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 13, 2.2],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(229, 72, 77, 0)',
            0.15, '#e5484d',
            0.35, '#f2820a',
            0.55, '#e9c412',
            0.75, '#5ec26a',
            1, '#1fc48b',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 7, 12, 10, 26, 14, 55],
          'heatmap-opacity': 0.72,
        },
      })

      map.addLayer({
        id: SELECTED_LAYER,
        type: isPolygons ? 'line' : 'circle',
        source: SOURCE_ID,
        filter: ['==', ['to-string', ['coalesce', ['get', 'grid_id'], ['get', 'id']]], '__none__'],
        paint: isPolygons
          ? {
              'line-color': '#ffffff',
              'line-width': 2,
            }
          : {
              'circle-color': 'rgba(0,0,0,0)',
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 9, 12, 18, 15, 30],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 1,
            },
      })

      const hitLayer = isPolygons ? FILL_LAYER : POINT_LAYER

      map.on('mousemove', hitLayer, (event) => {
        const feature = event.features?.[0]
        if (!feature) return
        map.getCanvas().style.cursor = 'pointer'
        const properties = feature.properties as GridFeature['properties']
        setHover({
          x: event.point.x,
          y: event.point.y,
          gridId: pickString(properties, ['grid_id', 'gridId', 'id']),
          score: typeof properties?.uus_score === 'number' ? properties.uus_score : undefined,
          classification: pickString(properties, ['classification', 'class', 'category']),
          place: pickString(properties, ['area_name', 'locality', 'area', 'name', 'ward', 'district', 'zone']),
        })
      })

      map.on('mouseleave', hitLayer, () => {
        map.getCanvas().style.cursor = ''
        setHover(null)
      })

      map.on('click', hitLayer, (event) => {
        const feature = event.features?.[0]
        const gridId = pickGridId(feature?.properties)
        if (gridId) selectGrid(gridId)
      })
    } else {
      const source = map.getSource(SOURCE_ID) as GeoJSONSource
      source.setData(data)
    }
  }, [geojson, mapReady, colorExpression, selectGrid, isPolygons, heatOn, min, max])

  /* ---------------- recolor on layer change ---------------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (map.getLayer(POINT_LAYER)) map.setPaintProperty(POINT_LAYER, 'circle-color', colorExpression)
    if (map.getLayer(GLOW_LAYER)) map.setPaintProperty(GLOW_LAYER, 'circle-color', colorExpression)
    if (map.getLayer(FILL_LAYER)) map.setPaintProperty(FILL_LAYER, 'fill-color', colorExpression)
  }, [colorExpression, mapReady])

  /* ---------------- heat map toggle ---------------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded() || !map.getLayer(HEAT_LAYER)) return
    if (map.getLayoutProperty(HEAT_LAYER, 'visibility') !== (heatOn ? 'visible' : 'none')) {
      map.setLayoutProperty(HEAT_LAYER, 'visibility', heatOn ? 'visible' : 'none')
    }
  }, [heatOn, mapReady, geojson])

  /* ---------------- selection highlight + fly to ---------------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const filter = [
      '==',
      ['to-string', ['coalesce', ['get', 'grid_id'], ['get', 'id']]],
      selectedGridId ?? '__none__',
    ] as FilterSpecification
    if (map.getLayer(SELECTED_LAYER)) map.setFilter(SELECTED_LAYER, filter)
    if (map.getLayer(SELECTED_FILL_LAYER)) map.setFilter(SELECTED_FILL_LAYER, filter)
  }, [selectedGridId, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !selectedGridId || !geojson?.features) return
    const feature = geojson.features.find(
      (candidate) => pickString(candidate.properties, ['grid_id', 'gridId', 'id']) === selectedGridId,
    )
    const coordinates = feature?.geometry && 'coordinates' in feature.geometry ? feature.geometry.coordinates : null
    if (!Array.isArray(coordinates) || typeof coordinates[0] !== 'number') return
    map.flyTo({
      center: [coordinates[0] as number, coordinates[1] as number],
      zoom: Math.max(map.getZoom(), 12.4),
      duration: 1100,
      essential: true,
    })
  }, [focusToken, selectedGridId, geojson, mapReady])

  const resetView = useCallback(() => {
    mapRef.current?.flyTo({ ...DELHI_VIEW, duration: 900 })
  }, [])

  const hoverBand = hover ? resolveBand(hover.score, hover.classification, min, max) : BANDS[2]

  return (
    <div className="relative size-full overflow-hidden rounded-xl border border-hairline bg-[#E5E7EB]">
      <div ref={containerRef} className="size-full" role="application" aria-label="Delhi UUS intelligence map" />

      {/* map title */}
      <MapHeaderOverlay activeLayer={activeLayer} gridCount={geojson?.features?.length} />

      <MapControls
        onZoomIn={() => mapRef.current?.zoomIn({ duration: 300 })}
        onZoomOut={() => mapRef.current?.zoomOut({ duration: 300 })}
        onReset={resetView}
        onLocateDelhi={resetView}
        onFullscreen={() => {
          const element = containerRef.current?.parentElement
          if (!element) return
          if (document.fullscreenElement) void document.exitFullscreen()
          else void element.requestFullscreen?.()
        }}
        layers={availableLayers}
        activeLayer={activeLayer}
        onLayerChange={setActiveLayer}
        showHeatmap={heatOn}
        onToggleHeatmap={() => setHeatOn((on) => !on)}
      />

      <MapLegend
        min={layerRange.min}
        max={layerRange.max}
        title={activeLayer === 'uus_score' ? 'UUS Score' : humanizeFeature(activeLayer)}
        showBands={activeLayer === 'uus_score'}
      />

      {/* hover tooltip */}
      <MapHoverTooltip hover={hover} band={hoverBand} />

      {/* loading */}
      {isLoading && !error && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-background/55 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
            <span className="text-mono-label text-muted-foreground">Loading Delhi intelligence...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-background/85 p-6 backdrop-blur">
          <ApiOfflineNotice error={error} onRetry={() => void mutate()} />
        </div>
      )}
    </div>
  )
}
