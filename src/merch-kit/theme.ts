/**
 * Every colour the canvases draw comes from here.
 *
 * Nothing inside the kit hardcodes a colour or depends on a CSS framework, so
 * dropping it into a host application is a matter of passing a theme — not
 * hunting hex codes through the render code.
 */

export type PlanogramTheme = {
  /** Canvas backdrop. */
  background: string
  /** Floating controls and tooltips. */
  surface: string
  surfaceBorder: string
  text: string
  textMuted: string
  textFaint: string
  /** Selection, snap guides, positive deltas. */
  accent: string
  warning: string
  danger: string
  pin: string
  increase: string
  decrease: string

  fixture: {
    /** Outer body around the usable span. */
    frame: string
    frameEdge: string
    /** Panel behind the products. */
    back: string
    upright: string
    plinth: string
    shelfBoard: string
    shelfEdge: string
    /** Track behind the per-shelf fill bar. */
    shelfTrack: string
    fillBar: string
    floorLine: string
  }

  facing: {
    stroke: string
    /** Lines between individual packs. */
    divider: string
    /** Translucent band standing in for the printed label. */
    labelBand: string
  }

  /** 3D only. */
  scene: {
    floor: string
    grid: string
    gridSection: string
    fogNear: number
    fogFar: number
  }
}

export const defaultTheme: PlanogramTheme = {
  background: '#070b12',
  surface: 'rgba(13,20,32,0.92)',
  surfaceBorder: '#24334a',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textFaint: '#475569',
  accent: '#4ade80',
  warning: '#f59e0b',
  danger: '#f43f5e',
  pin: '#fbbf24',
  increase: '#4ade80',
  decrease: '#f97316',

  fixture: {
    frame: '#111a27',
    frameEdge: '#1f2c3f',
    back: '#0e1621',
    upright: '#243248',
    plinth: '#24324a',
    shelfBoard: '#3b4a63',
    shelfEdge: '#4d5f7d',
    shelfTrack: '#182334',
    fillBar: '#22c55e',
    floorLine: '#334155',
  },

  facing: {
    stroke: 'rgba(0,0,0,0.35)',
    divider: 'rgba(0,0,0,0.28)',
    labelBand: 'rgba(255,255,255,0.14)',
  },

  scene: {
    floor: '#0b1119',
    grid: '#16202f',
    gridSection: '#1f2d42',
    fogNear: 4,
    fogFar: 12,
  },
}

/** Merge a partial override onto the defaults, one level deep per section. */
export function resolveTheme(override?: DeepPartial<PlanogramTheme>): PlanogramTheme {
  if (!override) return defaultTheme
  return {
    ...defaultTheme,
    ...override,
    fixture: { ...defaultTheme.fixture, ...override.fixture },
    facing: { ...defaultTheme.facing, ...override.facing },
    scene: { ...defaultTheme.scene, ...override.scene },
  } as PlanogramTheme
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K]
}
