'use client'

import { useEffect, useState } from 'react'
import { PlugZap, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { API_URL, ApiError } from '@/lib/api'

const AUTO_RETRY_SECONDS = 15

export function ApiOfflineNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const isNetwork = error instanceof ApiError && error.status === 0
  const isColdStart = error instanceof ApiError && error.isColdStart
  const message = error instanceof Error ? error.message : 'Unknown error'

  const [countdown, setCountdown] = useState(isColdStart ? AUTO_RETRY_SECONDS : 0)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    if (!isColdStart || !onRetry) return
    setCountdown(AUTO_RETRY_SECONDS)
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          setRetrying(true)
          onRetry()
          setTimeout(() => setRetrying(false), 3000)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isColdStart, onRetry])

  return (
    <Empty className="max-w-md border border-hairline bg-surface/60 backdrop-blur">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {retrying ? <Loader2 className="animate-spin" /> : <PlugZap />}
        </EmptyMedia>
        <EmptyTitle>
          {isColdStart
            ? 'Server waking up from cold start'
            : isNetwork
              ? 'Backend not reachable'
              : 'API request failed'}
        </EmptyTitle>
        <EmptyDescription>
          {isColdStart ? (
            <>
              Free-tier servers on Render spin down after inactivity and take 30–60 seconds to wake up.
              {countdown > 0 && (
                <span className="block mt-1 font-mono text-xs text-primary">
                  Auto-retrying in {countdown}s…
                </span>
              )}
            </>
          ) : (
            <>
              {message}
              <br />
              <span className="font-mono text-[0.7rem] break-all">{API_URL}</span>
            </>
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {isColdStart
            ? 'The backend is initializing. This usually takes about 30 seconds on first access after the service has been idle.'
            : 'Start the FastAPI service and confirm NEXT_PUBLIC_API_URL points at it. This dashboard renders live model output only — it never substitutes sample data.'}
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
            {retrying ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
            {retrying ? 'Retrying…' : 'Retry now'}
          </Button>
        )}
      </EmptyContent>
    </Empty>
  )
}
