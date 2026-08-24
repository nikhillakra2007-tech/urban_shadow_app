import { Suspense } from 'react'

export const metadata = {
  title: 'Reports — UUS Delhi',
  description: 'UUS Delhi intelligence reports and data exports.',
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="size-full" />}>
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="glass rounded-xl p-8 max-w-sm">
          <div className="text-mono-label text-muted-foreground mb-2">COMING SOON</div>
          <h1 className="text-lg font-semibold text-foreground">Reports</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Automated PDF and CSV export of UUS intelligence reports will be available in a future release.
          </p>
        </div>
      </div>
    </Suspense>
  )
}
