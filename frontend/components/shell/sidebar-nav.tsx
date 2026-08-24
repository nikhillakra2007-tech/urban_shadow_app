'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  BarChart3,
  Bot,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  FileText,
  LayoutDashboard,
  Map as MapIcon,
  Settings,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: typeof MapIcon
  match?: (pathname: string, panel: string | null) => boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Overview',
    href: '/?view=overview',
    icon: LayoutDashboard,
    match: (pathname, panel) => pathname === '/' && panel === 'overview',
  },
  {
    label: 'Intelligence Map',
    href: '/',
    icon: MapIcon,
    match: (pathname, panel) => pathname === '/' && !panel,
  },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Rankings', href: '/rankings', icon: Trophy },
  { label: 'Compare', href: '/compare', icon: Columns3 },
  {
    label: 'AI Suggestions',
    href: '/?panel=ai',
    icon: Bot,
    match: (pathname, panel) => pathname === '/' && panel === 'ai',
  },
  {
    label: 'What-If Simulator',
    href: '/?panel=whatif',
    icon: Sparkles,
    match: (pathname, panel) => pathname === '/' && panel === 'whatif',
  },
  { label: 'Reports', href: '/reports', icon: FileText },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export function SidebarNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const panel = searchParams.get('panel') ?? searchParams.get('view')
  const [expanded, setExpanded] = useState(true)

  return (
    <nav
      aria-label="Primary"
      data-expanded={expanded}
      className={cn(
        'z-20 flex shrink-0 flex-col border-r border-hairline bg-sidebar/80 backdrop-blur-xl transition-[width] duration-300 ease-out',
        expanded ? 'w-[13.5rem]' : 'w-[4.25rem]',
        'max-lg:w-[4.25rem]',
      )}
    >
      <div className="flex flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active = item.match ? item.match(pathname, panel) : pathname.startsWith(item.href.split('?')[0])
          const Icon = item.icon
          return (
            <Tooltip key={item.label}>
              <TooltipTrigger
                render={
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-1/2 left-0 h-6 w-[2px] -translate-y-1/2 rounded-full bg-primary transition-opacity',
                        active ? 'opacity-100' : 'opacity-0',
                      )}
                      aria-hidden
                    />
                    <Icon className="size-[1.05rem] shrink-0" aria-hidden />
                    <span
                      className={cn(
                        'truncate transition-opacity duration-200 max-lg:hidden',
                        expanded ? 'opacity-100' : 'pointer-events-none opacity-0',
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                }
              />
              <TooltipContent side="right" className={cn(expanded && 'lg:hidden')}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      <div className="mt-auto p-3">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-lg:hidden"
        >
          {expanded ? (
            <ChevronsLeft className="size-[1.05rem] shrink-0" aria-hidden />
          ) : (
            <ChevronsRight className="size-[1.05rem] shrink-0" aria-hidden />
          )}
          <span className={cn('text-mono-label', expanded ? 'opacity-100' : 'hidden')}>Collapse</span>
        </button>
      </div>
    </nav>
  )
}
