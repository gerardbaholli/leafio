import { describe, expect, it } from 'vitest'

import { buildScale, colorFor, packagingColor, readableText } from '../colors'
import { facingStats, planogramStats, serviceLevel, TARGET_DOS } from '../metrics'
import { byId, facingFootprint, type Facing, type Fixture, type Sku } from '../model'
import { insertIndexAt, layoutShelf, placeFacing, shelfAtHeight, shelfReport } from '../packing'

/**
 * The kit is tested against a fixture built by hand, not against the demo's
 * generator — that is the point of the boundary.
 */

const fixture: Fixture = {
  id: 'f1',
  name: 'Test bay',
  type: 'gondola',
  w: 1000,
  h: 1800,
  d: 500,
  pos: { x: 0, y: 0, rot: 0 },
  shelves: [
    { id: 's0', index: 0, y: 200, gap: 400, depth: 460, thickness: 25, type: 'shelf' },
    { id: 's1', index: 1, y: 700, gap: 300, depth: 460, thickness: 25, type: 'shelf' },
  ],
}

const sku = (id: string, w: number, h: number, unitsPerDay: number, price: number): Sku => ({
  id,
  name: `Brand ${id}`,
  brand: 'Brand',
  category: 'Test',
  ean: '8000000000000',
  dims: { w, h, d: 60 },
  price,
  cost: price * 0.7,
  unitsPerDay,
  abc: 'B',
  hue: 200,
  accent: 20,
})

const skus = [
  sku('a', 100, 200, 10, 2),
  sku('b', 200, 250, 4, 3),
  sku('c', 150, 350, 2, 5),
  sku('d', 120, 180, 8, 1.5),
]
const index = byId(skus)

const facing = (id: string, skuId: string, x: number, wide = 1): Facing => ({
  id,
  skuId,
  shelfId: 's0',
  x,
  wide,
  high: 1,
  deep: 4,
  orientation: 'front',
})

const row = [facing('f0', 'a', 0), facing('f1', 'b', 100), facing('f2', 'c', 300)]

describe('packing', () => {
  it('lays a row out contiguously from the left edge', () => {
    const laid = layoutShelf(row, index)
    expect(laid.map((f) => f.x)).toEqual([0, 100, 300])
  })

  it('recomputes positions when a facing widens', () => {
    const laid = layoutShelf([{ ...row[0], wide: 3 }, row[1], row[2]], index)
    expect(laid.map((f) => f.x)).toEqual([0, 300, 500])
  })

  it('takes array order as row order, ignoring a stale x', () => {
    // A facing spliced into a new slot still carries its old x; re-sorting here
    // would silently undo every same-shelf reorder.
    const laid = layoutShelf([row[2], row[0], row[1]], index)
    expect(laid.map((f) => f.id)).toEqual(['f2', 'f0', 'f1'])
    expect(laid.map((f) => f.x)).toEqual([0, 150, 250])
  })

  it('picks an insertion index from the pointer position', () => {
    const laid = layoutShelf(row, index)
    expect(insertIndexAt(laid, index, -10)).toBe(0)
    expect(insertIndexAt(laid, index, 40)).toBe(0)
    expect(insertIndexAt(laid, index, 60)).toBe(1)
    expect(insertIndexAt(laid, index, 9999)).toBe(3)
  })

  it('moves a facing to the front of its own shelf', () => {
    const moved = placeFacing(layoutShelf(row, index), index, 'f2', 's0', 0)
    expect(moved.sort((a, b) => a.x - b.x).map((f) => f.id)).toEqual(['f2', 'f0', 'f1'])
  })

  it('moves a facing to another shelf', () => {
    const moved = placeFacing(layoutShelf(row, index), index, 'f0', 's1', 0)
    expect(moved.find((f) => f.id === 'f0')!.shelfId).toBe('s1')
    expect(moved).toHaveLength(3)
  })

  it('reports overflow and products that do not fit the clearance', () => {
    const tooWide = [facing('x', 'b', 0, 6)] // 1200 mm on a 1000 mm shelf
    const report = shelfReport(fixture.shelves[0], fixture, tooWide, index)
    expect(report.overflow).toBe(200)

    const tooTall = [{ ...facing('y', 'c', 0), shelfId: 's1' }] // 350 mm under a 300 mm gap
    const tall = shelfReport(fixture.shelves[1], fixture, tooTall, index)
    expect(tall.tooTall).toEqual(['y'])
  })

  it('hit-tests a pointer height to the shelf whose band contains it', () => {
    expect(shelfAtHeight(fixture, 300).id).toBe('s0')
    expect(shelfAtHeight(fixture, 800).id).toBe('s1')
    expect(shelfAtHeight(fixture, 1700).id).toBe('s1')
  })
})

