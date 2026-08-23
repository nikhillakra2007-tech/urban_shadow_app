'use client'

import { Crosshair, Layers, Maximize2, Minus, Plus, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { humanizeFeature } from '@/lib/uus'
import { cn } from '@/lib/utils'

interface MapControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onLocateDelhi: () => void
  onFullscreen: () => void
  layers: string[]
  activeLayer: string
  onLayerChange: (layer: string) => void
}

function ControlButton({
  label,
  onClick,
  children,
  active,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={cn(
              'grid size-9 place-items-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              active && 'bg-primary/15 text-primary',
            )}
          >
            {children}
          </button>
        }
      />
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  )
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onReset,
  onLocateDelhi,
  onFullscreen,
  layers,
  activeLayer,
  onLayerChange,
}: MapControlsProps) {
  const [layerOpen, setLayerOpen] = useState(false)

  return (
    <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
      <div className="glass flex flex-col divide-y divide-hairline overflow-hidden rounded-lg">
        <ControlButton label="Zoom in" onClick={onZoomIn}>
          <Plus className="size-4" aria-hidden />
        </ControlButton>
        <ControlButton label="Zoom out" onClick={onZoomOut}>
          <Minus className="size-4" aria-hidden />
        </ControlButton>
        <ControlButton label="Recentre on Delhi" onClick={onLocateDelhi}>
          <Crosshair className="size-4" aria-hidden />
        </ControlButton>
        <ControlButton label="Reset view" onClick={onReset}>
          <RotateCcw className="size-4" aria-hidden />
        </ControlButton>
        <ControlButton label="Fullscreen" onClick={onFullscreen}>
          <Maximize2 className="size-4" aria-hidden />
        </ControlButton>
        {layers.length > 1 && (
          <ControlButton label="Map layers" onClick={() => setLayerOpen((open) => !open)} active={layerOpen}>
            <Layers className="size-4" aria-hidden />
          </ControlButton>
        )}
      </div>

      {layerOpen && layers.length > 1 && (
        <div className="glass max-h-[min(24rem,50vh)] w-56 overflow-y-auto rounded-lg p-1.5 shadow-2xl shadow-black/50">
          <p className="px-2 py-1.5 text-mono-label text-muted-foreground">Colour grids by</p>
          <ul className="flex flex-col">
            {layers.map((layer) => {
              const active = layer === activeLayer
              return (
                <li key={layer}>
                  <button
                    type="button"
                    onClick={() => {
                      onLayerChange(layer)
                      setLayerOpen(false)
                    }}
                    aria-pressed={active}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                      active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <span className={cn('size-1.5 rounded-full', active ? 'bg-primary' : 'bg-muted-foreground/40')} aria-hidden />
                    <span className="truncate">{humanizeFeature(layer)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
