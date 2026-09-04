'use client'

import { Slider } from '@/components/ui/slider'
import { formatScore } from '@/lib/uus'
import { cn } from '@/lib/utils'

interface WhatIfSliderItemProps {
  indicatorKey: string
  label: string
  baseline: number
  value: number
  onChange: (nextValue: number) => void
}

function sliderBounds(value: number) {
  if (value === 0) return { lo: 0, hi: 1, step: 0.01 }
  const magnitude = Math.abs(value)
  const lo = value > 0 ? 0 : value * 1.5
  const hi = value > 0 ? value * 1.5 : Math.abs(value) * 0.5
  const step = magnitude > 100 ? 1 : magnitude > 10 ? 0.1 : 0.01
  return { lo: Number(lo.toFixed(4)), hi: Number(hi.toFixed(4)), step }
}

export function WhatIfSliderItem({ indicatorKey, label, baseline, value, onChange }: WhatIfSliderItemProps) {
  const bounds = sliderBounds(baseline)
  const changed = value !== baseline

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface/50 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={`slider-${indicatorKey}`} className="truncate text-xs text-muted-foreground">
          {label}
        </label>
        <span className={cn('font-mono text-xs tabular-nums', changed ? 'text-primary' : 'text-foreground')}>
          {formatScore(value, bounds.step < 0.1 ? 2 : 1)}
        </span>
      </div>
      <Slider
        id={`slider-${indicatorKey}`}
        min={bounds.lo}
        max={bounds.hi}
        step={bounds.step}
        value={[value]}
        onValueChange={(next) => {
          const nextValue = Array.isArray(next) ? next[0] : next
          onChange(nextValue)
        }}
      />
      <span className="font-mono text-[0.6rem] text-muted-foreground tabular-nums">
        baseline {formatScore(baseline, 2)}
      </span>
    </div>
  )
}
