/**
 * Procedural scenario generator. Same seed in, same store out.
 */

import { CATEGORIES, type CategoryDef, type PackFormat } from './catalog'
import {
  type AbcClass,
  byId,
  type CategoryKey,
  type Facing,
  type Fixture,
  type FixtureType,
  layoutShelf,
  type Planogram,
  type Scenario,
  type Shelf,
  type Sku,
} from '@/merch-kit'
import { gauss, mulberry32, paretoWeight, range, rangeInt, shuffle, type Rng } from './rng'

export type FixturePreset = {
  type: FixtureType
  label: string
  w: number
  h: number
  d: number
  shelfCount: number
}

export const FIXTURE_PRESETS: Record<FixtureType, FixturePreset> = {
  gondola: { type: 'gondola', label: 'Gondola run 3.75 m', w: 3750, h: 1800, d: 500, shelfCount: 5 },
  wall: { type: 'wall', label: 'Wall bay 2.5 m', w: 2500, h: 2100, d: 450, shelfCount: 6 },
  endcap: { type: 'endcap', label: 'End cap 1.25 m', w: 1250, h: 1650, d: 450, shelfCount: 4 },
  cooler: { type: 'cooler', label: 'Upright cooler 2.1 m', w: 2100, h: 2000, d: 550, shelfCount: 5 },
}

export type GenerateOptions = {
  seed: number
  category: CategoryKey
  skuCount: number
  fixtureType: FixtureType
  /** Overrides the preset when provided. */
  shelfCount?: number
  fixtureWidth?: number
}

export const DEFAULT_OPTIONS: GenerateOptions = {
  seed: 20260822,
  category: 'beverages',
  skuCount: 72,
  fixtureType: 'gondola',
}

const SHELF_THICKNESS = 25
/** Bottom shelves get more clearance, eye-level shelves less — as in a real bay. */
const GAP_WEIGHTS = [1.3, 1.12, 1.0, 0.95, 0.92, 0.9, 0.88, 0.86]

export function buildFixture(options: GenerateOptions): Fixture {
  const preset = FIXTURE_PRESETS[options.fixtureType]
  const shelfCount = options.shelfCount ?? preset.shelfCount
  const width = options.fixtureWidth ?? preset.w

  const baseY = 120
  const usableHeight = preset.h - baseY
  const weights = Array.from({ length: shelfCount }, (_, i) => GAP_WEIGHTS[Math.min(i, GAP_WEIGHTS.length - 1)])
  const weightSum = weights.reduce((a, b) => a + b, 0)

  const shelves: Shelf[] = []
  let y = baseY
  for (let i = 0; i < shelfCount; i++) {
    const slot = (usableHeight * weights[i]) / weightSum
    shelves.push({
      id: `shelf-${i}`,
      index: i,
      y: Math.round(y),
      gap: Math.round(slot - SHELF_THICKNESS),
      depth: preset.d - 40,
      thickness: SHELF_THICKNESS,
      type: 'shelf',
    })
    y += slot
  }

  return {
    id: 'fixture-1',
    name: preset.label,
    type: preset.type,
    w: width,
    h: preset.h,
    d: preset.d,
    shelves,
    pos: { x: 0, y: 0, rot: 0 },
  }
}

type Combo = { brandIndex: number; lineIndex: number; variant: string; format: PackFormat }

function buildCombos(def: CategoryDef): Combo[] {
  const formats = new Map(def.formats.map((f) => [f.label, f]))
  const combos: Combo[] = []
  def.brands.forEach((_, brandIndex) => {
    def.lines.forEach((line, lineIndex) => {
      for (const variant of line.variants) {
        for (const label of line.formats) {
          const format = formats.get(label)
          if (format) combos.push({ brandIndex, lineIndex, variant, format })
        }
      }
    })
  })
  return combos
}

/** Small formats turn faster than bulk ones; premium brands sell fewer units. */
function demandBias(def: CategoryDef, combo: Combo): number {
  const volumeProxy = (combo.format.w * combo.format.h * combo.format.d) / 1_000_000
  const sizePenalty = 1 / Math.pow(Math.max(volumeProxy, 0.2), 0.35)
  return sizePenalty / def.brands[combo.brandIndex].premium
}

function priceEnding(value: number): number {
  const rounded = Math.round(value * 20) / 20
  return Math.max(0.29, Math.round((rounded - 0.01) * 100) / 100)
}

function makeEan(rng: Rng): string {
  let digits = '80'
  for (let i = 0; i < 11; i++) digits += rangeInt(rng, 0, 9)
  return digits
}

