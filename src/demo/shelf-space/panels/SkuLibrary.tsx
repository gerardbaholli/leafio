import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import {
  packagingColor,
  type Sku,
} from '@/merch-kit'
import { usePlanogramStore } from '@/demo/state/planogramStore'
import { Badge, Panel, cx, fmt } from '@/demo/ui/primitives'

/**
 * Catalogue side panel. Rows are HTML5 drag sources; the canvas reads the SKU
 * id off the drag payload and drops a new facing on the shelf under the mouse.
 */
export default function SkuLibrary() {
  const skus = usePlanogramStore((s) => s.skus)
  const facings = usePlanogramStore((s) => s.facings)
  const [query, setQuery] = useState('')
  const [onlyUnplaced, setOnlyUnplaced] = useState(false)

  const placed = useMemo(() => new Set(facings.map((f) => f.skuId)), [facings])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return skus
      .filter((sku) => (onlyUnplaced ? !placed.has(sku.id) : true))
      .filter((sku) => (needle ? sku.name.toLowerCase().includes(needle) : true))
      .sort((a, b) => b.unitsPerDay - a.unitsPerDay)
  }, [skus, query, onlyUnplaced, placed])

  return (
    <Panel
      title={`Catalogue · ${visible.length}`}
      className="h-full"
      actions={
        <button
          type="button"
          onClick={() => setOnlyUnplaced((value) => !value)}
          className={cx(
            'rounded border px-1.5 py-0.5 text-[10px] transition-colors',
            onlyUnplaced
              ? 'border-leaf-500/40 bg-leaf-500/10 text-leaf-300'
              : 'border-ink-700 text-slate-500 hover:text-slate-300',
          )}
        >
          unplaced only
        </button>
      }
    >
      <div className="sticky top-0 z-10 border-b border-ink-800 bg-ink-900/95 p-2 backdrop-blur">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name…"
            className="w-full rounded border border-ink-800 bg-ink-950 py-1.5 pl-7 pr-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-ink-600"
          />
        </div>
      </div>

      <ul className="divide-y divide-ink-850">
        {visible.map((sku) => (
          <SkuRow key={sku.id} sku={sku} placed={placed.has(sku.id)} />
        ))}
        {visible.length === 0 && (
          <li className="p-4 text-center text-xs text-slate-600">No SKU matches.</li>
        )}
      </ul>
    </Panel>
  )
}

function SkuRow({ sku, placed }: { sku: Sku; placed: boolean }) {
  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('application/x-sku', sku.id)
        event.dataTransfer.effectAllowed = 'copy'
      }}
      className={cx(
        'flex cursor-grab items-start gap-2 px-2 py-1.5 transition-colors hover:bg-ink-850 active:cursor-grabbing',
        placed && 'opacity-55',
      )}
      title={`${sku.name}\n${sku.dims.w}×${sku.dims.h}×${sku.dims.d} mm · EAN ${sku.ean}`}
    >
      <span
        className="mt-0.5 h-7 w-4 shrink-0 rounded-sm border border-black/40"
        style={{ background: packagingColor(sku) }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium text-slate-200">{sku.name}</span>
        <span className="tabular flex items-center gap-1.5 text-[10px] text-slate-500">
          <span>€{sku.price.toFixed(2)}</span>
          <span>·</span>
          <span>{fmt.num(sku.unitsPerDay)} u/d</span>
          <span>·</span>
          <span>
            {sku.dims.w}×{sku.dims.h}
          </span>
        </span>
      </span>
      <Badge tone={sku.abc === 'A' ? 'good' : sku.abc === 'B' ? 'warn' : 'default'}>{sku.abc}</Badge>
    </li>
  )
}
