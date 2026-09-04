/**
 * Single access point to the UUS Delhi FastAPI backend.
 * No component should call fetch() directly.
 */
import type {
  AiSuggestionsResponse,
  AnalyticsResponse,
  ExplanationResponse,
  GridGeoJson,
  GridRecord,
  GridsResponse,
  HealthResponse,
  OverviewResponse,
  RankingsResponse,
  SimulateRequest,
  SimulateResponse,
} from './types'

/**
 * API base URL resolution order:
 *   1. NEXT_PUBLIC_API_URL at build time (set in .env.local for local dev,
 *      or in the hosting dashboard for production deployments).
 *   2. Falls back to the deployed Render backend.
 * Local development: frontend/.env.local -> http://localhost:8000
 */
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? 'https://urban-shadow-api.onrender.com'
).replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  url: string
  isColdStart: boolean
  constructor(message: string, status: number, url: string, isColdStart = false) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.url = url
    this.isColdStart = isColdStart
  }
}

/** Maximum time (ms) to wait for a single fetch before aborting. */
const REQUEST_TIMEOUT_MS = 45_000

/** Number of automatic retries for network failures (cold starts). */
const MAX_RETRIES = 2

async function request<T>(path: string, init?: RequestInit & { query?: Record<string, string | number | undefined> }): Promise<T> {
  const { query, ...rest } = init ?? {}
  const url = new URL(`${API_URL}${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
    }
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(url.toString(), {
        ...rest,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
          ...rest.headers,
        },
        cache: 'no-store',
      })

      clearTimeout(timeout)

      if (!response.ok) {
        let detail = `${response.status} ${response.statusText}`
        try {
          const body = (await response.json()) as { detail?: string; message?: string }
          detail = body?.detail ?? body?.message ?? detail
        } catch {
          /* non-JSON error body */
        }
        throw new ApiError(detail, response.status, url.toString())
      }

      return (await response.json()) as T
    } catch (error) {
      clearTimeout(timeout)

      // Don't retry non-network errors (4xx, 5xx from the server)
      if (error instanceof ApiError && error.status > 0) throw error

      lastError = error instanceof Error ? error : new Error(String(error))

      // Wait before retrying (exponential backoff: 2s, 4s)
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 2000))
      }
    }
  }

  // All retries exhausted
  const isColdStart = lastError?.name === 'AbortError' ||
    lastError?.message?.includes('fetch') ||
    lastError?.message?.includes('network') ||
    lastError?.message?.includes('Failed')

  throw new ApiError(
    isColdStart
      ? `The UUS API is waking up from a cold start. Please wait a moment and retry. (${API_URL})`
      : `Cannot reach the UUS API at ${API_URL}. Is the FastAPI backend running?`,
    0,
    url.toString(),
    isColdStart,
  )
}

export const api = {
  health: () => request<HealthResponse>('/api/health'),
  overview: () => request<OverviewResponse>('/api/overview'),
  rankings: (limit?: number) => request<RankingsResponse>('/api/rankings', { query: { limit } }),
  analytics: () => request<AnalyticsResponse>('/api/analytics'),
  grids: (params?: { limit?: number; offset?: number; search?: string }) =>
    request<GridsResponse | GridRecord[]>('/api/grids', { query: params }),
  gridsGeoJson: () => request<GridGeoJson>('/api/grids/geojson'),
  cells: () => request<GridGeoJson>('/api/grids/cells'),
  grid: (gridId: string) => request<GridRecord>(`/api/grids/${encodeURIComponent(gridId)}`),
  explanation: (gridId: string) =>
    request<ExplanationResponse>(`/api/grids/${encodeURIComponent(gridId)}/explanation`),
  aiSuggestions: (gridId: string) =>
    request<AiSuggestionsResponse>('/api/ai-suggestions', {
      method: 'POST',
      body: JSON.stringify({ grid_id: gridId }),
    }),
  simulate: (payload: SimulateRequest) =>
    request<SimulateResponse>('/api/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}

/* ------------------------------------------------------------------ */
/* Field resolution helpers                                           */
/* Backend key names may vary; read the first key that actually exists */
/* rather than guessing or fabricating a value.                        */
/* ------------------------------------------------------------------ */

export function pickNumber(source: unknown, keys: string[]): number | undefined {
  if (!source || typeof source !== 'object') return undefined
  const record = source as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  }
  return undefined
}

export function pickString(source: unknown, keys: string[]): string | undefined {
  if (!source || typeof source !== 'object') return undefined
  const record = source as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim() !== '') return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return undefined
}

export function pickArray<T = unknown>(source: unknown, keys: string[]): T[] | undefined {
  if (Array.isArray(source)) return source as T[]
  if (!source || typeof source !== 'object') return undefined
  const record = source as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return value as T[]
  }
  return undefined
}

export function pickRecord(source: unknown, keys: string[]): Record<string, unknown> | undefined {
  if (!source || typeof source !== 'object') return undefined
  const record = source as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  }
  return undefined
}

export const GRID_ID_KEYS = ['grid_id', 'gridId', 'id', 'grid']
export const SCORE_KEYS = ['uus_score', 'uus', 'score', 'uus_index', 'predicted_uus']
export const CLASS_KEYS = ['classification', 'class', 'category', 'uus_class', 'label']
export const PLACE_KEYS = ['area_name', 'locality', 'area', 'name', 'ward', 'district', 'zone', 'region']

export function gridIdOf(record: unknown): string | undefined {
  return pickString(record, GRID_ID_KEYS)
}

export function scoreOf(record: unknown): number | undefined {
  return pickNumber(record, SCORE_KEYS)
}

export function classOf(record: unknown): string | undefined {
  return pickString(record, CLASS_KEYS)
}

export function placeOf(record: unknown): string | undefined {
  return pickString(record, PLACE_KEYS)
}

export function normalizeGridList(payload: unknown): GridRecord[] {
  const list = pickArray<GridRecord>(payload, ['grids', 'data', 'items', 'results', 'records'])
  return list ?? []
}

/** Turn `{a: 1, b: 2}` or `[{name, value}]` into a uniform chart-friendly list. */
export function toEntryList(
  source: unknown,
  nameKeys: string[] = ['feature', 'name', 'label', 'bin', 'range', 'classification'],
  valueKeys: string[] = ['value', 'count', 'importance', 'frequency', 'weight', 'contribution'],
): { name: string; value: number }[] {
  if (!source) return []
  if (Array.isArray(source)) {
    return source
      .map((item) => {
        const name = pickString(item, nameKeys)
        const value = pickNumber(item, valueKeys)
        if (name === undefined || value === undefined) return null
        return { name, value }
      })
      .filter((item): item is { name: string; value: number } => item !== null)
  }
  if (typeof source === 'object') {
    return Object.entries(source as Record<string, unknown>)
      .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
      .map(([name, value]) => ({ name, value: value as number }))
  }
  return []
}
