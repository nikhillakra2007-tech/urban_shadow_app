'use client'

import { PlugZap, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { API_URL, ApiError } from '@/lib/api'

export function ApiOfflineNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const isNetwork = error instanceof ApiError && error.status === 0
  const message = error instanceof Error ? error.message : 'Unknown error'

  return (
    <Empty className="max-w-md border border-hairline bg-surface/60 backdrop-blur">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PlugZap />
        </EmptyMedia>
        <EmptyTitle>{isNetwork ? 'Backend not reachable' : 'API request failed'}</EmptyTitle>
        <EmptyDescription>
          {message}
          <br />
          <span className="font-mono text-[0.7rem] break-all">{API_URL}</span>
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Start the FastAPI service and confirm <span className="font-mono">NEXT_PUBLIC_API_URL</span> points at it. This
          dashboard renders live model output only — it never substitutes sample data.
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw data-icon="inline-start" />
            Retry
          </Button>
        )}
      </EmptyContent>
    </Empty>
  )
}
