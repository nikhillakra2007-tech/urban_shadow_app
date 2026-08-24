'use client'

import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { KpiBar } from '@/components/kpi-bar'
import { GridDetailPanel } from '@/components/panel/grid-detail-panel'
import { useAppState } from '@/lib/app-state'
import { OverviewView } from './overview-view'

// Map must be loaded client-only — MapLibre GL accesses browser APIs
const DelhiMap = dynamic(() => import('@/components/map/delhi-map').then((m) => ({ default: m.DelhiMap })), {
  ssr: false,
  loading: () => (
    <div className="relative size-full overflow-hidden rounded-xl border border-hairline bg-[#E5E7EB] flex items-center justify-center">
      <span className="font-mono text-[0.65rem] tracking-widest text-muted-foreground/60 uppercase">Loading Delhi intelligence...</span>
    </div>
  ),
})

export function IntelligenceView() {
  const searchParams = useSearchParams()
  const view = searchParams.get('view')
  const panel = searchParams.get('panel')
  const { selectedGridId, selectGrid } = useAppState()

  if (view === 'overview') return <OverviewView />

  const dossier = (
    <GridDetailPanel autoAi={panel === 'ai'} autoWhatIf={panel === 'whatif'} panelHint={panel} />
  )

  return (
    <div className="flex h-full min-h-0 gap-3 p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <KpiBar />
        <div className="min-h-0 flex-1">
          <DelhiMap />
        </div>
      </div>

      <aside
        aria-label="Grid dossier"
        className="hidden w-[23rem] shrink-0 overflow-hidden rounded-xl border border-hairline bg-surface/40 backdrop-blur-xl xl:flex xl:flex-col"
      >
        {dossier}
      </aside>

      {/* Narrow viewports: the dossier slides over the map once a grid is chosen. */}
      {selectedGridId && (
        <>
          <button
            type="button"
            aria-label="Dismiss grid dossier"
            onClick={() => selectGrid(null)}
            className="fixed inset-0 z-30 bg-background/60 xl:hidden"
          />
          <div className="fixed inset-y-0 right-0 z-40 flex w-[min(23rem,100vw)] flex-col border-l border-hairline bg-background/95 backdrop-blur-xl xl:hidden">
            {dossier}
          </div>
        </>
      )}
    </div>
  )
}
