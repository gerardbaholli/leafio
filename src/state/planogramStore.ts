import { create } from 'zustand'
import { temporal } from 'zundo'
import { useStore } from 'zustand'
import { useMemo } from 'react'

import {
  DEFAULT_AUTOFACING,
  applyTargets,
  computeAutofacing,
  type AutofacingOptions,
  type FacingChange,
} from '@/core/autofacing'
import { DEFAULT_OPTIONS, generateScenario, type GenerateOptions } from '@/core/generate'
import { byId, type Facing, type Fixture, type Sku } from '@/core/model'
import { buildScale, type MetricKey } from '@/core/colors'
import { planogramStats } from '@/core/metrics'
import { insertIndexAt, layoutShelf, maxDeep, maxHigh, placeFacing } from '@/core/packing'

export type ViewMode = '2d' | '3d'

export type PlanogramState = {
  options: GenerateOptions
  fixture: Fixture
  skus: Sku[]
  facings: Facing[]

  view: ViewMode
  metric: MetricKey
  selectedFacingId: string | null
  autofacing: AutofacingOptions
  /** Pending autofacing result awaiting apply, or null. */
  preview: { targets: Map<string, number>; changes: FacingChange[] } | null

  regenerate: (options: Partial<GenerateOptions>) => void
  setView: (view: ViewMode) => void
  setMetric: (metric: MetricKey) => void
  select: (facingId: string | null) => void

  moveFacing: (facingId: string, shelfId: string, xMm: number) => void
  addSkuToShelf: (skuId: string, shelfId: string, xMm: number) => void
  removeFacing: (facingId: string) => void
  bumpWide: (facingId: string, delta: number) => void
  bumpHigh: (facingId: string, delta: number) => void
  nudge: (facingId: string, direction: -1 | 1) => void
  togglePin: (facingId: string) => void

  setAutofacingOptions: (patch: Partial<AutofacingOptions>) => void
  runAutofacing: () => void
  applyPreview: () => void
  clearPreview: () => void
}

const initial = generateScenario(DEFAULT_OPTIONS)

let facingCounter = initial.planogram.facings.length
const nextFacingId = () => `facing-${(facingCounter++).toString().padStart(3, '0')}`

