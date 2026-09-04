'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { pickString } from '@/lib/api'
import { useGridsGeoJson } from '@/lib/hooks'
import { formatScore, resolveBand } from '@/lib/uus'
import { cn } from '@/lib/utils'

interface CompareSearchProps {
  compareIds: string[]
  onAdd: (gridId: string) => void
}

export function CompareSearch({ compareIds, onAdd }: CompareSearchProps) {
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
                      if (!already) onAdd(hit.gridId)
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
  )
}
