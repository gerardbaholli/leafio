import { describe, expect, it } from 'vitest'

import { DEFAULT_AUTOFACING, applyTargets, computeAutofacing } from '../autofacing'
import { DEFAULT_OPTIONS, buildFixture, generateScenario, generateSkus } from '../generate'
import { facingFootprint, byId, type Facing } from '../model'
import { facingStats, planogramStats, serviceLevel, TARGET_DOS } from '../metrics'
import { insertIndexAt, layoutShelf, placeFacing, shelfReport } from '../packing'
import { mulberry32, paretoWeight } from '../rng'
import { buildScale, colorFor, packagingColor, readableText } from '../colors'

const scenario = generateScenario(DEFAULT_OPTIONS)
const skuIndex = byId(scenario.skus)

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = Array.from({ length: 5 }, mulberry32(42))
    const b = Array.from({ length: 5 }, mulberry32(42))
    expect(a).toEqual(b)
    expect(a).not.toEqual(Array.from({ length: 5 }, mulberry32(43)))
  })

  it('gives a heavy head and a long tail', () => {
    expect(paretoWeight(0, 100)).toBeGreaterThan(paretoWeight(99, 100))
  })
})

describe('generator', () => {
  it('rebuilds an identical scenario from the same seed', () => {
    expect(JSON.stringify(generateScenario(DEFAULT_OPTIONS))).toEqual(
      JSON.stringify(generateScenario(DEFAULT_OPTIONS)),
    )
  })

  it('produces a different catalogue for a different seed', () => {
    const other = generateScenario({ ...DEFAULT_OPTIONS, seed: DEFAULT_OPTIONS.seed + 1 })
    expect(other.skus.map((s) => s.name)).not.toEqual(scenario.skus.map((s) => s.name))
  })

  it('names SKUs from real-looking brand, line and format parts', () => {
    for (const sku of scenario.skus) {
      expect(sku.name.startsWith(sku.brand)).toBe(true)
      expect(sku.name.split(' ').length).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps prices above cost and demand positive', () => {
    for (const sku of scenario.skus) {
      expect(sku.price).toBeGreaterThan(sku.cost)
      expect(sku.unitsPerDay).toBeGreaterThan(0)
    }
  })

  it('classifies a minority of SKUs as A', () => {
    const aCount = scenario.skus.filter((s) => s.abc === 'A').length
    expect(aCount).toBeGreaterThan(0)
    expect(aCount).toBeLessThan(scenario.skus.length)
  })

  it('builds shelves that stay inside the fixture height', () => {
    for (const shelf of scenario.fixture.shelves) {
      expect(shelf.y + shelf.gap).toBeLessThanOrEqual(scenario.fixture.h + 1)
    }
  })

  it('spreads the range over every shelf that can take product', () => {
    const usedShelves = new Set(scenario.planogram.facings.map((f) => f.shelfId))
    expect(usedShelves.size).toBe(scenario.fixture.shelves.length)
  })

  it('fills each shelf like a real bay rather than leaving it half empty', () => {
    for (const shelf of scenario.fixture.shelves) {
      const report = shelfReport(shelf, scenario.fixture, scenario.planogram.facings, skuIndex)
      expect(report.fillRate).toBeGreaterThan(0.75)
      expect(report.fillRate).toBeLessThanOrEqual(1)
    }
  })

  it('never overfills a shelf in the initial planogram', () => {
    for (const shelf of scenario.fixture.shelves) {
      const report = shelfReport(shelf, scenario.fixture, scenario.planogram.facings, skuIndex)
      expect(report.overflow).toBe(0)
      expect(report.tooTall).toHaveLength(0)
    }
  })
})

describe('packing', () => {
  const shelf = scenario.fixture.shelves[0]
  const row = scenario.planogram.facings.filter((f) => f.shelfId === shelf.id)

  it('lays facings out contiguously with no overlap and no gaps', () => {
    const laid = layoutShelf(row.slice().sort((a, b) => a.x - b.x), skuIndex)
    let cursor = 0
    for (const facing of laid) {
      expect(facing.x).toBe(cursor)
      cursor += facingFootprint(facing, skuIndex.get(facing.skuId)!).width
    }
  })

  it('picks an insertion index from the pointer position', () => {
    const laid = layoutShelf(row.slice().sort((a, b) => a.x - b.x), skuIndex)
    expect(insertIndexAt(laid, skuIndex, -50)).toBe(0)
    expect(insertIndexAt(laid, skuIndex, 1e6)).toBe(laid.length)
  })

  it('reorders within the same shelf — array order wins over stale x', () => {
    const laid = layoutShelf(row.slice().sort((a, b) => a.x - b.x), skuIndex)
    const last = laid[laid.length - 1]
    const moved = placeFacing(scenario.planogram.facings, skuIndex, last.id, shelf.id, 0)
    const newRow = moved
      .filter((f) => f.shelfId === shelf.id)
      .sort((a, b) => a.x - b.x)
    expect(newRow[0].id).toBe(last.id)
    expect(newRow[0].x).toBe(0)
  })

  it('keeps the row contiguous after a reorder', () => {
    const laid = layoutShelf(row.slice().sort((a, b) => a.x - b.x), skuIndex)
    const moved = placeFacing(scenario.planogram.facings, skuIndex, laid[0].id, shelf.id, 3)
    let cursor = 0
    for (const facing of moved.filter((f) => f.shelfId === shelf.id).sort((a, b) => a.x - b.x)) {
      expect(facing.x).toBe(cursor)
      cursor += facingFootprint(facing, skuIndex.get(facing.skuId)!).width
    }
  })

  it('moves a facing between shelves and keeps both rows tidy', () => {
    const [target] = scenario.fixture.shelves.slice(1)
    const moved = placeFacing(scenario.planogram.facings, skuIndex, row[0].id, target.id, 0)
    const movedFacing = moved.find((f) => f.id === row[0].id)!
    expect(movedFacing.shelfId).toBe(target.id)
    expect(movedFacing.x).toBe(0)
    expect(moved).toHaveLength(scenario.planogram.facings.length)
  })
})

describe('metrics', () => {
  it('derives capacity and days of supply from the facing box', () => {
    const facing: Facing = {
      id: 'f',
      skuId: scenario.skus[0].id,
      shelfId: 's',
      x: 0,
      wide: 3,
      high: 2,
      deep: 4,
      orientation: 'front',
    }
    const sku = { ...scenario.skus[0], unitsPerDay: 12 }
    const stats = facingStats(facing, sku)
    expect(stats.capacity).toBe(24)
    expect(stats.dos).toBeCloseTo(2)
  })

  it('caps service level at full availability once a week is covered', () => {
    expect(serviceLevel(TARGET_DOS)).toBe(1)
    expect(serviceLevel(TARGET_DOS * 3)).toBe(1)
    expect(serviceLevel(0)).toBeLessThan(1)
  })

  it('aggregates totals consistently with the facing list', () => {
    const stats = planogramStats(scenario.fixture, scenario.planogram.facings, skuIndex)
    expect(stats.totals.facingCount).toBe(scenario.planogram.facings.length)
    expect(stats.totals.fillRate).toBeGreaterThan(0)
    expect(stats.totals.fillRate).toBeLessThanOrEqual(1)
    expect(stats.totals.salesPerLinearM).toBeGreaterThan(0)
  })
})

describe('autofacing', () => {
  const result = computeAutofacing(
    scenario.fixture,
    scenario.planogram.facings,
    skuIndex,
    DEFAULT_AUTOFACING,
  )

  it('assigns a target to every facing', () => {
    expect(result.targets.size).toBe(scenario.planogram.facings.length)
  })

  it('respects the facing bounds', () => {
    for (const target of result.targets.values()) {
      expect(target).toBeLessThanOrEqual(DEFAULT_AUTOFACING.maxFacings)
      expect(target).toBeGreaterThanOrEqual(0)
    }
  })

  it('never exceeds the usable shelf width', () => {
    const applied = applyTargets(scenario.fixture, scenario.planogram.facings, skuIndex, result.targets)
    for (const shelf of scenario.fixture.shelves) {
      const report = shelfReport(shelf, scenario.fixture, applied, skuIndex)
      expect(report.overflow).toBe(0)
    }
  })

  it('leaves pinned facings untouched', () => {
    const pinned = scenario.planogram.facings.map((f, i) => (i === 0 ? { ...f, pinned: true } : f))
    const pinnedResult = computeAutofacing(scenario.fixture, pinned, skuIndex, DEFAULT_AUTOFACING)
    expect(pinnedResult.targets.get(pinned[0].id)).toBe(pinned[0].wide)
  })

  it('improves realized margin over the hand-built planogram', () => {
    const before = planogramStats(scenario.fixture, scenario.planogram.facings, skuIndex)
    const applied = applyTargets(scenario.fixture, scenario.planogram.facings, skuIndex, result.targets)
    const after = planogramStats(scenario.fixture, applied, skuIndex)
    expect(after.totals.marginPerDay).toBeGreaterThan(before.totals.marginPerDay)
  })

  it('follows demand more closely as aggressiveness rises', () => {
    const flat = computeAutofacing(scenario.fixture, scenario.planogram.facings, skuIndex, {
      ...DEFAULT_AUTOFACING,
      aggressiveness: 0,
    })
    const sharp = computeAutofacing(scenario.fixture, scenario.planogram.facings, skuIndex, {
      ...DEFAULT_AUTOFACING,
      aggressiveness: 1,
    })
    const spread = (targets: Map<string, number>) => {
      const values = [...targets.values()]
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
    }
    expect(spread(sharp.targets)).toBeGreaterThan(spread(flat.targets))
  })
})

describe('fixture presets', () => {
  it('generates every preset without overflow', () => {
    for (const fixtureType of ['gondola', 'wall', 'endcap', 'cooler'] as const) {
      const options = { ...DEFAULT_OPTIONS, fixtureType }
      const fixture = buildFixture(options)
      const skus = generateSkus(options)
      expect(fixture.shelves.length).toBeGreaterThan(2)
      expect(skus).toHaveLength(options.skuCount)
    }
  })
})

describe('colours', () => {
  it('emits hsl in the comma form three.js can parse', () => {
    // THREE.Color rejects the modern space-separated CSS syntax, and the 2D
    // canvas and the 3D scene must be fed the exact same string.
    expect(packagingColor(scenario.skus[0])).toMatch(/^hsl\(\d+(\.\d+)?, \d+%, \d+%\)$/)
  })

  it('picks readable text for light and dark fills', () => {
    expect(readableText('#eab308')).toContain('9,14,22')
    expect(readableText('#1e3a8a')).toContain('255,255,255')
    expect(readableText('hsl(210, 62%, 88%)')).toContain('9,14,22')
  })

  it('spreads a skewed metric across the ramp instead of bunching it', () => {
    const stats = planogramStats(scenario.fixture, scenario.planogram.facings, skuIndex)
    const scale = buildScale('margin', stats.perFacing.values())
    const colours = new Set(
      scenario.planogram.facings.map((facing) =>
        colorFor(skuIndex.get(facing.skuId)!, facing, stats.perFacing.get(facing.id), scale),
      ),
    )
    expect(colours.size).toBeGreaterThan(scenario.planogram.facings.length / 3)
  })
})
