'use client'

import { motion } from 'motion/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, RotateCcw, Sparkles, TriangleAlert } from 'lucide-react'
import { AnimatedNumber } from '@/components/animated-number'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Spinner } from '@/components/ui/spinner'
import { api, pickArray, pickNumber, pickString } from '@/lib/api'
import type { GridRecord, SimulateResponse } from '@/lib/types'
import { extractIndicators, formatScore, resolveBand } from '@/lib/uus'
import { cn } from '@/lib/utils'

interface WhatIfDialogProps {
  gridId: string
  grid: GridRecord | undefined
  baselineScore: number | undefined
  min: number
  max: number
  trigger: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function sliderBounds(value: number) {
  if (value === 0) return { lo: 0, hi: 1, step: 0.01 }
  const magnitude = Math.abs(value)
  const lo = value > 0 ? 0 : value * 1.5
  const hi = value > 0 ? value * 1.5 : Math.abs(value) * 0.5
  const step = magnitude > 100 ? 1 : magnitude > 10 ? 0.1 : 0.01
  return { lo: Number(lo.toFixed(4)), hi: Number(hi.toFixed(4)), step }
}

export function WhatIfDialog({ gridId, grid, baselineScore, min, max, trigger, open, onOpenChange }: WhatIfDialogProps) {
  const indicators = useMemo(() => extractIndicators(grid as Record<string, unknown> | undefined), [grid])
  const [changes, setChanges] = useState<Record<string, number>>({})
  const [result, setResult] = useState<SimulateResponse | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setChanges({})
    setResult(null)
    setError(null)
  }, [gridId])

  const dirty = Object.keys(changes).length > 0

  async function run() {
    setPending(true)
    setError(null)
    try {
      const response = await api.simulate({ grid_id: gridId, changes })
      setResult(response)
    } catch (caught) {
      console.log('[v0] simulate failed:', caught)
      setError(caught instanceof Error ? caught.message : 'Simulation failed')
    } finally {
      setPending(false)
    }
  }

  const simulated = pickNumber(result, ['simulated_uus', 'predicted_uus', 'new_uus', 'uus_score', 'simulated_score'])
  const current = pickNumber(result, ['current_uus', 'original_uus', 'baseline_uus']) ?? baselineScore
  const delta = pickNumber(result, ['delta', 'change', 'difference']) ?? (simulated !== undefined && current !== undefined ? simulated - current : undefined)
  const simulatedClass = pickString(result, ['simulated_classification', 'classification', 'new_classification'])
  const unsupported = pickArray<string>(result, ['unsupported', 'unsupported_features', 'ignored_features']) ?? []
  const note = pickString(result, ['message', 'note', 'warning'])
  const band = resolveBand(simulated ?? current, simulatedClass, min, max)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger as never} />
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden />
            What-if simulation
          </DialogTitle>
          <DialogDescription>
            Adjust indicators for grid <span className="font-mono">{gridId}</span> and re-score it with the backend XGBoost
            model. Nothing is estimated client-side.
          </DialogDescription>
        </DialogHeader>

        {indicators.length === 0 ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            No adjustable numeric indicators were returned for this grid, so a simulation cannot be composed.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {indicators.slice(0, 10).map((indicator) => {
                const bounds = sliderBounds(indicator.value)
                const value = changes[indicator.key] ?? indicator.value
                const changed = changes[indicator.key] !== undefined
                return (
                  <div key={indicator.key} className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface/50 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <label htmlFor={`slider-${indicator.key}`} className="truncate text-xs text-muted-foreground">
                        {indicator.label}
                      </label>
                      <span className={cn('font-mono text-xs tabular-nums', changed ? 'text-primary' : 'text-foreground')}>
                        {formatScore(value, bounds.step < 0.1 ? 2 : 1)}
                      </span>
                    </div>
                    <Slider
                      id={`slider-${indicator.key}`}
                      min={bounds.lo}
                      max={bounds.hi}
                      step={bounds.step}
                      value={[value]}
                      onValueChange={(next) => {
                        const nextValue = Array.isArray(next) ? next[0] : next
                        setChanges((current) => ({ ...current, [indicator.key]: nextValue }))
                      }}
                    />
                    <span className="font-mono text-[0.6rem] text-muted-foreground tabular-nums">
                      baseline {formatScore(indicator.value, 2)}
                    </span>
                  </div>
                )
              })}
            </div>

            {indicators.length > 10 && (
              <p className="text-[0.7rem] text-muted-foreground">
                Showing the first 10 of {indicators.length} indicators returned for this grid.
              </p>
            )}

            <Separator />

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void run()} disabled={!dirty || pending}>
                {pending ? <Spinner data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
                Run simulation
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setChanges({})
                  setResult(null)
                  setError(null)
                }}
                disabled={!dirty && !result}
              >
                <RotateCcw data-icon="inline-start" />
                Reset
              </Button>
              {dirty && (
                <span className="text-[0.7rem] text-muted-foreground">
                  {Object.keys(changes).length} indicator(s) modified
                </span>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>Simulation failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface/60 p-4"
              >
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-mono-label text-muted-foreground">Current</span>
                    <span className="font-mono text-2xl leading-none tabular-nums">{formatScore(current)}</span>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                  <div className="flex flex-col gap-1">
                    <span className="text-mono-label text-muted-foreground">Simulated</span>
                    <AnimatedNumber
                      value={simulated}
                      digits={2}
                      className="font-mono text-2xl leading-none font-semibold tabular-nums"
                    />
                  </div>
                  {delta !== undefined && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'border-hairline font-mono text-xs tabular-nums',
                        delta > 0 ? 'text-excellent' : delta < 0 ? 'text-critical' : 'text-muted-foreground',
                      )}
                    >
                      {delta > 0 ? '+' : ''}
                      {delta.toFixed(2)} UUS
                    </Badge>
                  )}
                  {simulatedClass && (
                    <span className="text-sm font-medium" style={{ color: band.hex }}>
                      {simulatedClass}
                    </span>
                  )}
                </div>

                {unsupported.length > 0 && (
                  <Alert>
                    <TriangleAlert />
                    <AlertTitle>Some indicators are not model inputs</AlertTitle>
                    <AlertDescription>
                      The backend ignored: {unsupported.join(', ')}. Their values do not influence the prediction.
                    </AlertDescription>
                  </Alert>
                )}

                {note && <p className="text-xs leading-relaxed text-muted-foreground">{note}</p>}
              </motion.div>
            )}
          </div>
        )}

        <DialogFooter className="sm:justify-start">
          <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
            Simulated scores come from <span className="font-mono">POST /api/simulate</span>. They are model predictions,
            not observed measurements.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
