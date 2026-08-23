'use client'

import { motion, AnimatePresence } from 'motion/react'
import { useState } from 'react'
import { Columns3, MapPin, Search, X, ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { pickString, pickNumber, pickArray } from '@/lib/api'
import { useGridsGeoJson, useGrid, useScoreBounds } from '@/lib/hooks'
import { formatScore, formatNumber, resolveBand, extractIndicators } from '@/lib/uus'
import { useAppState } from '@/lib/app-state'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

function GridCard({
  gridId,
  onRemove,
  isActive,
}: {
  gridId: string
  onRemove: () => void
  isActive?: boolean
}) {
  const { data: grid, isLoading } = useGrid(gridId)
  const { min, max } = useScoreBounds()
  const score = pickNumber(grid, ['uus_score', 'uus', 'score'])
  const cls = pickString(grid, ['classification', 'class', 'category'])
  const band = resolveBand(score, cls, min, max)
  const { selectGrid } = useAppState()
  const router = useRouter()

  function goToMap() {
    selectGrid(gridId)
    router.push('/')
  }

  return (
    <div
      className={cn(
        'glass relative flex flex-col rounded-xl overflow-hidden transition-all',
        isActive && 'ring-1 ring-primary/40',
      )}
    >
      {/* header */}
      <div className="flex items-start justify-between gap-2 border-b border-hairline px-4 py-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-mono-label text-muted-foreground">Grid</span>
          <span className="font-mono text-sm font-medium text-foreground truncate">{gridId}</span>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={goToMap}
            aria-label={`View ${gridId} on map`}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <MapPin className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${gridId} from comparison`}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {/* score */}
      <div className="px-4 py-4 border-b border-hairline">
        {isLoading ? (
          <Skeleton className="h-10 w-24" />
        ) : (
          <>
            <div className="font-mono text-3xl font-semibold leading-none tabular-nums" style={{ color: band.hex }}>
              {formatScore(score)}
            </div>
            <div className="mt-1 text-xs font-medium" style={{ color: band.hex }}>{cls ?? band.label}</div>
            <div className="text-mono-label text-muted-foreground mt-1">/ 100</div>
          </>
        )}
      </div>

      {/* indicators */}
      {!isLoading && grid && (
        <div className="flex flex-col gap-1.5 px-4 py-3 overflow-y-auto max-h-72">
          {extractIndicators(grid as Record<string, unknown>)
            .slice(0, 15)
            .map((ind) => (
              <div key={ind.key} className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted-foreground truncate max-w-[60%]" title={ind.label}>
                  {ind.label}
                </span>
                <span className="font-mono text-xs tabular-nums text-foreground shrink-0">
                  {formatNumber(ind.value, 1)}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export function CompareView() {
  const { compareIds, toggleCompare, removeCompare, clearCompare } = useAppState()
  const { data: geojson } = useGridsGeoJson()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const hits = (() => {
    const term = query.trim().toLowerCase()
    if (term.length < 2 || !geojson?.features) return []
    const results: { gridId: string; score?: number; cls?: string }[] = []
    for (const feature of geojson.features) {
      const props = feature.properties ?? {}
      const gridId = pickString(props, ['grid_id', 'gridId', 'id'])
      if (!gridId) continue
      if (!gridId.toLowerCase().includes(term)) continue
      results.push({
        gridId,
        score: typeof props.uus_score === 'number' ? props.uus_score : undefined,
        cls: pickString(props, ['classification', 'class']),
      })
      if (results.length >= 8) break
    }
    return results
  })()

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Compare Grids</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Select up to 3 Delhi grids to compare side by side
          </p>
        </div>
        {compareIds.length > 0 && (
          <button
            type="button"
            onClick={clearCompare}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Search */}
      {compareIds.length < 3 && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            placeholder="Search grid ID to add..."
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            className="pl-9 bg-surface/60 h-9 text-sm"
            aria-label="Search grid ID to compare"
          />
          {open && query.trim().length >= 2 && (
            <ul className="glass absolute top-11 left-0 z-50 w-full rounded-xl p-1 shadow-2xl shadow-black/50">
              {hits.length === 0 ? (
                <li className="px-3 py-2 text-xs text-muted-foreground">No matching grids</li>
              ) : (
                hits.map((hit) => {
                  const band = resolveBand(hit.score, hit.cls)
                  const already = compareIds.includes(hit.gridId)
                  return (
                    <li key={hit.gridId}>
                      <button
                        type="button"
                        onMouseDown={() => {
                          if (!already) toggleCompare(hit.gridId)
                          setQuery('')
                          setOpen(false)
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none',
                          already && 'opacity-50 pointer-events-none',
                        )}
                      >
                        <span className="size-2 rounded-full shrink-0" style={{ background: band.hex }} aria-hidden />
                        <span className="font-mono text-xs text-foreground flex-1">{hit.gridId}</span>
                        <span className="font-mono text-xs tabular-nums" style={{ color: band.hex }}>
                          {formatScore(hit.score)}
                        </span>
                        {already && <span className="text-xs text-muted-foreground">Added</span>}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          )}
        </div>
      )}

      {compareIds.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center py-16">
          <Columns3 className="size-10 text-muted-foreground/40" aria-hidden />
          <p className="text-sm text-muted-foreground max-w-xs">
            Search for grid IDs above, or click <strong>"Add to compare"</strong> on any grid in the Intelligence Map.
          </p>
        </div>
      ) : (
        <AnimatePresence>
          <div className={cn('grid gap-4', compareIds.length === 1 ? 'grid-cols-1 max-w-sm' : compareIds.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
            {compareIds.map((id) => (
              <motion.div
                key={id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
              >
                <GridCard gridId={id} onRemove={() => removeCompare(id)} />
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}
