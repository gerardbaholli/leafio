import { describe, expect, it } from 'vitest'

import { byId, planogramStats, shelfReport } from '@/merch-kit'
import { DEFAULT_AUTOFACING, applyTargets, computeAutofacing } from '@/demo/autofacing'
import { DEFAULT_OPTIONS, buildFixture, generateScenario, generateSkus } from '@/demo/data/generate'
import { mulberry32, paretoWeight } from '@/demo/data/rng'

/**
 * Demo-side domain tests: the fake-data generator and the autofacing algorithm.
 * The canvases and the shelf geometry they rely on are tested separately, and
 * standalone, under `src/merch-kit/__tests__`.
 */

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

  it('generates every fixture preset', () => {
    for (const fixtureType of ['gondola', 'wall', 'endcap', 'cooler'] as const) {
      const options = { ...DEFAULT_OPTIONS, fixtureType }
      expect(buildFixture(options).shelves.length).toBeGreaterThan(2)
      expect(generateSkus(options)).toHaveLength(options.skuCount)
    }
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
    const applied = applyTargets(
      scenario.fixture,
      scenario.planogram.facings,
      skuIndex,
      result.targets,
    )
    for (const shelf of scenario.fixture.shelves) {
      expect(shelfReport(shelf, scenario.fixture, applied, skuIndex).overflow).toBe(0)
    }
  })

  it('leaves pinned facings untouched', () => {
    const pinned = scenario.planogram.facings.map((f, i) => (i === 0 ? { ...f, pinned: true } : f))
    const pinnedResult = computeAutofacing(scenario.fixture, pinned, skuIndex, DEFAULT_AUTOFACING)
    expect(pinnedResult.targets.get(pinned[0].id)).toBe(pinned[0].wide)
  })

  it('improves realized margin over the hand-built planogram', () => {
    const before = planogramStats(scenario.fixture, scenario.planogram.facings, skuIndex)
    const applied = applyTargets(
      scenario.fixture,
      scenario.planogram.facings,
      skuIndex,
      result.targets,
    )
    const after = planogramStats(scenario.fixture, applied, skuIndex)
    expect(after.totals.marginPerDay).toBeGreaterThan(before.totals.marginPerDay)
  })

  it('follows demand more closely as aggressiveness rises', () => {
    const spread = (targets: Map<string, number>) => {
      const values = [...targets.values()]
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
    }
    const flat = computeAutofacing(scenario.fixture, scenario.planogram.facings, skuIndex, {
      ...DEFAULT_AUTOFACING,
      aggressiveness: 0,
    })
    const sharp = computeAutofacing(scenario.fixture, scenario.planogram.facings, skuIndex, {
      ...DEFAULT_AUTOFACING,
      aggressiveness: 1,
    })
    expect(spread(sharp.targets)).toBeGreaterThan(spread(flat.targets))
  })
})
