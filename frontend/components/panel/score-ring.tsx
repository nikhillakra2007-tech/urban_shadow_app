'use client'

import { motion } from 'motion/react'
import { AnimatedNumber } from '@/components/animated-number'
import type { BandDefinition } from '@/lib/uus'

interface ScoreRingProps {
  score: number | undefined
  min: number
  max: number
  band: BandDefinition
  classification?: string
  size?: number
}

export function ScoreRing({ score, min, max, band, classification, size = 132 }: ScoreRingProps) {
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const span = max - min || 1
  const fraction = score === undefined ? 0 : Math.min(1, Math.max(0, (score - min) / span))

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`UUS score ${score ?? 'unavailable'}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-raised)"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={band.hex}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - fraction) }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: `drop-shadow(0 0 8px ${band.hex}55)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatedNumber
            value={score}
            digits={2}
            className="font-mono text-[1.75rem] leading-none font-semibold tabular-nums"
          />
          <span className="mt-1 text-mono-label text-muted-foreground">UUS</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-mono-label text-muted-foreground">Classification</span>
        <span className="text-lg leading-tight font-semibold" style={{ color: band.hex }}>
          {classification ?? band.label}
        </span>
        <span className="font-mono text-[0.7rem] text-muted-foreground tabular-nums">
          Range {min.toFixed(1)} – {max.toFixed(1)}
        </span>
      </div>
    </div>
  )
}
