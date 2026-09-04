'use client'

import { motion } from 'motion/react'
import { TrendingUp } from 'lucide-react'
import { humanizeFeature } from '@/lib/uus'

const CHART_COLORS = ['#e5484d', '#f2820a', '#e9c412', '#5ec26a', '#1fc48b']

interface AnalyticsFeatureCardProps {
  featureImportance: { name: string; value: number }[]
}

export function AnalyticsFeatureCard({ featureImportance }: AnalyticsFeatureCardProps) {
  if (featureImportance.length === 0) return null

  return (
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
  )
}
