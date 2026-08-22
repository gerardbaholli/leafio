/**
 * Space-aware facing allocation — the "AI" step of the demo.
 *
 * Greedy marginal allocation: every SKU starts at the minimum, then the next
 * facing repeatedly goes to whichever SKU has the highest weight per unit of
 * shelf space it would consume. That is space-aware proportional allocation,
 * deterministic and easy to explain on screen.
 */

import { layoutShelf } from './packing'
import { facingFootprint, type Facing, type Fixture, type Sku } from './model'
import { facingStats, TARGET_DOS } from './metrics'

export type Objective = 'sales' | 'margin' | 'units' | 'dos'

export type AutofacingOptions = {
  objective: Objective
  /** 0 = flat allocation, 1 = strictly follow demand. */
  aggressiveness: number
  minFacings: number
  maxFacings: number
  respectPinned: boolean
}

export const DEFAULT_AUTOFACING: AutofacingOptions = {
  objective: 'margin',
  aggressiveness: 0.6,
  minFacings: 1,
  maxFacings: 8,
  respectPinned: true,
}

export type FacingChange = {
  facingId: string
  skuId: string
  skuName: string
  shelfId: string
  from: number
  to: number
  delta: number
  /** Daily realized margin gained (or lost) by the change. */
  marginDelta: number
}

export type AutofacingResult = {
  targets: Map<string, number>
  changes: FacingChange[]
}

function baseWeight(objective: Objective, sku: Sku): number {
  switch (objective) {
    case 'sales':
      return sku.unitsPerDay * sku.price
    case 'margin':
      return sku.unitsPerDay * (sku.price - sku.cost)
    default:
      return sku.unitsPerDay
  }
}

export function computeAutofacing(
  fixture: Fixture,
  facings: Facing[],
  skus: Map<string, Sku>,
  options: AutofacingOptions = DEFAULT_AUTOFACING,
): AutofacingResult {
  const exponent = 0.25 + options.aggressiveness * 1.25
  const targets = new Map<string, number>()
  const changes: FacingChange[] = []

  for (const shelf of fixture.shelves) {
    const row = facings.filter((f) => f.shelfId === shelf.id)
    if (row.length === 0) continue

    type Slot = { facing: Facing; sku: Sku; unitW: number; weight: number; wide: number; locked: boolean }

    const slots: Slot[] = []
    for (const facing of row) {
      const sku = skus.get(facing.skuId)
      if (!sku) continue
      const locked = options.respectPinned && facing.pinned === true
      const unitW = facingFootprint({ ...facing, wide: 1 }, sku).width
      slots.push({
        facing,
        sku,
        unitW,
        weight: Math.pow(Math.max(baseWeight(options.objective, sku), 0.001), exponent),
        wide: locked ? facing.wide : options.minFacings,
        locked,
      })
    }
    if (slots.length === 0) continue

    let used = slots.reduce((sum, slot) => sum + slot.wide * slot.unitW, 0)

    // Shelf cannot even hold one facing each: trim the weakest until it fits.
    while (used > fixture.w && slots.some((s) => !s.locked && s.wide > 0)) {
      const weakest = slots
        .filter((s) => !s.locked && s.wide > 0)
        .sort((a, b) => a.weight - b.weight)[0]
      weakest.wide -= 1
      used -= weakest.unitW
    }

    // Hand out remaining space one facing at a time.
    for (;;) {
      let best: Slot | undefined
      let bestPriority = -Infinity

      for (const slot of slots) {
        if (slot.locked || slot.wide >= options.maxFacings) continue
        if (used + slot.unitW > fixture.w) continue
        // Days-of-supply objective stops rewarding an SKU once it is covered.
        if (options.objective === 'dos') {
          const dos = ((slot.wide + 1) * slot.facing.high * slot.facing.deep) / Math.max(slot.sku.unitsPerDay, 0.001)
          if (dos > TARGET_DOS * 1.5) continue
        }
        const priority = slot.weight / ((slot.wide + 1) * slot.unitW)
        if (priority > bestPriority) {
          bestPriority = priority
          best = slot
        }
      }

      if (!best) break
      best.wide += 1
      used += best.unitW
    }

    for (const slot of slots) {
      targets.set(slot.facing.id, slot.wide)
      if (slot.wide === slot.facing.wide) continue

      const before = facingStats(slot.facing, slot.sku)
      const after = facingStats({ ...slot.facing, wide: slot.wide }, slot.sku)
      changes.push({
        facingId: slot.facing.id,
        skuId: slot.sku.id,
        skuName: slot.sku.name,
        shelfId: shelf.id,
        from: slot.facing.wide,
        to: slot.wide,
        delta: slot.wide - slot.facing.wide,
        marginDelta: after.realizedMarginPerDay - before.realizedMarginPerDay,
      })
    }
  }

  changes.sort((a, b) => Math.abs(b.marginDelta) - Math.abs(a.marginDelta))
  return { targets, changes }
}

/** Apply target facing counts and relayout every affected shelf. */
export function applyTargets(
  fixture: Fixture,
  facings: Facing[],
  skus: Map<string, Sku>,
  targets: Map<string, number>,
): Facing[] {
  const updated = facings
    .map((facing) => {
      const target = targets.get(facing.id)
      return target === undefined || target === facing.wide ? facing : { ...facing, wide: target }
    })
    .filter((facing) => facing.wide > 0)

  return fixture.shelves.flatMap((shelf) =>
    layoutShelf(
      updated.filter((f) => f.shelfId === shelf.id).sort((a, b) => a.x - b.x),
      skus,
    ),
  )
}
