import { Suspense } from 'react'
import { AnalyticsView } from '@/components/views/analytics-view'

export const metadata = {
  title: 'Analytics — UUS Delhi',
  description: 'UUS score distribution, classification breakdown, indicator statistics and model feature importance for Delhi NCR.',
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="size-full" />}>
      <AnalyticsView />
    </Suspense>
  )
}
