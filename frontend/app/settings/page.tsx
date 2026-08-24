import { Suspense } from 'react'

export const metadata = {
  title: 'Settings — UUS Delhi',
  description: 'UUS Delhi platform settings.',
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="size-full" />}>
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="glass rounded-xl p-8 max-w-sm">
          <div className="text-mono-label text-muted-foreground mb-2">SETTINGS</div>
          <h1 className="text-lg font-semibold text-foreground">Platform Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            API endpoint:{' '}
            <code className="font-mono text-xs text-primary">
              {process.env.NEXT_PUBLIC_API_URL ?? 'https://urban-shadow-backend.onrender.com'}
            </code>
          </p>
        </div>
      </div>
    </Suspense>
  )
}
