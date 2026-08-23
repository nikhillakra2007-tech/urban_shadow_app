'use client'

import { useMemo } from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'
import { useAnalytics } from '@/lib/hooks'
import { pickNumber } from '@/lib/api'
import type { GridRecord } from '@/lib/types'

/**
 * Doughnut profile for ONE clicked grid.
 *
 * Each slice = the grid's mean position within Delhi's observed min–max range
 * for a group of indicators (stats come from /api/analytics — no invented data).
 * Distance and land-surface-temperature indicators are inverted so a larger
 * slice always reads as "better access / cooler / greener".
 */

const GROUPS: { name: string; cols: string[]; color: string }[] = [
  { name: 'Healthcare', cols: ['dist_hospitals_m', 'dist_pharmacies_m'], color: '#e5484d' },
  { name: 'Education', cols: ['dist_schools_m'], color: '#f2820a' },
  { name: 'Daily needs', cols: ['dist_grocery_m', 'dist_restaurants_m', 'dist_banks_m', 'dist_atms_m'], color: '#e9c412' },
  { name: 'Safety', cols: ['dist_police_m', 'dist_fire_stations_m'], color: '#60a5fa' },
  {
    name: 'Public transport',
    cols: ['dist_bus_stations_m', 'dist_bus_stops_m', 'dist_metro_m', 'dist_railway_stations_m', 'dist_public_transport_stops_m', 'dist_subway_entrances_m'],
    color: '#1fc48b',
  },
  {
    name: 'Environment & climate',
    cols: ['lst_2024_mean', 'lst_summer_2024_mean', 'ndvi_2024_mean', 'builtup_2024_mean', 'nightlights_2024_mean', 'humidity_2024_mean', 'wind_2024_mean', 'avg_annual_rainfall_mean', 'monsoon_rainfall_mean', 'max_1day_rainfall_mean', 'elevation_mean'],
    color: '#a78bfa',
  },
]

/** Indicators where a LOWER value is better (invert the normalization). */
const INVERT = new Set([
  ...GROUPS.flatMap((g) => g.cols).filter((c) => c.startsWith('dist_')),
  'lst_2024_mean',
  'lst_summer_2024_mean',
])

const tooltipStyle = {
  background: 'oklch(0.21 0.024 256)',
  border: '1px solid oklch(0.98 0.01 250 / 9%)',
  borderRadius: '0.5rem',
  color: 'oklch(0.95 0.006 250)',
  fontSize: '0.75rem',
}

export function GridProfilePie({ grid }: { grid: GridRecord }) {
  const { data: analytics } = useAnalytics()
  const stats = analytics?.indicator_statistics as Record<string, Record<string, number>> | undefined

  const slices = useMemo(() => {
    if (!grid || !stats) return []
    return GROUPS.map(({ name, cols, color }) => {
      const values: number[] = []
      for (const col of cols) {
        const raw = pickNumber(grid, [col])
        const s = stats[col]
        if (raw === undefined || !s) continue
        const span = (s.max ?? 0) - (s.min ?? 0)
        if (!Number.isFinite(span) || span === 0) continue
        let t = (raw - s.min) / span
        t = Math.min(1, Math.max(0, t))
        if (INVERT.has(col)) t = 1 - t
        values.push(t)
      }
      if (!values.length) return null
      return { name, value: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 1000) / 10, color }
    }).filter((s): s is { name: string; value: number; color: string } => s !== null && s.value > 0)
  }, [grid, stats])

  if (!slices.length) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <PieIcon className="size-3.5 text-primary" aria-hidden />
        <h4 className="text-xs font-medium text-foreground">Indicator profile</h4>
      </div>
      <p className="text-[0.65rem] leading-snug text-muted-foreground mb-2">
        Share scale 0–100 = this grid&apos;s mean position inside Delhi&apos;s observed range per group
        (distances &amp; heat inverted → bigger slice = better).
      </p>
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie data={slices} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={68} innerRadius={38} paddingAngle={2} strokeWidth={0}>
            {slices.map((slice) => (
              <Cell key={slice.name} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value.toFixed(1), 'Profile']} />
          <Legend wrapperStyle={{ fontSize: 10, color: 'oklch(0.68 0.018 253)' }} iconSize={8} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
