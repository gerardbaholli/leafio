/**
 * KPI maths for a planogram. Everything derives from the same facing list the
 * canvases render, so numbers and pixels can never disagree.
 */

import { facingCapacity, facingFootprint, type Facing, type Fixture, type Sku } from './model'
import { shelfReport, type ShelfReport } from './packing'

export type FacingStats = {
  facingId: string
  skuId: string
  /** Units held when fully stocked. */
  capacity: number
  /** Days of supply at average demand. */
  dos: number
  /** Linear millimetres of shelf occupied. */
  linearMm: number
  unitsPerDay: number
  /** Demand at full availability. */
  salesPerDay: number
  marginPerDay: number
  /** 0..1 share of demand actually captured given the facing capacity. */
  serviceLevel: number
  realizedSalesPerDay: number
  realizedMarginPerDay: number
  lostSalesPerDay: number
  /** Gross margin return on shelf space, EUR per linear metre per year. */
  gmros: number
}

export const STOCKOUT_DOS = 2
export const OVERSTOCK_DOS = 21
/** Days of supply below which a facing starts losing sales to empty shelf. */
export const TARGET_DOS = 7
/** Worst-case share of demand still captured by a badly under-faced SKU. */
const MIN_SERVICE = 0.5

/**
 * Simple availability model: a facing that cannot hold a week of demand runs
 * empty between replenishments and forfeits part of it. This is what turns
 * autofacing into a measurable KPI change rather than a cosmetic reshuffle.
 */
export function serviceLevel(dos: number): number {
  if (!Number.isFinite(dos)) return 1
  return Math.min(1, Math.max(MIN_SERVICE, dos / TARGET_DOS))
}

export function facingStats(facing: Facing, sku: Sku): FacingStats {
  const capacity = facingCapacity(facing)
  const linearMm = facingFootprint(facing, sku).width
  const salesPerDay = sku.unitsPerDay * sku.price
  const marginPerDay = sku.unitsPerDay * (sku.price - sku.cost)
  const linearM = linearMm / 1000
  const dos = sku.unitsPerDay > 0 ? capacity / sku.unitsPerDay : Infinity
  const service = serviceLevel(dos)
  const realizedMarginPerDay = marginPerDay * service

  return {
    facingId: facing.id,
    skuId: sku.id,
    capacity,
    dos,
    linearMm,
    unitsPerDay: sku.unitsPerDay,
    salesPerDay,
    marginPerDay,
    serviceLevel: service,
    realizedSalesPerDay: salesPerDay * service,
    realizedMarginPerDay,
    lostSalesPerDay: salesPerDay * (1 - service),
    gmros: linearM > 0 ? (realizedMarginPerDay * 365) / linearM : 0,
  }
}

export type PlanogramTotals = {
  facingCount: number
  skuCount: number
  usedLinearMm: number
  totalLinearMm: number
  fillRate: number
  salesPerDay: number
  marginPerDay: number
  lostSalesPerDay: number
  salesPerLinearM: number
  marginPerLinearM: number
  avgDos: number
  stockoutRisk: number
  overstocked: number
  overflowShelves: number
  fitIssues: number
}

export type PlanogramStats = {
  perFacing: Map<string, FacingStats>
  perShelf: ShelfReport[]
  totals: PlanogramTotals
}

export function planogramStats(
  fixture: Fixture,
  facings: Facing[],
  skus: Map<string, Sku>,
): PlanogramStats {
  const perFacing = new Map<string, FacingStats>()
  const seenSkus = new Set<string>()

  let usedLinearMm = 0
  let salesPerDay = 0
  let marginPerDay = 0
  let lostSalesPerDay = 0
  let dosSum = 0
  let dosCount = 0
  let stockoutRisk = 0
  let overstocked = 0

  for (const facing of facings) {
    const sku = skus.get(facing.skuId)
    if (!sku) continue
    const stats = facingStats(facing, sku)
    perFacing.set(facing.id, stats)
    seenSkus.add(sku.id)

    usedLinearMm += stats.linearMm
    salesPerDay += stats.realizedSalesPerDay
    marginPerDay += stats.realizedMarginPerDay
    lostSalesPerDay += stats.lostSalesPerDay
    if (Number.isFinite(stats.dos)) {
      dosSum += stats.dos
      dosCount++
      if (stats.dos < STOCKOUT_DOS) stockoutRisk++
      if (stats.dos > OVERSTOCK_DOS) overstocked++
    }
  }

  const perShelf = fixture.shelves.map((shelf) => shelfReport(shelf, fixture, facings, skus))
  const totalLinearMm = fixture.w * fixture.shelves.length
  const usedLinearM = usedLinearMm / 1000

  return {
    perFacing,
    perShelf,
    totals: {
      facingCount: facings.length,
      skuCount: seenSkus.size,
      usedLinearMm,
      totalLinearMm,
      fillRate: totalLinearMm > 0 ? usedLinearMm / totalLinearMm : 0,
      salesPerDay,
      marginPerDay,
      lostSalesPerDay,
      salesPerLinearM: usedLinearM > 0 ? salesPerDay / usedLinearM : 0,
      marginPerLinearM: usedLinearM > 0 ? marginPerDay / usedLinearM : 0,
      avgDos: dosCount > 0 ? dosSum / dosCount : 0,
      stockoutRisk,
      overstocked,
      overflowShelves: perShelf.filter((s) => s.overflow > 0).length,
      fitIssues: perShelf.reduce((sum, s) => sum + s.tooTall.length + s.tooDeep.length, 0),
    },
  }
}
