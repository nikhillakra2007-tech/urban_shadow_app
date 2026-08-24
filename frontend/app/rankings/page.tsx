import { Suspense } from 'react'
import { RankingsView } from '@/components/views/rankings-view'

export const metadata = {
  title: 'Rankings — UUS Delhi',
  description: 'Top and bottom performing UUS Delhi grids ranked by sustainability score.',
}

export default function RankingsPage() {
  return (
    <Suspense fallback={<div className="size-full" />}>
      <RankingsView />
    </Suspense>
  )
}
