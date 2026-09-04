'use client'

import { motion } from 'motion/react'
import { Database } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAnalytics } from '@/lib/hooks'
import { toEntryList } from '@/lib/api'
import { resolveBand, formatNumber } from '@/lib/uus'
import { AnalyticsDistributionCard } from './analytics-distribution-card'
import { AnalyticsClassificationCard } from './analytics-classification-card'
import { AnalyticsFeatureCard } from './analytics-feature-card'

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
        <AnalyticsDistributionCard distribution={distribution} />
        <AnalyticsClassificationCard classDist={classDist} />
        <AnalyticsFeatureCard featureImportance={featureImportance} />

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
