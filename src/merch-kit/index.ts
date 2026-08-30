/**
 * merch-kit — the portable 2D/3D merchandising canvases.
 *
 * Three entry points, on purpose:
 *
 *   `merch-kit`              headless: model, geometry, KPIs, colours, theme
 *   `merch-kit/planogram2d`  the Konva front-elevation editor
 *   `merch-kit/planogram3d`  the three.js bay
 *
 * The renderers are kept out of this barrel so that importing the domain does
 * not drag Konva and three.js in with it. That is what lets a host lazy-load
 * the 3D view — a single static re-export here would silently pull three.js
 * into the main bundle and defeat the code split.
 *
 * Nothing in this folder imports from the demo app, from a state library or
 * from a CSS framework. See README.md for the integration walkthrough.
 */

export type { FacingMove, PlanogramViewProps, SkuDrop } from './types'

// Theming
export { defaultTheme, resolveTheme, type DeepPartial, type PlanogramTheme } from './theme'

// Domain model — the shape the views expect
export {
  byId,
  facingCapacity,
  facingFootprint,
  type AbcClass,
  type CategoryKey,
  type Facing,
  type Fixture,
  type FixtureType,
  type Orientation,
  type Planogram,
  type Scenario,
  type Shelf,
  type ShelfType,
  type Sku,
} from './model'

// Shelf geometry — everything needed to mutate a planogram consistently
export {
  insertIndexAt,
  layoutAll,
  layoutShelf,
  maxDeep,
  maxHigh,
  nearestShelf,
  placeFacing,
  shelfAtHeight,
  shelfIssues,
  shelfReport,
  type ShelfIssues,
  type ShelfReport,
} from './packing'

// KPIs
export {
  facingStats,
  planogramStats,
  serviceLevel,
  OVERSTOCK_DOS,
  STOCKOUT_DOS,
  TARGET_DOS,
  type FacingStats,
  type PlanogramStats,
  type PlanogramTotals,
} from './metrics'

// Visual encoding, shared by both renderers
export {
  ABC_COLORS,
  METRICS,
  buildScale,
  colorFor,
  labelColor,
  packagingColor,
  rampColor,
  readableText,
  type MetricKey,
  type MetricScale,
} from './colors'
