'use client'

import { BANDS, formatScore } from '@/lib/uus'

interface MapLegendProps {
  min: number
  max: number
  title: string
  showBands?: boolean
}

export function MapLegend({ min, max, title, showBands = true }: MapLegendProps) {
  const gradient = `linear-gradient(90deg, ${BANDS.map((band) => band.hex).join(', ')})`

  return (
    <figure className="glass absolute bottom-3 left-3 z-20 w-[min(20rem,calc(100%-1.5rem))] rounded-lg p-3">
      <figcaption className="text-mono-label text-muted-foreground">{title}</figcaption>
      {showBands ? (
        <>
          {/* Discrete classification tiers — matches the map's step colouring. */}
          <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full" aria-hidden>
            {BANDS.map((band) => (
              <div key={band.key} className="h-full flex-1" style={{ background: band.hex }} />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[0.65rem] text-muted-foreground tabular-nums">
            <span>0</span>
            <span>20</span>
            <span>40</span>
            <span>60</span>
            <span>80</span>
            <span>100</span>
          </div>
        </>
      ) : (
        <>
          <div className="mt-2 h-2 w-full rounded-full" style={{ background: gradient }} aria-hidden />
          <div className="mt-1.5 flex justify-between font-mono text-[0.65rem] text-muted-foreground tabular-nums">
            <span>{formatScore(min, 1)}</span>
            <span>{formatScore((min + max) / 2, 1)}</span>
            <span>{formatScore(max, 1)}</span>
          </div>
        </>
      )}
      {showBands && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {BANDS.map((band) => (
            <li key={band.key} className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full" style={{ background: band.hex }} aria-hidden />
              <span className="text-[0.65rem] text-muted-foreground">{band.label}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[0.65rem] leading-relaxed text-muted-foreground/70">
        {showBands
          ? 'Each cell is coloured by its classification tier (quintiles of the 0–100 scale).'
          : 'Colour scale spans the actual value range reported by the API.'}
      </p>
    </figure>
  )
}
