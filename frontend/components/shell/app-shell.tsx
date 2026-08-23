'use client'

import { Suspense, type ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppStateProvider } from '@/lib/app-state'
import { SidebarNav } from './sidebar-nav'
import { TopBar } from './top-bar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppStateProvider>
      <TooltipProvider>
        <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
          <Suspense fallback={<div className="h-16 shrink-0 border-b border-hairline bg-sidebar/70" />}>
            <TopBar />
          </Suspense>
          <div className="flex min-h-0 flex-1">
            <Suspense fallback={<div className="w-[4.25rem] shrink-0 border-r border-hairline bg-sidebar/80" />}>
              <SidebarNav />
            </Suspense>
            <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
          </div>
        </div>
      </TooltipProvider>
    </AppStateProvider>
  )
}

