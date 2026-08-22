/**
 * One colour source for both renderers. The 2D canvas and the 3D scene call
 * `colorFor` with the same arguments, so a facing is never two different
 * colours in two views.
 */

import type { Facing, Sku } from './model'
import type { FacingStats } from './metrics'
import { OVERSTOCK_DOS, STOCKOUT_DOS } from './metrics'

export type MetricKey = 'none' | 'sales' | 'margin' | 'abc' | 'turnover' | 'dos'

export const METRICS: { key: MetricKey; label: string; hint: string }[] = [
  { key: 'none', label: 'Packaging', hint: 'Brand colours' },
  { key: 'sales', label: 'Sales', hint: 'EUR/day per facing' },
  { key: 'margin', label: 'Margin', hint: 'EUR/day per facing' },
  { key: 'abc', label: 'ABC', hint: 'Revenue class' },
  { key: 'turnover', label: 'Turnover', hint: 'Units/day' },
  { key: 'dos', label: 'Days of supply', hint: 'Capacity / demand' },
]

/** Cool-to-warm ramp, low value first. */
const RAMP = ['#1e3a8a', '#0e7490', '#15803d', '#ca8a04', '#ea580c', '#dc2626']

export const ABC_COLORS: Record<Sku['abc'], string> = {
  A: '#16a34a',
  B: '#eab308',
  C: '#94a3b8',
}

function lerpHex(a: string, b: string, t: number): string {
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const [r1, g1, b1] = parse(a)
  const [r2, g2, b2] = parse(b)
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `#${[mix(r1, r2), mix(g1, g2), mix(b1, b2)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`
}

export function rampColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t))
  const scaled = clamped * (RAMP.length - 1)
  const i = Math.min(RAMP.length - 2, Math.floor(scaled))
  return lerpHex(RAMP[i], RAMP[i + 1], scaled - i)
}

// Comma syntax on purpose: THREE.Color parses `hsl(h, s%, l%)` but not the
// modern space-separated CSS form, and both canvases share these strings.
export const packagingColor = (sku: Sku, lighten = 0): string =>
  `hsl(${sku.hue}, 62%, ${Math.min(80, 52 + lighten)}%)`

export const labelColor = (sku: Sku): string => `hsl(${sku.accent}, 70%, 88%)`

/**
 * Precomputed once per render so colours stay comparable across facings.
 * `sorted` drives a rank-based (quantile) ramp: retail metrics are heavily
 * skewed, and a raw min-max ramp would paint everything the colour of the
 * bottom decile just because one bestseller stretches the top of the range.
 */
export type MetricScale = {
  metric: MetricKey
  min: number
  max: number
  sorted: number[]
}

function metricValue(metric: MetricKey, stats: FacingStats): number {
  switch (metric) {
    case 'sales':
      return stats.salesPerDay
    case 'margin':
      return stats.marginPerDay
    case 'turnover':
      return stats.unitsPerDay
    case 'dos':
      return Number.isFinite(stats.dos) ? stats.dos : OVERSTOCK_DOS * 2
    default:
      return 0
  }
}

export function buildScale(metric: MetricKey, allStats: Iterable<FacingStats>): MetricScale {
  const sorted = [...allStats].map((stats) => metricValue(metric, stats)).sort((a, b) => a - b)
  if (sorted.length === 0) return { metric, min: 0, max: 1, sorted }
  return { metric, min: sorted[0], max: sorted[sorted.length - 1], sorted }
}

/** Share of facings at or below `value`, 0..1. */
function quantile(sorted: number[], value: number): number {
  if (sorted.length < 2) return 0.5
  let low = 0
  let high = sorted.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (sorted[mid] < value) low = mid + 1
    else high = mid
  }
  return low / (sorted.length - 1)
}

export function colorFor(
  sku: Sku,
  _facing: Facing,
  stats: FacingStats | undefined,
  scale: MetricScale,
): string {
  if (scale.metric === 'none' || !stats) return packagingColor(sku)
  if (scale.metric === 'abc') return ABC_COLORS[sku.abc]

  const value = metricValue(scale.metric, stats)

  // Days of supply is not "more is better": both ends are problems.
  if (scale.metric === 'dos') {
    if (value < STOCKOUT_DOS) return '#dc2626'
    if (value > OVERSTOCK_DOS) return '#7c3aed'
    return rampColor(0.35 + (value / OVERSTOCK_DOS) * 0.25)
  }

  return rampColor(quantile(scale.sorted, value))
}

/** Relative luminance for `#rrggbb` or `hsl(h, s%, l%)` strings. */
function luminance(color: string): number {
  if (color.startsWith('#')) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const match = color.match(/hsl\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*([\d.]+)%/)
  return match ? Number(match[1]) / 100 : 0.5
}

/** Text colour that stays legible on top of a facing fill. */
export const readableText = (color: string): string =>
  luminance(color) > 0.62 ? 'rgba(9,14,22,0.88)' : 'rgba(255,255,255,0.94)'
