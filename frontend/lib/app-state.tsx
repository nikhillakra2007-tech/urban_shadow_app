'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export interface AppState {
  selectedGridId: string | null
  /** Increments whenever the map should re-centre on the selection. */
  focusToken: number
  activeLayer: string
  compareIds: string[]
  selectGrid: (gridId: string | null, options?: { focus?: boolean }) => void
  setActiveLayer: (layer: string) => void
  toggleCompare: (gridId: string) => void
  removeCompare: (gridId: string) => void
  clearCompare: () => void
}

const AppStateContext = createContext<AppState | null>(null)

export const MAX_COMPARE = 3

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [selectedGridId, setSelectedGridId] = useState<string | null>(null)
  const [focusToken, setFocusToken] = useState(0)
  const [activeLayer, setActiveLayer] = useState('uus_score')
  const [compareIds, setCompareIds] = useState<string[]>([])

  const selectGrid = useCallback((gridId: string | null, options?: { focus?: boolean }) => {
    setSelectedGridId(gridId)
    if (gridId && options?.focus !== false) setFocusToken((token) => token + 1)
  }, [])

  const toggleCompare = useCallback((gridId: string) => {
    setCompareIds((current) => {
      if (current.includes(gridId)) return current.filter((id) => id !== gridId)
      if (current.length >= MAX_COMPARE) return [...current.slice(1), gridId]
      return [...current, gridId]
    })
  }, [])

  const removeCompare = useCallback((gridId: string) => {
    setCompareIds((current) => current.filter((id) => id !== gridId))
  }, [])

  const clearCompare = useCallback(() => setCompareIds([]), [])

  const value = useMemo<AppState>(
    () => ({
      selectedGridId,
      focusToken,
      activeLayer,
      compareIds,
      selectGrid,
      setActiveLayer,
      toggleCompare,
      removeCompare,
      clearCompare,
    }),
    [selectedGridId, focusToken, activeLayer, compareIds, selectGrid, toggleCompare, removeCompare, clearCompare],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState(): AppState {
  const context = useContext(AppStateContext)
  if (!context) throw new Error('useAppState must be used inside AppStateProvider')
  return context
}
