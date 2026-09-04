'use client'

import { AnimatePresence, motion } from 'motion/react'
import { Columns3 } from 'lucide-react'
import { useAppState } from '@/lib/app-state'
import { cn } from '@/lib/utils'
import { CompareGridCard } from './compare-grid-card'
import { CompareSearch } from './compare-search'

export function CompareView() {
  const { compareIds, toggleCompare, removeCompare, clearCompare } = useAppState()

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Compare Grids</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Select up to 3 Delhi grids to compare side by side
          </p>
        </div>
        {compareIds.length > 0 && (
          <button
            type="button"
            onClick={clearCompare}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Search */}
      {compareIds.length < 3 && (
        <CompareSearch compareIds={compareIds} onAdd={toggleCompare} />
      )}

      {compareIds.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center py-16">
          <Columns3 className="size-10 text-muted-foreground/40" aria-hidden />
          <p className="text-sm text-muted-foreground max-w-xs">
            Search for grid IDs above, or click <strong>&quot;Add to compare&quot;</strong> on any grid in the Intelligence Map.
          </p>
        </div>
      ) : (
        <AnimatePresence>
          <div className={cn('grid gap-4', compareIds.length === 1 ? 'grid-cols-1 max-w-sm' : compareIds.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
            {compareIds.map((id) => (
              <motion.div
                key={id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
              >
                <CompareGridCard gridId={id} onRemove={() => removeCompare(id)} />
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}
