'use client'

import { motion } from 'motion/react'
import { ArrowDownRight, ArrowUpRight, Gauge, Grid3x3, TriangleAlert } from 'lucide-react'
import { AnimatedNumber } from '@/components/animated-number'
import { Skeleton } from '@/components/ui/skeleton'
import { pickNumber } from '@/lib/api'
import { useOverview } from '@/lib/hooks'
import { bandForScore, formatNumber } from '@/lib/uus'
import { cn } from '@/lib/utils'

interface Kpi {
  label: string
  value: number | undefined
  digits: number
  icon: typeof Gauge
  accent?: string
  integer?: boolean
}

export function KpiBar() {
  const { data, isLoading, error } = useOverview()

  const average = pickNumber(data, ['average_uus', 'avg_uus', 'mean_uus', 'average_score'])
  const highest = pickNumber(data, ['highest_uus', 'max_uus', 'max_score', 'uus_max'])
  const lowest = pickNumber(data, ['lowest_uus', 'min_uus', 'min_score', 'uus_min'])
  const critical = pickNumber(data, ['critical_grids', 'critical_count', 'critical'])
    ?? (data?.classification_counts as Record<string, number> | undefined)?.Critical
    ?? (data?.class_distribution as Record<string, number> | undefined)?.Critical
  const total = pickNumber(data, ['total_grids', 'grid_count', 'grids', 'count', 'n_grids'])

  const kpis: Kpi[] = [
    { label: 'Average UUS', value: average, digits: 2, icon: Gauge, accent: average !== undefined ? bandForScore(average, lowest, highest).hex : undefined },
    { label: 'Highest UUS', value: highest, digits: 2, icon: ArrowUpRight, accent: 'var(--excellent)' },
    { label: 'Lowest UUS', value: lowest, digits: 2, icon: ArrowDownRight, accent: 'var(--critical)' },
    { label: 'Critical Grids', value: critical, digits: 0, icon: TriangleAlert, accent: 'var(--low)', integer: true },
    { label: 'Total Grids', value: total, digits: 0, icon: Grid3x3, integer: true },
  ]

  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((kpi, index) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass relative overflow-hidden rounded-xl px-4 py-3"
        >
          <span
            className="absolute inset-x-0 top-0 h-px opacity-60"
            style={{ background: `linear-gradient(90deg, transparent, ${kpi.accent ?? 'var(--primary)'}, transparent)` }}
            aria-hidden
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-mono-label text-muted-foreground">{kpi.label}</span>
            <kpi.icon className="size-3.5 text-muted-foreground/70" aria-hidden />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : error ? (
              <span className="text-sm text-muted-foreground">Unavailable</span>
            ) : kpi.integer ? (
              <span
                className={cn('font-mono text-2xl leading-none font-semibold tabular-nums')}
                style={{ color: kpi.accent ?? undefined }}
              >
                {formatNumber(kpi.value)}
              </span>
            ) : (
              <AnimatedNumber
                value={kpi.value}
                digits={kpi.digits}
                className="font-mono text-2xl leading-none font-semibold tabular-nums"
              />
            )}
            {!kpi.integer && !isLoading && kpi.value !== undefined && (
              <span className="text-xs text-muted-foreground">/ 100</span>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
