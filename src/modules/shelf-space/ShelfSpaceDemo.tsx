import { Suspense, lazy, useEffect } from 'react'

import { usePlanogramStore, useTimeTravel } from '@/state/planogramStore'

import Planogram2D from './canvas2d/Planogram2D'

// three.js is a third of the bundle; only pay for it when the 3D tab is opened.
const Planogram3D = lazy(() => import('./canvas3d/Planogram3D'))
import AnalyticsPanel from './panels/AnalyticsPanel'
import Inspector from './panels/Inspector'
import OptimizePanel from './panels/OptimizePanel'
import SkuLibrary from './panels/SkuLibrary'
import Toolbar from './Toolbar'

export default function ShelfSpaceDemo() {
  useKeyboardShortcuts()
  const view = usePlanogramStore((s) => s.view)

  return (
    <div className="flex h-full flex-col">
      <Toolbar />

      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_320px] gap-2 p-2">
        <SkuLibrary />

        <div className="min-h-0 overflow-hidden rounded-lg border border-ink-800">
          {view === '2d' ? (
            <Planogram2D />
          ) : (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-xs text-slate-600">
                  Loading 3D scene…
                </div>
              }
            >
              <Planogram3D />
            </Suspense>
          )}
        </div>

        <div className="flex min-h-0 flex-col gap-2">
          <AnalyticsPanel />
          <Inspector />
          <OptimizePanel />
        </div>
      </div>
    </div>
  )
}

/** Editor keyboard map. Ignored while typing in an input. */
function useKeyboardShortcuts() {
  const { undo, redo } = useTimeTravel()

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return

      const store = usePlanogramStore.getState()
      const selected = store.selectedFacingId

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        event.shiftKey ? redo() : undo()
        return
      }

      if (!selected) return

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault()
          store.nudge(selected, -1)
          break
        case 'ArrowRight':
          event.preventDefault()
          store.nudge(selected, 1)
          break
        case 'ArrowUp':
          event.preventDefault()
          store.bumpHigh(selected, 1)
          break
        case 'ArrowDown':
          event.preventDefault()
          store.bumpHigh(selected, -1)
          break
        case '+':
        case '=':
          event.preventDefault()
          store.bumpWide(selected, 1)
          break
        case '-':
          event.preventDefault()
          store.bumpWide(selected, -1)
          break
        case 'p':
          store.togglePin(selected)
          break
        case 'Backspace':
        case 'Delete':
          event.preventDefault()
          store.removeFacing(selected)
          break
        case 'Escape':
          store.select(null)
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])
}
