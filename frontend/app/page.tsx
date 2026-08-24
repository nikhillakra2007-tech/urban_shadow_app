import { Suspense } from 'react'
import { IntelligenceView } from '@/components/views/intelligence-view'

export default function Page() {
  return (
    <Suspense fallback={<div className="size-full" />}>
      <IntelligenceView />
    </Suspense>
  )
}