export const usePlanogramStore = create<PlanogramState>()(
  temporal(
    (set, get) => ({
      options: DEFAULT_OPTIONS,
      fixture: initial.fixture,
      skus: initial.skus,
      facings: initial.planogram.facings,

      view: '2d',
      metric: 'none',
      selectedFacingId: null,
      autofacing: DEFAULT_AUTOFACING,
      preview: null,

      regenerate: (patch) => {
        const options = { ...get().options, ...patch }
        const scenario = generateScenario(options)
        facingCounter = scenario.planogram.facings.length
        set({
          options,
          fixture: scenario.fixture,
          skus: scenario.skus,
          facings: scenario.planogram.facings,
          selectedFacingId: null,
          preview: null,
        })
      },

      setView: (view) => set({ view }),
      setMetric: (metric) => set({ metric }),
      select: (selectedFacingId) => set({ selectedFacingId }),

      moveFacing: (facingId, shelfId, xMm) => {
        const { facings, skus } = get()
        const index = byId(skus)
        const row = facings.filter((f) => f.shelfId === shelfId)
        const at = insertIndexAt(row, index, xMm, facingId)
        set({ facings: placeFacing(facings, index, facingId, shelfId, at), preview: null })
      },

      addSkuToShelf: (skuId, shelfId, xMm) => {
        const { facings, skus, fixture } = get()
        const index = byId(skus)
        const sku = index.get(skuId)
        const shelf = fixture.shelves.find((s) => s.id === shelfId)
        if (!sku || !shelf) return

        const facing: Facing = {
          id: nextFacingId(),
          skuId,
          shelfId,
          x: xMm,
          wide: 1,
          high: sku.dims.h * 2 <= shelf.gap && sku.dims.h < 100 ? 2 : 1,
          deep: maxDeep(shelf, sku, 'front'),
          orientation: 'front',
        }

        const row = [...facings.filter((f) => f.shelfId === shelfId), facing]
        const at = insertIndexAt(row, index, xMm, facing.id)
        const reordered = [...row.filter((f) => f.id !== facing.id)]
        reordered.splice(at, 0, facing)

        set({
          facings: [...facings.filter((f) => f.shelfId !== shelfId), ...layoutShelf(reordered, index)],
          selectedFacingId: facing.id,
          preview: null,
        })
      },

      removeFacing: (facingId) => {
        const { facings, skus, selectedFacingId } = get()
        const target = facings.find((f) => f.id === facingId)
        if (!target) return
        const index = byId(skus)
        const rest = facings.filter((f) => f.id !== facingId)
        set({
          facings: [
            ...rest.filter((f) => f.shelfId !== target.shelfId),
            ...layoutShelf(
              rest.filter((f) => f.shelfId === target.shelfId).sort((a, b) => a.x - b.x),
              index,
            ),
          ],
          selectedFacingId: selectedFacingId === facingId ? null : selectedFacingId,
          preview: null,
        })
      },

      bumpWide: (facingId, delta) => {
        const { facings, skus } = get()
        const index = byId(skus)
        const updated = facings.map((f) =>
          f.id === facingId ? { ...f, wide: Math.max(1, Math.min(12, f.wide + delta)) } : f,
        )
        const target = updated.find((f) => f.id === facingId)
        if (!target) return
        set({
          facings: [
            ...updated.filter((f) => f.shelfId !== target.shelfId),
            ...layoutShelf(
              updated.filter((f) => f.shelfId === target.shelfId).sort((a, b) => a.x - b.x),
              index,
            ),
          ],
          preview: null,
        })
      },

      bumpHigh: (facingId, delta) => {
        const { facings, skus, fixture } = get()
        const index = byId(skus)
        set({
          facings: facings.map((f) => {
            if (f.id !== facingId) return f
            const sku = index.get(f.skuId)
            const shelf = fixture.shelves.find((s) => s.id === f.shelfId)
            if (!sku || !shelf) return f
            return { ...f, high: Math.max(1, Math.min(maxHigh(shelf, sku), f.high + delta)) }
          }),
          preview: null,
        })
      },

      nudge: (facingId, direction) => {
        const { facings, skus } = get()
        const target = facings.find((f) => f.id === facingId)
        if (!target) return
        const index = byId(skus)
        const row = facings.filter((f) => f.shelfId === target.shelfId).sort((a, b) => a.x - b.x)
        const at = row.findIndex((f) => f.id === facingId)
        const to = at + direction
        if (to < 0 || to >= row.length) return
        set({ facings: placeFacing(facings, index, facingId, target.shelfId, to), preview: null })
      },

      togglePin: (facingId) =>
        set({
          facings: get().facings.map((f) => (f.id === facingId ? { ...f, pinned: !f.pinned } : f)),
        }),

      setAutofacingOptions: (patch) => {
        set({ autofacing: { ...get().autofacing, ...patch } })
        if (get().preview) get().runAutofacing()
      },

      runAutofacing: () => {
        const { fixture, facings, skus, autofacing } = get()
        set({ preview: computeAutofacing(fixture, facings, byId(skus), autofacing) })
      },

      applyPreview: () => {
        const { fixture, facings, skus, preview } = get()
        if (!preview) return
        set({
          facings: applyTargets(fixture, facings, byId(skus), preview.targets),
          preview: null,
        })
      },

      clearPreview: () => set({ preview: null }),
    }),
    {
      // Only the planogram itself is undoable — view, metric and selection are not.
      partialize: (state) => ({ facings: state.facings }),
      limit: 100,
      equality: (a, b) => a.facings === b.facings,
    },
  ),
)

/** Undo/redo handles, re-rendering only when availability changes. */
export function useTimeTravel() {
  const undo = usePlanogramStore.temporal.getState().undo
  const redo = usePlanogramStore.temporal.getState().redo
  const canUndo = useStore(usePlanogramStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(usePlanogramStore.temporal, (s) => s.futureStates.length > 0)
  return { undo, redo, canUndo, canRedo }
}

export function useSkuIndex() {
  const skus = usePlanogramStore((s) => s.skus)
  return useMemo(() => byId(skus), [skus])
}

export function usePlanogramStats() {
  const fixture = usePlanogramStore((s) => s.fixture)
  const facings = usePlanogramStore((s) => s.facings)
  const skuIndex = useSkuIndex()
  return useMemo(() => planogramStats(fixture, facings, skuIndex), [fixture, facings, skuIndex])
}

export function useMetricScale() {
  const metric = usePlanogramStore((s) => s.metric)
  const stats = usePlanogramStats()
  return useMemo(() => buildScale(metric, stats.perFacing.values()), [metric, stats])
}

/** SKUs from the catalogue that are not on the fixture yet. */
export function useUnplacedSkus() {
  const skus = usePlanogramStore((s) => s.skus)
  const facings = usePlanogramStore((s) => s.facings)
  return useMemo(() => {
    const placed = new Set(facings.map((f) => f.skuId))
    return skus.filter((sku) => !placed.has(sku.id))
  }, [skus, facings])
}

/** Stats for the planogram as it would look after applying the preview. */
export function usePreviewStats() {
  const fixture = usePlanogramStore((s) => s.fixture)
  const facings = usePlanogramStore((s) => s.facings)
  const preview = usePlanogramStore((s) => s.preview)
  const skuIndex = useSkuIndex()
  return useMemo(() => {
    if (!preview) return null
    return planogramStats(fixture, applyTargets(fixture, facings, skuIndex, preview.targets), skuIndex)
  }, [fixture, facings, preview, skuIndex])
}
