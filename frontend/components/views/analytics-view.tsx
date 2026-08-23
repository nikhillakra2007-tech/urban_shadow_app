'use client'

import { motion } from 'motion/react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'
import { BarChart3, PieChart as PieIcon, TrendingUp, Database } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAnalytics } from '@/lib/hooks'
import { toEntryList } from '@/lib/api'
import { resolveBand, humanizeFeature, formatNumber } from '@/lib/uus'

const CHART_COLORS = ['#e5484d', '#f2820a', '#e9c412', '#5ec26a', '#1fc48b']

const customTooltipStyle = {
  background: 'oklch(0.21 0.024 256)',
  border: '1px solid oklch(0.98 0.01 250 / 9%)',
  borderRadius: '0.5rem',
  color: 'oklch(0.95 0.006 250)',
  fontSize: '0.75rem',
}

export function AnalyticsView() {
  const { data, isLoading } = useAnalytics()

  const distribution = toEntryList(
    data?.uus_distribution ?? data?.distribution ?? data?.histogram,
    ['range', 'bin', 'label', 'classification'],
    ['count', 'frequency', 'value'],
  )

  const classDistRaw = data?.classification_distribution ?? data?.class_distribution
  const classDist = toEntryList(classDistRaw, ['classification', 'label', 'name', 'bin'], ['count', 'value', 'frequency'])

  const featureImportance = toEntryList(
    data?.feature_importance,
    ['feature', 'name', 'label'],
    ['importance', 'value', 'weight'],
  )
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-4 p-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Analytics</h1>
        <p className="text-xs text-muted-foreground mt-1">
          UUS distribution, classification breakdown and model feature importance — all from real backend data
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* UUS Distribution */}
        {distribution.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="size-4 text-primary" aria-hidden />
              <h2 className="text-sm font-medium text-foreground">UUS Score Distribution</h2>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={distribution} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'oklch(0.68 0.018 253)', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fill: 'oklch(0.68 0.018 253)', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={customTooltipStyle}
                  cursor={{ fill: 'oklch(0.98 0.01 250 / 5%)' }}
                  formatter={(value: number) => [formatNumber(value), 'Grids']}
                />
                <Bar dataKey="value" radius={[3, 3, 0, 0]} fill="oklch(0.78 0.13 205)">
                  {distribution.map((_, i) => (
                    <Cell key={i} fill={`oklch(${0.6 + (i / distribution.length) * 0.25} 0.14 ${200 + i * 3})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Classification Breakdown */}
        {classDist.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
            className="glass rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-4">
              <PieIcon className="size-4 text-primary" aria-hidden />
              <h2 className="text-sm font-medium text-foreground">Classification Distribution</h2>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={classDist}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={45}
                  paddingAngle={3}
                >
                  {classDist.map((entry, i) => {
                    const band = resolveBand(undefined, entry.name)
                    return <Cell key={i} fill={band.hex} />
                  })}
                </Pie>
                <Tooltip contentStyle={customTooltipStyle} formatter={(value: number) => [formatNumber(value), 'Grids']} />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: 'oklch(0.68 0.018 253)' }}
                  formatter={(value) => <span style={{ color: 'oklch(0.68 0.018 253)' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Feature Importance */}
        {featureImportance.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.4 }}
            className="glass rounded-xl p-4 lg:col-span-2"
          >
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="size-4 text-primary" aria-hidden />
              <h2 className="text-sm font-medium text-foreground">Model Feature Importance</h2>
            </div>
            <p className="text-[0.7rem] text-muted-foreground mb-4">
              Global XGBoost gain-based importance across all grids — not per-grid causal explanations.
            </p>
            <div className="flex flex-col gap-2">
              {featureImportance.map((item, i) => {
                const pct = (item.value / featureImportance[0].value) * 100
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="w-36 text-xs text-muted-foreground truncate" title={humanizeFeature(item.name)}>
                      {humanizeFeature(item.name)}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-surface-raised overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                    <span className="font-mono text-xs text-muted-foreground tabular-nums w-12 text-right">
                      {item.value.toFixed(3)}
                    </span>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Stats summary */}
        {data?.total_grids && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.4 }}
            className="glass rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Database className="size-4 text-primary" aria-hidden />
              <h2 className="text-sm font-medium text-foreground">Dataset Summary</h2>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total grids</span>
                <span className="font-mono tabular-nums">{formatNumber(data.total_grids as number)}</span>
              </div>
              {classDist.map((c) => (
                <div key={c.name} className="flex justify-between">
                  <span style={{ color: resolveBand(undefined, c.name).hex }}>{c.name}</span>
                  <span className="font-mono tabular-nums">{formatNumber(c.value)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
