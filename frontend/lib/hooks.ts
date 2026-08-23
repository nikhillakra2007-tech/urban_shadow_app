'use client'

import useSWR from 'swr'
import { api, pickNumber } from './api'
import type {
  AnalyticsResponse,
  ExplanationResponse,
  GridGeoJson,
  GridRecord,
  HealthResponse,
  OverviewResponse,
  RankingsResponse,
} from './types'

const commonConfig = {
  revalidateOnFocus: false,
  shouldRetryOnError: false,
} as const

export function useHealth() {
  return useSWR<HealthResponse>('health', api.health, { ...commonConfig, refreshInterval: 60_000 })
}

export function useOverview() {
  return useSWR<OverviewResponse>('overview', api.overview, commonConfig)
}

export function useRankings(limit?: number) {
  return useSWR<RankingsResponse>(['rankings', limit], () => api.rankings(limit), commonConfig)
}

export function useAnalytics() {
  return useSWR<AnalyticsResponse>('analytics', api.analytics, commonConfig)
}

export function useGridsGeoJson() {
  return useSWR<GridGeoJson>('grids-geojson', api.gridsGeoJson, {
    ...commonConfig,
    // The full grid layer is large; keep it in cache for the whole session.
    revalidateIfStale: false,
    revalidateOnReconnect: false,
  })
}

export function useGrid(gridId: string | null) {
  return useSWR<GridRecord>(gridId ? ['grid', gridId] : null, () => api.grid(gridId as string), commonConfig)
}

export function useExplanation(gridId: string | null, enabled = true) {
  return useSWR<ExplanationResponse>(
    gridId && enabled ? ['explanation', gridId] : null,
    () => api.explanation(gridId as string),
    commonConfig,
  )
}

/** Real score bounds reported by the backend, used for colour scaling. */
export function useScoreBounds() {
  const { data } = useOverview()
  const min = pickNumber(data, ['lowest_uus', 'min_uus', 'min_score', 'uus_min'])
  const max = pickNumber(data, ['highest_uus', 'max_uus', 'max_score', 'uus_max'])
  return {
    min: min ?? 0,
    max: max ?? 100,
    hasRealBounds: min !== undefined && max !== undefined,
  }
}
