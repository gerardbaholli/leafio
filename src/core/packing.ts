/**
 * Shelf layout maths. Pure, framework-free, unit-tested.
 *
 * A planogram shelf is contiguous and left-aligned: facings sit shoulder to
 * shoulder with no gaps, so every mutation (drag, reorder, facing change) is
 * followed by a relayout that recomputes `x` for the whole row.
 */

import { facingFootprint, type Facing, type Fixture, type Shelf, type Sku } from './model'

export type ShelfIssues = {
  /** Millimetres by which the row exceeds the usable width (0 when it fits). */
  overflow: number
  /** Facings taller than the shelf clearance. */
  tooTall: string[]
  /** Facings deeper than the shelf depth. */
  tooDeep: string[]
}

export type ShelfReport = ShelfIssues & {
  shelfId: string
  facings: Facing[]
  usedWidth: number
  freeWidth: number
  /** 0..1 share of the usable width taken by product. */
  fillRate: number
}

/**
 * Reassign `x` so facings are contiguous from the left edge.
 *
 * ARRAY ORDER IS THE ROW ORDER. This must not re-sort by `x`: a facing that has
 * just been spliced into a new position still carries its old `x`, and sorting
 * would silently undo every same-shelf reorder. Callers holding facings in an
 * unknown order sort by `x` themselves before calling in.
 */
export function layoutShelf(facings: Facing[], skus: Map<string, Sku>): Facing[] {
  let cursor = 0
  return facings.map((facing) => {
    const sku = skus.get(facing.skuId)
    if (!sku) return facing
    const placed = facing.x === cursor ? facing : { ...facing, x: cursor }
    cursor += facingFootprint(facing, sku).width
    return placed
  })
}

export function shelfIssues(
  shelf: Shelf,
  fixture: Fixture,
  facings: Facing[],
  skus: Map<string, Sku>,
): ShelfIssues {
  let used = 0
  const tooTall: string[] = []
  const tooDeep: string[] = []

  for (const facing of facings) {
    const sku = skus.get(facing.skuId)
    if (!sku) continue
    const box = facingFootprint(facing, sku)
    used += box.width
    if (box.height > shelf.gap) tooTall.push(facing.id)
    if (box.depth > shelf.depth) tooDeep.push(facing.id)
  }

  return { overflow: Math.max(0, used - fixture.w), tooTall, tooDeep }
}

export function shelfReport(
  shelf: Shelf,
  fixture: Fixture,
  allFacings: Facing[],
  skus: Map<string, Sku>,
): ShelfReport {
  const facings = layoutShelf(
    allFacings.filter((f) => f.shelfId === shelf.id).sort((a, b) => a.x - b.x),
    skus,
  )
  const usedWidth = facings.reduce((sum, facing) => {
    const sku = skus.get(facing.skuId)
    return sku ? sum + facingFootprint(facing, sku).width : sum
  }, 0)

  return {
    shelfId: shelf.id,
    facings,
    usedWidth,
    freeWidth: Math.max(0, fixture.w - usedWidth),
    fillRate: fixture.w > 0 ? usedWidth / fixture.w : 0,
    ...shelfIssues(shelf, fixture, facings, skus),
  }
}

/** Relayout every shelf of a planogram in one pass. */
export function layoutAll(fixture: Fixture, facings: Facing[], skus: Map<string, Sku>): Facing[] {
  return fixture.shelves.flatMap((shelf) =>
    layoutShelf(
      facings.filter((f) => f.shelfId === shelf.id).sort((a, b) => a.x - b.x),
      skus,
    ),
  )
}

/** Shelf whose surface is closest to a pointer height, in mm above the floor. */
export function nearestShelf(fixture: Fixture, yMm: number): Shelf {
  return fixture.shelves.reduce((best, shelf) =>
    Math.abs(shelf.y - yMm) < Math.abs(best.y - yMm) ? shelf : best,
  )
}

/**
 * Where a facing dropped at `xMm` should land in the row order. Uses each
 * neighbour's midpoint so the insertion flips only once the pointer passes
 * half of a block.
 */
export function insertIndexAt(
  rowFacings: Facing[],
  skus: Map<string, Sku>,
  xMm: number,
  ignoreFacingId?: string,
): number {
  const row = rowFacings.filter((f) => f.id !== ignoreFacingId).sort((a, b) => a.x - b.x)
  let cursor = 0
  for (let i = 0; i < row.length; i++) {
    const sku = skus.get(row[i].skuId)
    const width = sku ? facingFootprint(row[i], sku).width : 0
    if (xMm < cursor + width / 2) return i
    cursor += width
  }
  return row.length
}

/** Reinsert `facing` into `shelfId` at `index`, then relayout that shelf. */
export function placeFacing(
  facings: Facing[],
  skus: Map<string, Sku>,
  facingId: string,
  shelfId: string,
  index: number,
): Facing[] {
  const moving = facings.find((f) => f.id === facingId)
  if (!moving) return facings

  const others = facings.filter((f) => f.id !== facingId)
  const target = others.filter((f) => f.shelfId === shelfId).sort((a, b) => a.x - b.x)
  const rest = others.filter((f) => f.shelfId !== shelfId)

  const clamped = Math.max(0, Math.min(index, target.length))
  target.splice(clamped, 0, { ...moving, shelfId })

  return [...rest, ...layoutShelf(target, skus)]
}

/** Packs that fit in depth on a shelf, at least 1. */
export function maxDeep(shelf: Shelf, sku: Sku, orientation: Facing['orientation']): number {
  const unitDepth = orientation === 'front' ? sku.dims.d : sku.dims.w
  return Math.max(1, Math.floor(shelf.depth / unitDepth))
}

/** Packs that can be stacked under the shelf clearance, at least 1. */
export function maxHigh(shelf: Shelf, sku: Sku): number {
  return Math.max(1, Math.floor(shelf.gap / sku.dims.h))
}

/**
 * Shelf that a pointer at `yMm` above the floor belongs to: the one whose
 * usable band contains it, falling back to the closest surface.
 */
export function shelfAtHeight(fixture: Fixture, yMm: number): Shelf {
  const containing = fixture.shelves.find(
    (shelf) => yMm >= shelf.y - shelf.thickness && yMm <= shelf.y + shelf.gap,
  )
  return containing ?? nearestShelf(fixture, yMm)
}
