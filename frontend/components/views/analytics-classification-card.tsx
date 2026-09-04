'use client'

import { motion } from 'motion/react'
import { PieChart, Pie, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'
import { resolveBand, formatNumber } from '@/lib/uus'

const customTooltipStyle = {
  background: 'oklch(0.21 0.024 256)',
  border: '1px solid oklch(0.98 0.01 250 / 9%)',
  borderRadius: '0.5rem',
  color: 'oklch(0.95 0.006 250)',
  fontSize: '0.75rem',
}

interface AnalyticsClassificationCardProps {
  classDist: { name: string; value: number }[]
}

export function AnalyticsClassificationCard({ classDist }: AnalyticsClassificationCardProps) {
  if (classDist.length === 0) return null

  return (
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
  )
}
