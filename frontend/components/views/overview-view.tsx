'use client'

import { motion } from 'motion/react'
import { BarChart3, Grid3x3, Gauge, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { pickNumber } from '@/lib/api'
import { useOverview, useRankings } from '@/lib/hooks'
import { formatScore, formatNumber, resolveBand } from '@/lib/uus'
import { useAppState } from '@/lib/app-state'
import { useRouter } from 'next/navigation'
import { AnimatedNumber } from '@/components/animated-number'

export function OverviewView() {
  const { data: overview, isLoading } = useOverview()
  const { data: rankings } = useRankings(5)
  const { selectGrid } = useAppState()
  const router = useRouter()

  const avg = pickNumber(overview, ['avg_uus', 'average_uus', 'mean_uus'])
  const max = pickNumber(overview, ['max_uus', 'highest_uus'])
  const min = pickNumber(overview, ['min_uus', 'lowest_uus'])
  const total = pickNumber(overview, ['total_grids'])
  const classDist = (overview?.classification_counts ?? overview?.class_distribution ?? {}) as Record<string, number>

  function goToGrid(gridId: string) {
    selectGrid(gridId)
    router.push('/')
  }

  const topGrids = rankings?.top_grids ?? rankings?.top ?? []
  const bottomGrids = rankings?.bottom_grids ?? rankings?.bottom ?? []

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Overview</h1>
        <p className="text-xs text-muted-foreground mt-1">Aggregate intelligence from the real Delhi UUS dataset</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Average UUS', value: avg, icon: Gauge, accent: '#60a5fa', decimal: true },
          { label: 'Highest UUS', value: max, icon: TrendingUp, accent: 'var(--excellent)', decimal: true },
          { label: 'Lowest UUS', value: min, icon: TrendingDown, accent: 'var(--critical)', decimal: true },
          { label: 'Total Grids', value: total, icon: Grid3x3, accent: 'var(--primary)', decimal: false },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
            className="glass relative overflow-hidden rounded-xl px-4 py-3"
          >
            <span
              className="absolute inset-x-0 top-0 h-px opacity-60"
              style={{ background: `linear-gradient(90deg,transparent,${kpi.accent},transparent)` }}
              aria-hidden
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-mono-label text-muted-foreground">{kpi.label}</span>
              <kpi.icon className="size-3.5 text-muted-foreground/60" aria-hidden />
            </div>
            <div className="mt-2">
              {isLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : kpi.decimal ? (
                <AnimatedNumber value={kpi.value} digits={2} className="font-mono text-2xl leading-none font-semibold tabular-nums" />
              ) : (
                <span className="font-mono text-2xl leading-none font-semibold tabular-nums">
                  {formatNumber(kpi.value)}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Classification distribution */}
      {Object.keys(classDist).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="glass rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="size-4 text-primary" aria-hidden />
            <h2 className="text-sm font-medium text-foreground">Classification Distribution</h2>
          </div>
          <div className="flex flex-col gap-2">
            {Object.entries(classDist).map(([cls, count]) => {
              const band = resolveBand(undefined, cls)
              const pct = total ? (count / total) * 100 : 0
              return (
                <div key={cls} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-muted-foreground truncate">{cls}</span>
                  <div className="flex-1 h-2 rounded-full bg-surface-raised overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: band.hex }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <span className="font-mono text-xs tabular-nums text-foreground w-14 text-right">
                    {formatNumber(count)} <span className="text-muted-foreground">({pct.toFixed(1)}%)</span>
                  </span>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Top / Bottom Rankings */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          { title: 'Top Performing Grids', grids: topGrids, icon: TrendingUp },
          { title: 'Lowest Performing Grids', grids: bottomGrids, icon: AlertTriangle },
        ].map(({ title, grids, icon: Icon }) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="glass rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Icon className="size-4 text-primary" aria-hidden />
              <h2 className="text-sm font-medium text-foreground">{title}</h2>
            </div>
            <ol className="flex flex-col gap-2">
              {grids.slice(0, 5).map((grid, idx) => {
                const score = typeof grid.uus_score === 'number' ? grid.uus_score : undefined
                const band = resolveBand(score, typeof grid.classification === 'string' ? grid.classification : undefined)
                const gridId = typeof grid.grid_id === 'string' ? grid.grid_id : String(grid.grid_id ?? '')
                return (
                  <li key={gridId}>
                    <button
                      type="button"
                      onClick={() => goToGrid(gridId)}
                      className="w-full flex items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-accent/50 transition-colors"
                    >
                      <span className="font-mono text-[0.6rem] text-muted-foreground w-4">{String(idx + 1).padStart(2, '0')}</span>
                      <span className="size-2 rounded-full shrink-0" style={{ background: band.hex }} aria-hidden />
                      <span className="font-mono text-xs text-foreground flex flex-col min-w-0 flex-1">
                        <span className="truncate">{gridId}</span>
                        {typeof grid.area_name === 'string' && grid.area_name && (
                          <span className="text-[0.6rem] font-sans text-muted-foreground truncate">{grid.area_name}</span>
                        )}
                      </span>
                      <span className="font-mono text-xs tabular-nums" style={{ color: band.hex }}>
                        {formatScore(score)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
