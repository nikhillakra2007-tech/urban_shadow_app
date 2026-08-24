'use client'

import { motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { Bot, ChevronDown, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { api, pickArray, pickString } from '@/lib/api'
import type { AiSuggestionsResponse, SuggestionItem } from '@/lib/types'
import { humanizeFeature } from '@/lib/uus'
import { cn } from '@/lib/utils'

interface NormalizedSuggestion {
  title: string
  problem?: string
  why?: string
  action?: string
  indicators: string[]
  priority?: string
}

function normalize(items: SuggestionItem[]): NormalizedSuggestion[] {
  return items.map((item, index) => ({
    title: pickString(item, ['title', 'headline', 'name', 'intervention']) ?? `Intervention ${index + 1}`,
    problem: pickString(item, ['problem', 'issue', 'diagnosis', 'observation']),
    why: pickString(item, ['why', 'why_it_matters', 'rationale', 'reason', 'impact_description']),
    action: pickString(item, ['recommendation', 'intervention', 'action', 'suggestion', 'measure']),
    indicators: (pickArray<string>(item, ['affected_indicators', 'indicators', 'features', 'related_indicators']) ?? [])
      .filter((value): value is string => typeof value === 'string')
      .map(humanizeFeature),
    priority: pickString(item, ['priority', 'severity', 'urgency']),
  }))
}

export function AiSuggestions({ gridId, autoLoad = false }: { gridId: string; autoLoad?: boolean }) {
  const [data, setData] = useState<AiSuggestionsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.aiSuggestions(gridId)
      setData(response)
      setOpenIndex(0)
    } catch (caught) {
      console.log('[v0] ai-suggestions failed:', caught)
      setError(caught instanceof Error ? caught.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [gridId])

  useEffect(() => {
    setData(null)
    setError(null)
  }, [gridId])

  useEffect(() => {
    if (autoLoad && !data && !loading && !error) void load()
  }, [autoLoad, data, loading, error, load])

  const items = normalize(pickArray<SuggestionItem>(data, ['suggestions', 'recommendations', 'results', 'items']) ?? [])
  const source = pickString(data, ['source', 'method', 'generated_by', 'engine'])
  const model = pickString(data, ['model', 'llm', 'model_name'])

  return (
    <div className="flex flex-col gap-3">
      {!data && !loading && (
        <Button variant="secondary" size="sm" onClick={() => void load()} className="w-full">
          <Sparkles data-icon="inline-start" />
          Generate interventions
        </Button>
      )}

      {loading && (
        <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface/50 px-3 py-2.5">
          <Spinner className="text-primary" />
          <span className="text-xs text-muted-foreground">Requesting interventions from the backend...</span>
        </div>
      )}

      {error && (
        <div className="flex flex-col gap-2">
          <p className="text-xs leading-relaxed text-muted-foreground">Could not generate suggestions: {error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}

      {data && (
        <>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 border-hairline font-mono text-[0.6rem] tracking-[0.12em]">
              <Bot className="size-3" aria-hidden />
              {source ? source.toUpperCase() : 'BACKEND'}
              {model ? ` · ${model}` : ''}
            </Badge>
            <span className="text-[0.65rem] text-muted-foreground">{items.length} returned</span>
          </div>

          {items.length === 0 && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              The endpoint returned no suggestions for this grid.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {items.map((item, index) => {
              const open = openIndex === index
              return (
                <li key={`${item.title}-${index}`} className="overflow-hidden rounded-lg border border-hairline bg-surface/50">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(open ? null : index)}
                    aria-expanded={open}
                    className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent/40"
                  >
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-primary/15 font-mono text-[0.6rem] text-primary">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs leading-snug font-medium text-foreground">{item.title}</span>
                      {item.priority && (
                        <span className="mt-1 block text-mono-label text-muted-foreground">Priority {item.priority}</span>
                      )}
                    </span>
                    <ChevronDown
                      className={cn('mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
                      aria-hidden
                    />
                  </button>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-2.5 border-t border-hairline px-3 py-3">
                        {item.problem && (
                          <div className="flex flex-col gap-1">
                            <span className="text-mono-label text-muted-foreground">Problem</span>
                            <p className="text-xs leading-relaxed text-foreground/85">{item.problem}</p>
                          </div>
                        )}
                        {item.why && (
                          <div className="flex flex-col gap-1">
                            <span className="text-mono-label text-muted-foreground">Why it matters</span>
                            <p className="text-xs leading-relaxed text-foreground/85">{item.why}</p>
                          </div>
                        )}
                        {item.action && (
                          <div className="flex flex-col gap-1">
                            <span className="text-mono-label text-muted-foreground">Recommendation</span>
                            <p className="text-xs leading-relaxed text-foreground/85">{item.action}</p>
                          </div>
                        )}
                        {item.indicators.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {item.indicators.map((indicator) => (
                              <Badge key={indicator} variant="secondary" className="text-[0.65rem]">
                                {indicator}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
