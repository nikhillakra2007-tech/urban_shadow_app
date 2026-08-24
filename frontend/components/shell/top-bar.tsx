'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { Search, Wifi, WifiOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAppState } from '@/lib/app-state'
import { useGridsGeoJson, useHealth } from '@/lib/hooks'
import { pickString } from '@/lib/api'
import { formatScore, resolveBand } from '@/lib/uus'
import { cn } from '@/lib/utils'

interface SearchHit {
  gridId: string
  place?: string
  score?: number
  classification?: string
}

export function TopBar() {
  const router = useRouter()
  const { selectGrid } = useAppState()
  const { data: health, error: healthError } = useHealth()
  const { data: geojson } = useGridsGeoJson()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hits = useMemo<SearchHit[]>(() => {
    const term = query.trim().toLowerCase()
    if (term.length < 2 || !geojson?.features) return []
    const results: SearchHit[] = []
    for (const feature of geojson.features) {
      const properties = feature.properties ?? {}
      const gridId = pickString(properties, ['grid_id', 'gridId', 'id'])
      if (!gridId) continue
      const place = pickString(properties, ['locality', 'area', 'name', 'ward', 'district', 'zone'])
      const haystack = `${gridId} ${place ?? ''}`.toLowerCase()
      if (!haystack.includes(term)) continue
      results.push({
        gridId,
        place,
        score: typeof properties.uus_score === 'number' ? properties.uus_score : undefined,
        classification: pickString(properties, ['classification', 'class', 'category']),
      })
      if (results.length >= 8) break
    }
    return results
  }, [geojson, query])

  const modelName = pickString(health, ['model', 'model_name', 'estimator'])
  const lastUpdated = pickString(health, ['last_updated', 'updated_at', 'generated_at', 'timestamp'])
  const online = Boolean(health) && !healthError

  function commit(hit: SearchHit) {
    selectGrid(hit.gridId)
    setQuery('')
    setOpen(false)
    router.push('/')
  }

  return (
    <header className="z-30 flex h-16 shrink-0 items-center gap-4 border-b border-hairline bg-sidebar/70 px-4 backdrop-blur-xl">
      <Link href="/" className="flex items-center gap-3 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <span className="relative grid size-9 place-items-center rounded-lg bg-primary/12 ring-1 ring-primary/25">
          <span className="font-mono text-[0.7rem] font-semibold tracking-tight text-primary">UUS</span>
        </span>
        <span className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-[0.18em] text-foreground">UUS DELHI</span>
          <span className="mt-1 hidden text-[0.68rem] text-muted-foreground sm:block">
            Urban Sustainability Intelligence
          </span>
        </span>
      </Link>

      <div className="relative mx-auto w-full max-w-md">
        <label htmlFor="global-grid-search" className="sr-only">
          Search grid, locality or area
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id="global-grid-search"
          value={query}
          placeholder="Search grid, locality or area..."
          autoComplete="off"
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls="grid-search-results"
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimeout.current = setTimeout(() => setOpen(false), 120)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229 && hits[0]) {
              commit(hits[0])
            }
            if (event.key === 'Escape') setOpen(false)
          }}
          className="h-9 bg-surface/60 pl-9 text-sm"
        />
        {open && query.trim().length >= 2 && (
          <ul
            id="grid-search-results"
            role="listbox"
            className="glass absolute top-11 left-0 z-50 w-full overflow-hidden rounded-xl p-1 shadow-2xl shadow-black/50"
          >
            {hits.length === 0 && (
              <li className="px-3 py-2 text-xs text-muted-foreground">No matching grid in the loaded dataset.</li>
            )}
            {hits.map((hit) => {
              const band = resolveBand(hit.score, hit.classification)
              return (
                <li key={hit.gridId} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onMouseDown={() => {
                      if (blurTimeout.current) clearTimeout(blurTimeout.current)
                    }}
                    onClick={() => commit(hit)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <span className="size-2 shrink-0 rounded-full" style={{ background: band.hex }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs text-foreground">{hit.gridId}</span>
                      {hit.place && <span className="block truncate text-[0.7rem] text-muted-foreground">{hit.place}</span>}
                    </span>
                    <span className="font-mono text-xs tabular-nums" style={{ color: band.hex }}>
                      {formatScore(hit.score)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Badge
          variant="outline"
          className={cn(
            'gap-1.5 border-hairline bg-surface/60 font-mono text-[0.65rem] tracking-[0.12em]',
            online ? 'text-excellent' : 'text-muted-foreground',
          )}
        >
          {online ? <Wifi className="size-3" aria-hidden /> : <WifiOff className="size-3" aria-hidden />}
          {online ? 'LIVE DATA' : 'OFFLINE'}
        </Badge>

        {modelName && (
          <div className="hidden flex-col leading-tight lg:flex">
            <span className="text-mono-label text-muted-foreground">Model</span>
            <span className="font-mono text-xs text-foreground">{modelName}</span>
          </div>
        )}

        {lastUpdated && (
          <div className="hidden flex-col leading-tight xl:flex">
            <span className="text-mono-label text-muted-foreground">Last Updated</span>
            <span className="font-mono text-xs text-foreground">{lastUpdated}</span>
          </div>
        )}
      </div>
    </header>
  )
}
