/**
 * Static geographic reference points for NCR context labelling only.
 * These are place coordinates — never sustainability data.
 */

export interface PlaceLabel {
  name: string
  coordinates: [number, number]
  kind: 'focus' | 'state' | 'city'
}

export const NCR_PLACES: PlaceLabel[] = [
  { name: 'DELHI', coordinates: [77.216, 28.6448], kind: 'focus' },
  { name: 'HARYANA', coordinates: [76.55, 28.42], kind: 'state' },
  { name: 'UTTAR PRADESH', coordinates: [78.05, 28.35], kind: 'state' },
  { name: 'RAJASTHAN', coordinates: [76.35, 27.6], kind: 'state' },
  { name: 'Gurugram', coordinates: [77.0266, 28.4595], kind: 'city' },
  { name: 'Noida', coordinates: [77.391, 28.5355], kind: 'city' },
  { name: 'Ghaziabad', coordinates: [77.4538, 28.6692], kind: 'city' },
  { name: 'Faridabad', coordinates: [77.3178, 28.4089], kind: 'city' },
  { name: 'Sonipat', coordinates: [77.0151, 28.9931], kind: 'city' },
  { name: 'Bahadurgarh', coordinates: [76.9366, 28.6926], kind: 'city' },
  { name: 'Meerut', coordinates: [77.7064, 28.9845], kind: 'city' },
]

/** Delhi-centred default camera. */
export const DELHI_VIEW = {
  center: [77.16, 28.645] as [number, number],
  zoom: 9.35,
  pitch: 0,
  bearing: 0,
}

/** Light, key-free neutral raster basemap (CARTO Positron) with labels. */
export const BASEMAP = {
  base: [
    'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
    'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
    'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
  ],
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
}