export function generateSkus(options: GenerateOptions): Sku[] {
  const rng = mulberry32(options.seed)
  const def = CATEGORIES[options.category]
  const combos = shuffle(rng, buildCombos(def)).slice(0, options.skuCount)

  const weights = combos.map((combo, i) => paretoWeight(i, combos.length) * demandBias(def, combo))
  const weightSum = weights.reduce((a, b) => a + b, 0)

  const skus: Sku[] = combos.map((combo, i) => {
    const brand = def.brands[combo.brandIndex]
    const line = def.lines[combo.lineIndex]
    const variantPart = combo.variant ? ` ${combo.variant}` : ''
    const margin = Math.min(0.45, Math.max(0.12, gauss(rng, 0.28, 0.07)))
    const price = priceEnding(combo.format.price * brand.premium * range(rng, 0.94, 1.08))
    const unitsPerDay = Math.max(0.4, (weights[i] / weightSum) * def.dailyUnits * range(rng, 0.85, 1.15))

    return {
      id: `sku-${i.toString().padStart(3, '0')}`,
      name: `${brand.name} ${line.name}${variantPart} ${combo.format.label}`,
      brand: brand.name,
      category: def.label,
      ean: makeEan(rng),
      dims: { w: combo.format.w, h: combo.format.h, d: combo.format.d },
      price,
      cost: Math.round(price * (1 - margin) * 100) / 100,
      unitsPerDay: Math.round(unitsPerDay * 10) / 10,
      abc: 'C',
      hue: (brand.hue + combo.lineIndex * 7) % 360,
      accent: (brand.hue + 190 + combo.lineIndex * 5) % 360,
    }
  })

  return assignAbc(skus)
}

/** A/B/C by cumulative revenue share: 80% / 95% / rest. */
export function assignAbc(skus: Sku[]): Sku[] {
  const revenue = (sku: Sku) => sku.unitsPerDay * sku.price
  const total = skus.reduce((sum, sku) => sum + revenue(sku), 0)
  const ranked = [...skus].sort((a, b) => revenue(b) - revenue(a))

  let cumulative = 0
  const classes = new Map<string, AbcClass>()
  for (const sku of ranked) {
    cumulative += revenue(sku) / (total || 1)
    classes.set(sku.id, cumulative <= 0.8 ? 'A' : cumulative <= 0.95 ? 'B' : 'C')
  }

  return skus.map((sku) => ({ ...sku, abc: classes.get(sku.id) ?? 'C' }))
}

/**
 * A plausible hand-built starting planogram.
 *
 * Two passes, mirroring how a merchandiser actually works: first spread the
 * range over the shelves that can physically take each product (tallest first,
 * since those have the fewest options), then even out each row by handing out
 * facings until the shelf is full. The second pass is deliberately flat rather
 * than demand-weighted — that is exactly the slack autofacing later removes.
 */
export function buildInitialPlanogram(fixture: Fixture, skus: Sku[], seed: number): Planogram {
  const rng = mulberry32(seed ^ 0x5f3759df)
  const index = byId(skus)
  const fillTarget = fixture.w * 0.94
  const maxWide = 6

  const buckets = new Map<string, Sku[]>(fixture.shelves.map((shelf) => [shelf.id, []]))
  const used = new Map<string, number>(fixture.shelves.map((shelf) => [shelf.id, 0]))

  for (const sku of [...skus].sort((a, b) => b.dims.h - a.dims.h)) {
    const shelf = fixture.shelves
      .filter((candidate) => sku.dims.h <= candidate.gap)
      .sort((a, b) => (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0))
      .find((candidate) => (used.get(candidate.id) ?? 0) + sku.dims.w <= fillTarget)
    if (!shelf) continue // no shelf takes it: stays in the catalogue, unplaced

    buckets.get(shelf.id)!.push(sku)
    used.set(shelf.id, (used.get(shelf.id) ?? 0) + sku.dims.w)
  }

  const facings: Facing[] = []
  let n = 0

  for (const shelf of fixture.shelves) {
    const row = buckets.get(shelf.id) ?? []
    if (row.length === 0) continue

    const wide = new Map<string, number>(row.map((sku) => [sku.id, 1]))
    let rowWidth = row.reduce((sum, sku) => sum + sku.dims.w, 0)

    for (;;) {
      const eligible = row
        .filter(
          (sku) => rowWidth + sku.dims.w <= fillTarget && (wide.get(sku.id) ?? 1) < maxWide,
        )
        .sort(
          (a, b) =>
            (wide.get(a.id) ?? 1) - (wide.get(b.id) ?? 1) || b.unitsPerDay - a.unitsPerDay,
        )
      if (eligible.length === 0) break

      // A human row is never perfectly even — occasionally skip the front runner.
      const pickIndex = eligible.length > 1 && rng() < 0.25 ? 1 : 0
      const sku = eligible[pickIndex]
      wide.set(sku.id, (wide.get(sku.id) ?? 1) + 1)
      rowWidth += sku.dims.w
    }

    const ordered = [...row].sort(
      (a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name),
    )

    facings.push(
      ...layoutShelf(
        ordered.map((sku, i) => ({
          id: `facing-${(n++).toString().padStart(3, '0')}`,
          skuId: sku.id,
          shelfId: shelf.id,
          x: i, // provisional order; layoutShelf assigns real millimetres
          wide: wide.get(sku.id) ?? 1,
          high: sku.dims.h * 2 <= shelf.gap && sku.dims.h < 100 ? 2 : 1,
          deep: Math.max(1, Math.floor(shelf.depth / sku.dims.d)),
          orientation: 'front' as const,
        })),
        index,
      ),
    )
  }

  return { id: 'planogram-1', fixtureId: fixture.id, facings }
}

export function generateScenario(options: GenerateOptions = DEFAULT_OPTIONS): Scenario {
  const fixture = buildFixture(options)
  const skus = generateSkus(options)
  return {
    seed: options.seed,
    category: options.category,
    skuCount: options.skuCount,
    fixture,
    skus,
    planogram: buildInitialPlanogram(fixture, skus, options.seed),
  }
}
