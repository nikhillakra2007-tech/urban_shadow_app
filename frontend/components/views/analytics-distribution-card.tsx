'use client'

import { motion } from 'motion/react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { formatNumber } from '@/lib/uus'

const customTooltipStyle = {
  background: 'oklch(0.21 0.024 256)',
  border: '1px solid oklch(0.98 0.01 250 / 9%)',
  borderRadius: '0.5rem',
  color: 'oklch(0.95 0.006 250)',
  fontSize: '0.75rem',
}

interface AnalyticsDistributionCardProps {
  distribution: { name: string; value: number }[]
}

export function AnalyticsDistributionCard({ distribution }: AnalyticsDistributionCardProps) {
  if (distribution.length === 0) return null

  return (
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
  )
}
