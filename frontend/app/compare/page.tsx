import { Suspense } from 'react'
import { CompareView } from '@/components/views/compare-view'

export const metadata = {
  title: 'Compare Grids — UUS Delhi',
  description: 'Compare up to 3 Delhi UUS grids side by side across all sustainability indicators.',
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="size-full" />}>
      <CompareView />
    </Suspense>
  )
}
