/**
 * Domain model shared by every demo module.
 *
 * UNITS: all linear dimensions are millimetres, always. Renderers convert at
 * their boundary and nowhere else (2D: mm * scale -> px, 3D: mm / 1000 -> m).
 */

export type AbcClass = 'A' | 'B' | 'C'

export type Sku = {
  id: string
  name: string
  brand: string
  category: string
  ean: string
  /** Packaging dimensions of a single unit, mm. */
  dims: { w: number; h: number; d: number }
  price: number
  cost: number
  /** Average demand, units per day. */
  unitsPerDay: number
  abc: AbcClass
  /** Packaging colour, HSL hue 0-360. Keeps 2D and 3D visually identical. */
  hue: number
  /** Secondary hue used for the label band. */
  accent: number
}

export type ShelfType = 'shelf' | 'peg' | 'basket'

export type Shelf = {
  id: string
  index: number
  /** Height of the shelf surface above the floor, mm. */
  y: number
  /** Usable vertical clearance above the surface, mm. */
  gap: number
  /** Usable depth, mm. */
  depth: number
  /** Board thickness, mm — drawn below `y`. */
  thickness: number
  type: ShelfType
}

export type FixtureType = 'gondola' | 'wall' | 'endcap' | 'cooler'

export type Fixture = {
  id: string
  name: string
  type: FixtureType
  /** Usable shelf width, mm. Uprights are drawn outside this span. */
  w: number
  /** Total height from floor, mm. */
  h: number
  /** Total depth, mm. */
  d: number
  shelves: Shelf[]
  /** Placement on the store floor plan — consumed by the store-layout module. */
  pos: { x: number; y: number; rot: number }
}

export type Orientation = 'front' | 'side'

export type Facing = {
  id: string
  skuId: string
  shelfId: string
  /** Offset of the left edge from the left edge of the usable shelf span, mm. */
  x: number
  /** Number of packs across, stacked, and in depth. */
  wide: number
  high: number
  deep: number
  orientation: Orientation
  /** Excluded from autofacing reallocation. */
  pinned?: boolean
}

export type Planogram = {
  id: string
  fixtureId: string
  facings: Facing[]
}

export type Scenario = {
  seed: number
  category: CategoryKey
  skuCount: number
  fixture: Fixture
  skus: Sku[]
  planogram: Planogram
}

export type CategoryKey = 'beverages' | 'snacks' | 'dairy' | 'homecare'

/** Footprint of a facing on the shelf, mm. Orientation swaps width and depth. */
export function facingFootprint(facing: Facing, sku: Sku) {
  const unitW = facing.orientation === 'front' ? sku.dims.w : sku.dims.d
  const unitD = facing.orientation === 'front' ? sku.dims.d : sku.dims.w
  return {
    width: facing.wide * unitW,
    height: facing.high * sku.dims.h,
    depth: facing.deep * unitD,
    unitW,
    unitD,
  }
}

/** Units held by a facing when fully stocked. */
export function facingCapacity(facing: Facing): number {
  return facing.wide * facing.high * facing.deep
}

export const byId = <T extends { id: string }>(items: T[]): Map<string, T> =>
  new Map(items.map((item) => [item.id, item]))
