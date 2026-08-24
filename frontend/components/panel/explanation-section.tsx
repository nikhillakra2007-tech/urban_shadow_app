'use client'

import { motion } from 'motion/react'
import { Info, TrendingDown, TrendingUp } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { pickArray, pickRecord, pickString, toEntryList } from '@/lib/api'
import { useExplanation } from '@/lib/hooks'
import type { ExplanationResponse } from '@/lib/types'
import { humanizeFeature } from '@/lib/uus'
import { cn } from '@/lib/utils'

interface Driver {
  label: string
  value: number
}

/**
 * Signed per-grid contributions if the backend provides them, otherwise
 * model-wide importance. The distinction is surfaced in the UI, never blurred.
 */
function resolveDrivers(data: ExplanationResponse | undefined): {
  drivers: Driver[]
  kind: 'contribution' | 'importance' | 'none'
  method?: string
} {
  if (!data) return { drivers: [], kind: 'none' }

  const signedSource =
    pickArray(data, ['contributions', 'feature_contributions', 'shap_values']) ??
    pickRecord(data, ['contributions', 'feature_contributions', 'shap_values'])

  if (signedSource) {
    const drivers = toEntryList(signedSource, ['feature', 'name', 'label'], ['contribution', 'shap_value', 'impact', 'value'])
    if (drivers.length) {
      return {
        drivers: drivers.map((entry) => ({ label: humanizeFeature(entry.name), value: entry.value })),
        kind: 'contribution',
        method: pickString(data, ['method', 'explainer', 'explanation_method']),
      }
    }
  }

  const positive = pickArray(data, ['positive', 'positive_contributors', 'strengths']) ?? []
  const negative = pickArray(data, ['negative', 'negative_contributors', 'weaknesses']) ?? []
  if (positive.length || negative.length) {
    const parse = (items: unknown[], sign: number) =>
      toEntryList(items, ['feature', 'name', 'label'], ['contribution', 'impact', 'value', 'shap_value']).map((entry) => ({
        label: humanizeFeature(entry.name),
        value: sign * Math.abs(entry.value),
      }))
    return {
      drivers: [...parse(positive, 1), ...parse(negative, -1)],
      kind: 'contribution',
      method: pickString(data, ['method', 'explainer', 'explanation_method']),
    }
  }

  const importanceSource =
    pickArray(data, ['feature_importance', 'global_feature_importance', 'importances']) ??
    pickRecord(data, ['feature_importance', 'global_feature_importance', 'importances'])

  if (importanceSource) {
    const drivers = toEntryList(importanceSource, ['feature', 'name', 'label'], ['importance', 'value', 'weight'])
    if (drivers.length) {
      return {
        drivers: drivers.map((entry) => ({ label: humanizeFeature(entry.name), value: entry.value })),
        kind: 'importance',
        method: pickString(data, ['method', 'explainer']),
      }
    }
  }

  return { drivers: [], kind: 'none' }
}

export function ExplanationSection({ gridId }: { gridId: string }) {
  const { data, error, isLoading } = useExplanation(gridId)
  const { drivers, kind, method } = resolveDrivers(data)
  const summary = pickString(data, ['summary', 'explanation', 'narrative', 'text'])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-5 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        Explanation unavailable: {error instanceof Error ? error.message : 'request failed'}
      </p>
    )
  }

  if (drivers.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        The API returned no explainability output for this grid.
      </p>
    )
  }

  const sorted = [...drivers].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 8)
  const peak = Math.max(...sorted.map((driver) => Math.abs(driver.value))) || 1
  const signed = kind === 'contribution'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-mono-label text-muted-foreground">
          {signed ? 'Grid-specific contribution' : 'Model-wide feature importance'}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button type="button" aria-label="About this explanation" className="text-muted-foreground/70 hover:text-foreground">
                <Info className="size-3.5" aria-hidden />
              </button>
            }
          />
          <TooltipContent side="left">
            {signed
              ? `Signed contributions for this grid${method ? ` (${method})` : ''}. Positive values push the score up.`
              : 'The backend returned global importance, which describes the model overall — not why this grid scores as it does.'}
          </TooltipContent>
        </Tooltip>
      </div>

      <ul className="flex flex-col gap-2">
        {sorted.map((driver, index) => {
          const share = Math.abs(driver.value) / peak
          const negative = signed && driver.value < 0
          return (
            <li key={`${driver.label}-${index}`} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1.5">
                  {signed &&
                    (negative ? (
                      <TrendingDown className="size-3 shrink-0 text-critical" aria-hidden />
                    ) : (
                      <TrendingUp className="size-3 shrink-0 text-excellent" aria-hidden />
                    ))}
                  <span className="truncate text-xs text-muted-foreground">{driver.label}</span>
                </span>
                <span
                  className={cn(
                    'font-mono text-xs tabular-nums',
                    negative ? 'text-critical' : signed ? 'text-excellent' : 'text-foreground',
                  )}
                >
                  {signed && driver.value > 0 ? '+' : ''}
                  {driver.value.toFixed(3)}
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-surface-raised">
                <motion.div
                  className={cn('h-full rounded-full', negative ? 'bg-critical' : signed ? 'bg-excellent' : 'bg-primary/70')}
                  initial={{ width: 0 }}
                  animate={{ width: `${share * 100}%` }}
                  transition={{ duration: 0.6, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </li>
          )
        })}
      </ul>

      {summary && <p className="text-xs leading-relaxed text-muted-foreground">{summary}</p>}
    </div>
  )
}
