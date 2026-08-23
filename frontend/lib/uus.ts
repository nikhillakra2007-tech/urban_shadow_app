/**
 * UUS presentation helpers: score → colour band, label formatting.
 * These never compute a UUS score; they only visualise scores from the API.
 */

export type Band = 'critical' | 'low' | 'moderate' | 'good' | 'excellent'

export interface BandDefinition {
  key: Band
  label: string
  /** Hex values are required by MapLibre paint expressions. */
  hex: string
  /** Tailwind token class for UI chrome. */
  text: string
  bg: string
  ring: string
}

export const BANDS: BandDefinition[] = [
  { key: 'critical', label: 'Critical', hex: '#e5484d', text: 'text-critical', bg: 'bg-critical/12', ring: 'ring-critical/40' },
  { key: 'low', label: 'Low', hex: '#f2820a', text: 'text-low', bg: 'bg-low/12', ring: 'ring-low/40' },
  { key: 'moderate', label: 'Moderate', hex: '#e9c412', text: 'text-moderate', bg: 'bg-moderate/12', ring: 'ring-moderate/40' },
  { key: 'good', label: 'Good', hex: '#5ec26a', text: 'text-good', bg: 'bg-good/12', ring: 'ring-good/40' },
  { key: 'excellent', label: 'Excellent', hex: '#1fc48b', text: 'text-excellent', bg: 'bg-excellent/12', ring: 'ring-excellent/40' },
]

const BY_KEY = new Map(BANDS.map((band) => [band.key, band]))

/**
 * Band from a score, positioned against the real min/max supplied by the API.
 * Falls back to a 0–100 scale when the backend has not reported bounds yet.
 */
export function bandForScore(score: number | undefined, min = 0, max = 100): BandDefinition {
  if (score === undefined || !Number.isFinite(score)) return BANDS[2]
  const span = max - min || 1
  const t = Math.min(1, Math.max(0, (score - min) / span))
  if (t < 0.2) return BANDS[0]
  if (t < 0.4) return BANDS[1]
  if (t < 0.6) return BANDS[2]
  if (t < 0.8) return BANDS[3]
  return BANDS[4]
}

/** Band from the backend's own classification string, when present. */
export function bandForClassification(classification: string | undefined): BandDefinition | undefined {
  if (!classification) return undefined
  const key = classification.trim().toLowerCase()
  if (BY_KEY.has(key as Band)) return BY_KEY.get(key as Band)
  if (key.includes('critical') || key.includes('very low')) return BANDS[0]
  if (key.includes('excellent') || key.includes('very good') || key.includes('high')) return BANDS[4]
  if (key.includes('good')) return BANDS[3]
  if (key.includes('moderate') || key.includes('medium') || key.includes('average')) return BANDS[2]
  if (key.includes('low') || key.includes('poor')) return BANDS[1]
  return undefined
}

export function resolveBand(
  score: number | undefined,
  classification: string | undefined,
  min?: number,
  max?: number,
): BandDefinition {
  return bandForClassification(classification) ?? bandForScore(score, min, max)
}

/** Colour stops for MapLibre `interpolate` expressions. */
export function colorStops(min: number, max: number): (number | string)[] {
  const span = max - min || 1
  return BANDS.flatMap((band, index) => [min + (span * index) / (BANDS.length - 1), band.hex])
}

export function formatScore(value: number | undefined, digits = 2): string {
  if (value === undefined || !Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

export function formatCompact(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function formatNumber(value: number | undefined, digits = 0): string {
  if (value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits }).format(value)
}

/** `population_density` → `Population Density` */
export function humanizeFeature(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b(pm)\s?2\s?5\b/i, 'PM2.5')
    .replace(/\buus\b/i, 'UUS')
    .replace(/\bndvi\b/i, 'NDVI')
    .replace(/\baqi\b/i, 'AQI')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bUus\b/g, 'UUS')
    .replace(/\bPm2\.5\b/gi, 'PM2.5')
}

/** Keys that are metadata rather than indicator values. */
export const NON_INDICATOR_KEYS = new Set([
  'grid_id',
  'gridid',
  'id',
  'grid',
  'uus_score',
  'uus',
  'score',
  'classification',
  'class',
  'category',
  'uus_class',
  'label',
  'locality',
  'area',
  'name',
  'ward',
  'district',
  'zone',
  'region',
  'latitude',
  'longitude',
  'lat',
  'lon',
  'lng',
  'rank',
  'geometry',
  'type',
  'index',
])

export interface Indicator {
  key: string
  label: string
  value: number
}

/** Every numeric, non-metadata field on a grid record — nothing invented. */
export function extractIndicators(record: Record<string, unknown> | undefined | null): Indicator[] {
  if (!record) return []
  return Object.entries(record)
    .filter(([key, value]) => typeof value === 'number' && Number.isFinite(value) && !NON_INDICATOR_KEYS.has(key.toLowerCase()))
    .map(([key, value]) => ({ key, label: humanizeFeature(key), value: value as number }))
}
