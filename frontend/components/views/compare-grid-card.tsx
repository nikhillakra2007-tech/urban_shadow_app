'use client'

import { MapPin, X } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { pickString, pickNumber, placeOf } from '@/lib/api'
import { useGrid, useScoreBounds } from '@/lib/hooks'
import { formatScore, formatNumber, resolveBand, extractIndicators } from '@/lib/uus'
import { useAppState } from '@/lib/app-state'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface CompareGridCardProps {
  gridId: string
  onRemove: () => void
  isActive?: boolean
}

export function CompareGridCard({ gridId, onRemove, isActive }: CompareGridCardProps) {
  const { data: grid, isLoading } = useGrid(gridId)
  const { min, max } = useScoreBounds()
  const score = pickNumber(grid, ['uus_score', 'uus', 'score'])
  const cls = pickString(grid, ['classification', 'class', 'category'])
  const area = placeOf(grid)
  const band = resolveBand(score, cls, min, max)
  const { selectGrid } = useAppState()
  const router = useRouter()

  function goToMap() {
    selectGrid(gridId)
    router.push('/')
  }

  return (
    <div
      className={cn(
        'glass relative flex flex-col rounded-xl overflow-hidden transition-all',
        isActive && 'ring-1 ring-primary/40',
      )}
    >
      {/* header */}
      <div className="flex items-start justify-between gap-2 border-b border-hairline px-4 py-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-mono-label text-muted-foreground">Grid</span>
          <span className="font-mono text-sm font-medium text-foreground truncate">{gridId}</span>
          {area && <span className="text-[0.65rem] text-muted-foreground truncate">{area}</span>}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={goToMap}
            aria-label={`View ${gridId} on map`}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <MapPin className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${gridId} from comparison`}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {/* score */}
      <div className="px-4 py-4 border-b border-hairline">
        {isLoading ? (
          <Skeleton className="h-10 w-24" />
        ) : (
          <>
            <div className="font-mono text-3xl font-semibold leading-none tabular-nums" style={{ color: band.hex }}>
              {formatScore(score)}
            </div>
            <div className="mt-1 text-xs font-medium" style={{ color: band.hex }}>{cls ?? band.label}</div>
            <div className="text-mono-label text-muted-foreground mt-1">/ 100</div>
          </>
        )}
      </div>

      {/* indicators */}
      {!isLoading && grid && (
        <div className="flex flex-col gap-1.5 px-4 py-3 overflow-y-auto max-h-72">
          {extractIndicators(grid as Record<string, unknown>)
            .slice(0, 15)
            .map((ind) => (
              <div key={ind.key} className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted-foreground truncate max-w-[60%]" title={ind.label}>
                  {ind.label}
                </span>
                <span className="font-mono text-xs tabular-nums text-foreground shrink-0">
                  {formatNumber(ind.value, 1)}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
