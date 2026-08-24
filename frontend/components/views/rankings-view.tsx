'use client'

import { motion } from 'motion/react'
import { useState } from 'react'
import { Trophy, TrendingUp, TrendingDown, ChevronUp, ChevronDown } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useRankings } from '@/lib/hooks'
import { pickArray } from '@/lib/api'
import { formatScore, resolveBand } from '@/lib/uus'
import { useAppState } from '@/lib/app-state'
import { useRouter } from 'next/navigation'
import type { GridRecord } from '@/lib/types'
import { cn } from '@/lib/utils'

type SortField = 'rank' | 'grid_id' | 'uus_score'
type SortDir = 'asc' | 'desc'

export function RankingsView() {
  const { data, isLoading } = useRankings(50)
  const { selectGrid } = useAppState()
  const router = useRouter()
  const [sortField, setSortField] = useState<SortField>('rank')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [tab, setTab] = useState<'top' | 'bottom'>('top')

  const topGrids = (pickArray<GridRecord>(data, ['top_grids', 'top', 'highest', 'best']) ?? []).slice(0, 50)
  const bottomGrids = (pickArray<GridRecord>(data, ['bottom_grids', 'bottom', 'lowest', 'worst']) ?? []).slice(0, 50)

  const grids = tab === 'top' ? topGrids : bottomGrids

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('asc') }
  }

  const sorted = [...grids].sort((a, b) => {
    let cmp = 0
    if (sortField === 'uus_score') {
      cmp = ((a.uus_score as number) ?? 0) - ((b.uus_score as number) ?? 0)
    } else if (sortField === 'grid_id') {
      cmp = String(a.grid_id ?? '').localeCompare(String(b.grid_id ?? ''))
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  function goTo(gridId: string) {
    selectGrid(gridId)
    router.push('/')
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return null
    return sortDir === 'asc' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">UUS Rankings</h1>
        <p className="text-xs text-muted-foreground mt-1">Top and bottom performing Delhi grids by UUS score</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        {(['top', 'bottom'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              tab === t ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            {t === 'top' ? <TrendingUp className="size-4" aria-hidden /> : <TrendingDown className="size-4" aria-hidden />}
            {t === 'top' ? 'Top Performing' : 'Lowest Performing'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="glass overflow-hidden rounded-xl"
        >
          {/* Table header */}
          <div className="grid grid-cols-[3rem_1fr_auto_auto] gap-3 border-b border-hairline px-4 py-2.5">
            <span className="text-mono-label text-muted-foreground">#</span>
            <button
              type="button"
              onClick={() => toggleSort('grid_id')}
              className="flex items-center gap-1 text-mono-label text-muted-foreground hover:text-foreground"
            >
              Grid ID <SortIcon field="grid_id" />
            </button>
            <span className="text-mono-label text-muted-foreground">Class</span>
            <button
              type="button"
              onClick={() => toggleSort('uus_score')}
              className="flex items-center gap-1 text-mono-label text-muted-foreground hover:text-foreground"
            >
              UUS Score <SortIcon field="uus_score" />
            </button>
          </div>

          {/* Rows */}
          <div className="divide-y divide-hairline">
            {sorted.map((grid, idx) => {
              const score = typeof grid.uus_score === 'number' ? grid.uus_score : undefined
              const cls = typeof grid.classification === 'string' ? grid.classification : undefined
              const band = resolveBand(score, cls)
              const gridId = String(grid.grid_id ?? grid.id ?? '')
              return (
                <motion.button
                  key={gridId}
                  type="button"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.015, duration: 0.25 }}
                  onClick={() => goTo(gridId)}
                  className="grid w-full grid-cols-[3rem_1fr_auto_auto] gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
                >
                  <span className="flex items-center">
                    {tab === 'top' && idx < 3 ? (
                      <Trophy
                        className="size-4"
                        style={{ color: idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : '#CD7F32' }}
                        aria-hidden
                      />
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">{String(idx + 1).padStart(2, '0')}</span>
                    )}
                  </span>
                  <span className="font-mono text-sm text-foreground flex flex-col min-w-0">
                    <span className="truncate">{gridId}</span>
                    {typeof grid.area_name === 'string' && grid.area_name && (
                      <span className="text-[0.62rem] font-sans text-muted-foreground truncate">{grid.area_name}</span>
                    )}
                  </span>
                  <span className="text-xs" style={{ color: band.hex }}>{cls ?? '—'}</span>
                  <span className="font-mono text-sm tabular-nums font-semibold" style={{ color: band.hex }}>
                    {formatScore(score)}
                  </span>
                </motion.button>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  )
}
