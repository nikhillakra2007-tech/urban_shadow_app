'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useMemo } from 'react'
import { Columns3, MapPin, Sparkles, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { classOf, placeOf, scoreOf } from '@/lib/api'
import { MAX_COMPARE, useAppState } from '@/lib/app-state'
import { useGrid, useScoreBounds } from '@/lib/hooks'
import { extractIndicators, resolveBand } from '@/lib/uus'
import { AiSuggestions } from './ai-suggestions'
import { ExplanationSection } from './explanation-section'
import { IndicatorList } from './indicator-list'
import { ScoreRing } from './score-ring'
import { WhatIfDialog } from './what-if-dialog'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-mono-label text-primary/80">{title}</h3>
      {children}
    </section>
  )
}

interface GridDetailPanelProps {
  autoAi?: boolean
  autoWhatIf?: boolean
  panelHint?: string | null
}

export function GridDetailPanel({ autoAi = false, autoWhatIf = false }: GridDetailPanelProps) {
  const { selectedGridId, selectGrid, compareIds, toggleCompare } = useAppState()
  const { data: grid, error, isLoading } = useGrid(selectedGridId)
  const { min, max } = useScoreBounds()

  const indicators = useMemo(() => extractIndicators(grid as Record<string, unknown> | undefined), [grid])

  if (!selectedGridId) {
    return (
      <div className="grid size-full place-items-center px-6">
        <Empty className="border-none">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MapPin />
            </EmptyMedia>
            <EmptyTitle>No grid selected</EmptyTitle>
            <EmptyDescription>
              Click any grid cell on the map, or search for a grid ID or locality, to open its sustainability dossier.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const score = scoreOf(grid)
  const classification = classOf(grid)
  const place = placeOf(grid)
  const band = resolveBand(score, classification, min, max)
  const inCompare = compareIds.includes(selectedGridId)

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={selectedGridId}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 16 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-full flex-col"
      >
        <header className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3.5">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-mono-label text-muted-foreground">Grid Dossier</span>
            <span className="truncate font-mono text-sm text-foreground">{selectedGridId}</span>
            {place && <span className="truncate text-xs text-muted-foreground">{place}</span>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close grid dossier"
            onClick={() => selectGrid(null)}
            className="shrink-0"
          >
            <X />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-4">
          {isLoading && (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}

          {error && !isLoading && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Could not load grid {selectedGridId}: {error instanceof Error ? error.message : 'request failed'}
            </p>
          )}

          {grid && !isLoading && (
            <>
              <ScoreRing score={score} min={min} max={max} band={band} classification={classification} />

              <div className="flex flex-wrap gap-2">
                <WhatIfDialog
                  gridId={selectedGridId}
                  grid={grid}
                  baselineScore={score}
                  min={min}
                  max={max}
                  trigger={
                    <Button size="sm" variant="secondary">
                      <Sparkles data-icon="inline-start" />
                      Simulate
                    </Button>
                  }
                />
                <Button
                  size="sm"
                  variant={inCompare ? 'default' : 'outline'}
                  onClick={() => toggleCompare(selectedGridId)}
                >
                  <Columns3 data-icon="inline-start" />
                  {inCompare ? 'In comparison' : 'Add to compare'}
                </Button>
                {compareIds.length >= MAX_COMPARE && !inCompare && (
                  <Badge variant="secondary" className="self-center text-[0.65rem]">
                    Replaces oldest
                  </Badge>
                )}
              </div>

              <Separator />

              <Section title="Indicators">
                <IndicatorList indicators={indicators} />
              </Section>

              <Separator />

              <Section title="Why this score">
                <ExplanationSection gridId={selectedGridId} />
              </Section>

              <Separator />

              <Section title="AI interventions">
                <AiSuggestions gridId={selectedGridId} autoLoad={autoAi} />
              </Section>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
