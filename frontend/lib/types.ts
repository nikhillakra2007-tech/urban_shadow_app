/**
 * Typed contracts for the UUS Delhi FastAPI backend.
 *
 * The backend is the single source of truth. These interfaces are intentionally
 * permissive (`[key: string]: unknown` escape hatches + optional fields) so the
 * UI can surface whatever the API actually returns without ever inventing data.
 */

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

export type Classification = 'Critical' | 'Low' | 'Moderate' | 'Good' | 'Excellent' | (string & {})

/** GET /api/health */
export interface HealthResponse {
  status?: string
  model?: string
  model_loaded?: boolean
  version?: string
  grids?: number
  last_updated?: string
  [key: string]: unknown
}

/** GET /api/overview */
export interface OverviewResponse {
  total_grids?: number
  average_uus?: number
  avg_uus?: number
  mean_uus?: number
  highest_uus?: number
  max_uus?: number
  lowest_uus?: number
  min_uus?: number
  critical_grids?: number
  critical_count?: number
  median_uus?: number
  std_uus?: number
  classification_counts?: Record<string, number>
  class_distribution?: Record<string, number>
  last_updated?: string
  model?: string
  [key: string]: unknown
}

/** A single grid record. Only `grid_id` + a score are assumed. */
export interface GridRecord {
  grid_id?: string | number
  id?: string | number
  uus_score?: number
  uus?: number
  score?: number
  classification?: Classification
  class?: Classification
  category?: Classification
  locality?: string
  area?: string
  name?: string
  district?: string
  zone?: string
  latitude?: number
  longitude?: number
  lat?: number
  lon?: number
  lng?: number
  rank?: number
  [key: string]: unknown
}

/** GET /api/grids */
export interface GridsResponse {
  grids?: GridRecord[]
  data?: GridRecord[]
  items?: GridRecord[]
  results?: GridRecord[]
  total?: number
  count?: number
  [key: string]: unknown
}

/** GET /api/grids/geojson — Point features, one per UUS grid. */
export interface GridFeatureProperties {
  grid_id?: string | number
  uus_score?: number
  classification?: Classification
  locality?: string
  [key: string]: unknown
}

export interface GridFeature {
  type: 'Feature'
  id?: string | number
  geometry: { type: 'Point'; coordinates: [number, number] } | { type: string; coordinates: unknown }
  properties: GridFeatureProperties
}

export interface GridGeoJson {
  type: 'FeatureCollection'
  features: GridFeature[]
  [key: string]: unknown
}

/** GET /api/rankings */
export interface RankingsResponse {
  top?: GridRecord[]
  bottom?: GridRecord[]
  top_grids?: GridRecord[]
  bottom_grids?: GridRecord[]
  highest?: GridRecord[]
  lowest?: GridRecord[]
  best?: GridRecord[]
  worst?: GridRecord[]
  [key: string]: unknown
}

export interface HistogramBin {
  bin?: string | number
  range?: string
  label?: string
  count?: number
  frequency?: number
  value?: number
  [key: string]: unknown
}

export interface FeatureImportanceItem {
  feature?: string
  name?: string
  importance?: number
  value?: number
  weight?: number
  [key: string]: unknown
}

/** GET /api/analytics */
export interface AnalyticsResponse {
  distribution?: HistogramBin[] | Record<string, number>
  uus_distribution?: HistogramBin[] | Record<string, number>
  histogram?: HistogramBin[] | Record<string, number>
  classification_distribution?: Record<string, number> | HistogramBin[]
  class_distribution?: Record<string, number> | HistogramBin[]
  feature_importance?: FeatureImportanceItem[] | Record<string, number>
  indicator_stats?: Record<string, Record<string, number>>
  indicator_distribution?: Record<string, Record<string, number>>
  top_grids?: GridRecord[]
  bottom_grids?: GridRecord[]
  [key: string]: unknown
}

/** GET /api/grids/{id}/explanation */
export interface ContributionItem {
  feature?: string
  name?: string
  contribution?: number
  value?: number
  impact?: number
  shap_value?: number
  direction?: string
  [key: string]: unknown
}

export interface ExplanationResponse {
  grid_id?: string | number
  /** Per-grid signed contributions (e.g. SHAP), when the backend provides them. */
  contributions?: ContributionItem[] | Record<string, number>
  feature_contributions?: ContributionItem[] | Record<string, number>
  shap_values?: ContributionItem[] | Record<string, number>
  positive?: ContributionItem[]
  negative?: ContributionItem[]
  positive_contributors?: ContributionItem[]
  negative_contributors?: ContributionItem[]
  /** Model-wide importance — NOT a per-grid causal explanation. */
  feature_importance?: FeatureImportanceItem[] | Record<string, number>
  global_feature_importance?: FeatureImportanceItem[] | Record<string, number>
  summary?: string
  explanation?: string
  method?: string
  [key: string]: unknown
}

/** POST /api/ai-suggestions */
export interface SuggestionItem {
  priority?: number | string
  title?: string
  problem?: string
  issue?: string
  why?: string
  why_it_matters?: string
  rationale?: string
  recommendation?: string
  intervention?: string
  action?: string
  affected_indicators?: string[]
  indicators?: string[]
  features?: string[]
  impact?: string | number
  severity?: string
  [key: string]: unknown
}

export interface AiSuggestionsResponse {
  grid_id?: string | number
  suggestions?: SuggestionItem[]
  recommendations?: SuggestionItem[]
  results?: SuggestionItem[]
  /** e.g. "rules" | "llm" — used to label the source honestly. */
  source?: string
  method?: string
  generated_by?: string
  model?: string
  [key: string]: unknown
}

/** POST /api/simulate */
export interface SimulateRequest {
  grid_id: string | number
  changes: Record<string, number>
  [key: string]: unknown
}

export interface SimulateResponse {
  grid_id?: string | number
  current_uus?: number
  original_uus?: number
  baseline_uus?: number
  simulated_uus?: number
  predicted_uus?: number
  new_uus?: number
  delta?: number
  change?: number
  difference?: number
  classification?: Classification
  simulated_classification?: Classification
  impacts?: Record<string, { before?: number; after?: number }> | ImpactItem[]
  changes?: Record<string, { before?: number; after?: number }> | ImpactItem[]
  unsupported?: string[]
  unsupported_features?: string[]
  supported_features?: string[]
  message?: string
  note?: string
  [key: string]: unknown
}

export interface ImpactItem {
  feature?: string
  name?: string
  before?: number
  after?: number
  from?: number
  to?: number
  [key: string]: unknown
}
