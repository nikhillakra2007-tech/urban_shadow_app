'use client'

import { AnimatePresence, motion } from 'motion/react'
import type { BandDefinition } from '@/lib/uus'
import { formatScore } from '@/lib/uus'

export interface HoverInfo {
  x: number
  y: number
  gridId?: string
  score?: number
  classification?: string
  place?: string
}

interface MapHoverTooltipProps {
  hover: HoverInfo | null
  band: BandDefinition
}

export function MapHoverTooltip({ hover, band }: MapHoverTooltipProps) {
  return (
    <AnimatePresence>
      {hover && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.12 }}
          style={{ left: hover.x + 16, top: hover.y + 16 }}
          className="glass pointer-events-none absolute z-20 min-w-[9.5rem] rounded-lg p-3 shadow-2xl shadow-black/60"
        >
          <div className="text-mono-label text-muted-foreground">Grid</div>
          <div className="font-mono text-xs text-foreground">{hover.gridId ?? '—'}</div>
          <div className="mt-2 text-mono-label text-muted-foreground">UUS</div>
          <div className="font-mono text-lg leading-none font-semibold tabular-nums" style={{ color: band.hex }}>
            {formatScore(hover.score)}
          </div>
          {hover.classification && (
            <div className="mt-1.5 text-mono-label" style={{ color: band.hex }}>
              {hover.classification}
            </div>
          )}
          {hover.place && <div className="mt-1.5 text-[0.7rem] text-muted-foreground">{hover.place}</div>}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