describe('metrics', () => {
  it('derives capacity and days of supply from the facing box', () => {
    const stats = facingStats({ ...facing('f', 'a', 0, 3), high: 2, deep: 4 }, index.get('a')!)
    expect(stats.capacity).toBe(24)
    expect(stats.dos).toBeCloseTo(2.4)
    expect(stats.linearMm).toBe(300)
  })

  it('caps service level once a week of cover is reached', () => {
    expect(serviceLevel(TARGET_DOS)).toBe(1)
    expect(serviceLevel(TARGET_DOS * 3)).toBe(1)
    expect(serviceLevel(1)).toBeLessThan(1)
  })

  it('charges lost sales to facings that run empty', () => {
    const thin = facingStats({ ...facing('f', 'a', 0, 1), deep: 1 }, index.get('a')!)
    expect(thin.lostSalesPerDay).toBeGreaterThan(0)
    expect(thin.realizedSalesPerDay).toBeLessThan(thin.salesPerDay)
  })

  it('aggregates totals consistently with the facing list', () => {
    const stats = planogramStats(fixture, layoutShelf(row, index), index)
    expect(stats.totals.facingCount).toBe(3)
    expect(stats.totals.usedLinearMm).toBe(450)
    expect(stats.totals.fillRate).toBeCloseTo(450 / 2000)
    expect(stats.totals.salesPerLinearM).toBeGreaterThan(0)
  })
})

describe('colours', () => {
  it('emits hsl in the comma form three.js can parse', () => {
    // THREE.Color rejects the modern space-separated CSS syntax, and both
    // renderers are fed the exact same string.
    expect(packagingColor(skus[0])).toMatch(/^hsl\(\d+(\.\d+)?, \d+%, \d+%\)$/)
  })

  it('picks readable text for light and dark fills', () => {
    expect(readableText('#eab308')).toContain('9,14,22')
    expect(readableText('#1e3a8a')).toContain('255,255,255')
    expect(readableText('hsl(210, 62%, 88%)')).toContain('9,14,22')
  })

  it('spreads a skewed metric across the ramp by rank', () => {
    const laid = layoutShelf(row, index)
    const stats = planogramStats(fixture, laid, index)
    const scale = buildScale('sales', stats.perFacing.values())
    const colours = laid.map((f) =>
      colorFor(index.get(f.skuId)!, f, stats.perFacing.get(f.id), scale),
    )
    expect(new Set(colours).size).toBe(laid.length)
  })

  it('falls back to packaging colour when no metric is selected', () => {
    const scale = buildScale('none', [])
    expect(colorFor(skus[0], row[0], undefined, scale)).toBe(packagingColor(skus[0]))
  })
})

describe('geometry helpers', () => {
  it('swaps width and depth when a facing is turned sideways', () => {
    const front = facingFootprint(facing('f', 'a', 0, 2), index.get('a')!)
    const side = facingFootprint({ ...facing('f', 'a', 0, 2), orientation: 'side' }, index.get('a')!)
    expect(front.width).toBe(200)
    expect(side.width).toBe(120)
  })
})
