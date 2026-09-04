'use client'

import { humanizeFeature } from '@/lib/uus'

interface MapHeaderOverlayProps {
  activeLayer: string
  gridCount?: number
}

export function MapHeaderOverlay({ activeLayer, gridCount }: MapHeaderOverlayProps) {
  return (
    <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-col gap-1">
      <span className="text-mono-label text-primary/80">Delhi NCR · Spatial Intelligence</span>
      <span className="text-sm font-medium text-slate-800">
        {activeLayer === 'uus_score' ? 'UUS Score' : humanizeFeature(activeLayer)}
        {gridCount ? (
          <span className="ml-2 font-mono text-[0.7rem] text-slate-500">
            {gridCount.toLocaleString('en-IN')} grids
          </span>
        ) : null}
      </span>
    </div>
  )
}
