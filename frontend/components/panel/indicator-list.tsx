'use client'

import { motion } from 'motion/react'
import { useState } from 'react'
import { ListFilter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Indicator } from '@/lib/uus'
import { formatScore } from '@/lib/uus'

interface IndicatorListProps {
  indicators: Indicator[]
  /** Preview count shown inline in the panel. */
  preview?: number
}

/** Normalises a value inside the min/max of the same indicator across the panel set. */
function shareOf(value: number, values: number[]) {
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  const span = max - min || 1
  return Math.min(1, Math.max(0.02, (value - min) / span))
}

export function IndicatorList({ indicators, preview = 6 }: IndicatorListProps) {
  const [query, setQuery] = useState('')

  if (indicators.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        The API did not return numeric indicator fields for this grid.
      </p>
    )
  }

  const values = indicators.map((indicator) => indicator.value)
  const shown = indicators.slice(0, preview)
  const filtered = indicators.filter((indicator) => indicator.label.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2.5">
        {shown.map((indicator, index) => (
          <li key={indicator.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-xs text-muted-foreground">{indicator.label}</span>
              <span className="font-mono text-xs text-foreground tabular-nums">{formatScore(indicator.value, 2)}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface-raised">
              <motion.div
                className="h-full rounded-full bg-primary/70"
                initial={{ width: 0 }}
                animate={{ width: `${shareOf(indicator.value, values) * 100}%` }}
                transition={{ duration: 0.6, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </li>
        ))}
      </ul>

      {indicators.length > preview && (
        <Dialog>
          <DialogTrigger
            render={
              <Button variant="outline" size="sm" className="w-full">
                <ListFilter data-icon="inline-start" />
                View all {indicators.length} indicators
              </Button>
            }
          />
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Grid indicators</DialogTitle>
              <DialogDescription>Every numeric field the API returned for this grid.</DialogDescription>
            </DialogHeader>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter indicators..."
              className="h-9"
              aria-label="Filter indicators"
            />
            <div className="max-h-[55vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Indicator</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((indicator) => (
                    <TableRow key={indicator.key}>
                      <TableCell className="text-xs">{indicator.label}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {formatScore(indicator.value, 3)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
