import { useState } from 'react'
import { Boxes, LayoutGrid, Camera, Sparkles } from 'lucide-react'

import ShelfSpaceDemo from '@/demo/shelf-space/ShelfSpaceDemo'
import { cx } from '@/demo/ui/primitives'

type DemoKey = 'shelf-space' | 'store-layout' | 'compliance' | 'auto-planogram'

const DEMOS: { key: DemoKey; label: string; caption: string; icon: typeof Boxes; ready: boolean }[] = [
  {
    key: 'shelf-space',
    label: 'Shelf Space',
    caption: 'Micro space · planogram',
    icon: Boxes,
    ready: true,
  },
  {
    key: 'store-layout',
    label: 'Store Layout',
    caption: 'Macro space · floor plan',
    icon: LayoutGrid,
    ready: false,
  },
  {
    key: 'auto-planogram',
    label: 'Auto Planogram',
    caption: 'Batch generation',
    icon: Sparkles,
    ready: false,
  },
  {
    key: 'compliance',
    label: 'Compliance AI',
    caption: 'Realogram vs planogram',
    icon: Camera,
    ready: false,
  },
]

export default function App() {
  const [demo, setDemo] = useState<DemoKey>('shelf-space')

  return (
    <div className="flex h-full w-full overflow-hidden bg-ink-950">
      <nav className="flex w-52 shrink-0 flex-col gap-1 border-r border-ink-800 bg-ink-900/50 p-3">
        <div className="mb-4 px-1">
          <div className="text-sm font-semibold tracking-tight text-slate-100">
            LEAFIO<span className="text-leaf-400">·</span>POC
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            Merchandising demos
          </div>
        </div>

        {DEMOS.map((item) => {
          const Icon = item.icon
          const active = demo === item.key
          return (
            <button
              key={item.key}
              type="button"
              disabled={!item.ready}
              onClick={() => setDemo(item.key)}
              className={cx(
                'group flex items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors',
                !item.ready && 'cursor-not-allowed opacity-40',
                active ? 'bg-ink-800 text-slate-100' : 'text-slate-400 hover:bg-ink-850',
              )}
            >
              <Icon
                size={15}
                className={cx('mt-0.5 shrink-0', active ? 'text-leaf-400' : 'text-slate-500')}
              />
              <span className="min-w-0">
                <span className="block text-xs font-medium">{item.label}</span>
                <span className="block truncate text-[10px] text-slate-500">{item.caption}</span>
              </span>
            </button>
          )
        })}

        <div className="mt-auto px-1 text-[10px] leading-relaxed text-slate-600">
          Fake data, generated from a seed. No backend, nothing persisted.
        </div>
      </nav>

      <main className="min-w-0 flex-1">
        {demo === 'shelf-space' && <ShelfSpaceDemo />}
      </main>
    </div>
  )
}
