import { Suspense, lazy, useMemo } from 'react'

import { Planogram2D } from '@/merch-kit/planogram2d'
import { byId, type FacingMove, type SkuDrop } from '@/merch-kit'
import { usePlanogramStore } from '@/demo/state/planogramStore'

// The 3D view carries three.js; loading it on demand keeps it out of the
// initial bundle. This works because the kit barrel is headless — it does not
// re-export the renderers, so nothing pulls three.js in statically.
const Planogram3D = lazy(() => import('@/merch-kit/planogram3d'))

/**
 * The demo's single point of contact with merch-kit.
 *
 * Everything above this file is app concern (zustand, Tailwind, panels);
 * everything below it is the portable kit. Integrating the kit somewhere else
 * means writing a file like this one against that host's own state — the kit
 * itself does not change.
 */
export default function PlanogramCanvas() {
  const view = usePlanogramStore((s) => s.view)
  const fixture = usePlanogramStore((s) => s.fixture)
  const facings = usePlanogramStore((s) => s.facings)
  const skus = usePlanogramStore((s) => s.skus)
  const metric = usePlanogramStore((s) => s.metric)
  const selectedFacingId = usePlanogramStore((s) => s.selectedFacingId)
  const preview = usePlanogramStore((s) => s.preview)
  const select = usePlanogramStore((s) => s.select)
  const moveFacing = usePlanogramStore((s) => s.moveFacing)
  const addSkuToShelf = usePlanogramStore((s) => s.addSkuToShelf)

  const skuIndex = useMemo(() => byId(skus), [skus])

  // Props both views share, so switching keeps selection, colours and layout.
  const shared = {
    fixture,
    facings,
    skus: skuIndex,
    metric,
    selectedFacingId,
    preview: preview?.targets ?? null,
    onSelect: select,
  }

  if (view === '3d') {
    return (
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-xs text-slate-600">
            Loading 3D scene…
          </div>
        }
      >
        <Planogram3D
          {...shared}
          overlay={
            preview && preview.changes.length > 0 ? (
              <span className="rounded border border-leaf-500/40 bg-leaf-500/10 px-2 py-1 text-[10px] text-leaf-300">
                Autofacing preview · {preview.changes.length} changes — switch to 2D to review the
                diff
              </span>
            ) : undefined
          }
        />
      </Suspense>
    )
  }

  return (
    <Planogram2D
      {...shared}
      onMoveFacing={({ facingId, shelfId, x }: FacingMove) => moveFacing(facingId, shelfId, x)}
      onDropSku={({ skuId, shelfId, x }: SkuDrop) => addSkuToShelf(skuId, shelfId, x)}
      emptyState={
        <span className="rounded border border-ink-800 bg-ink-900/90 px-3 py-2 text-xs text-slate-400">
          Empty fixture — drag SKUs from the catalogue, or run autofacing.
        </span>
      }
    />
  )
}
