/**
 * Public props for the planogram views.
 *
 * Both renderers are controlled components: state goes in as props, intent
 * comes out as callbacks. Neither knows anything about the host's state
 * management, styling or data layer.
 */

import type { CSSProperties } from 'react'

import type { MetricKey } from './colors'
import type { FacingStats } from './metrics'
import type { Facing, Fixture, Sku } from './model'
import type { DeepPartial, PlanogramTheme } from './theme'

/** A facing dropped onto `shelfId`, `x` millimetres from the left edge. */
export type FacingMove = { facingId: string; shelfId: string; x: number }

/** A catalogue SKU dropped onto the fixture from outside the canvas. */
export type SkuDrop = { skuId: string; shelfId: string; x: number }

export type PlanogramViewProps = {
  fixture: Fixture
  facings: Facing[]
  /** The catalogue, as a list or a prebuilt id index. */
  skus: readonly Sku[] | Map<string, Sku>

  /** Which metric drives facing colour. Defaults to `'none'` (packaging). */
  metric?: MetricKey
  selectedFacingId?: string | null
  /** Pending facing-count targets, keyed by facing id, drawn as ghosts. */
  preview?: ReadonlyMap<string, number> | null

  theme?: DeepPartial<PlanogramTheme>
  /**
   * Escape hatch for hosts with their own analytics: return a CSS colour and
   * the built-in metric ramp is bypassed entirely.
   */
  getFacingColor?: (sku: Sku, facing: Facing, stats: FacingStats | undefined) => string

  onSelect?: (facingId: string | null) => void

  /** Built-in zoom / camera controls. Turn off to supply your own. */
  controls?: boolean
  /** Bottom-corner interaction hints. */
  hints?: boolean

  className?: string
  style?: CSSProperties
}
