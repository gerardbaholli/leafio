import { Minus, Pin, Plus, Trash2 } from 'lucide-react'

import { packagingColor } from '@/core/colors'
import { facingFootprint } from '@/core/model'
import { OVERSTOCK_DOS, STOCKOUT_DOS } from '@/core/metrics'
import { usePlanogramStats, usePlanogramStore, useSkuIndex } from '@/state/planogramStore'
import { Badge, IconButton, Panel, fmt } from '@/ui/primitives'

export default function Inspector() {
  const selectedFacingId = usePlanogramStore((s) => s.selectedFacingId)
  const facings = usePlanogramStore((s) => s.facings)
  const fixture = usePlanogramStore((s) => s.fixture)
  const bumpWide = usePlanogramStore((s) => s.bumpWide)
  const bumpHigh = usePlanogramStore((s) => s.bumpHigh)
  const togglePin = usePlanogramStore((s) => s.togglePin)
  const removeFacing = usePlanogramStore((s) => s.removeFacing)

  const skuIndex = useSkuIndex()
  const stats = usePlanogramStats()

  const facing = facings.find((f) => f.id === selectedFacingId)
  const sku = facing && skuIndex.get(facing.skuId)
  const shelf = facing && fixture.shelves.find((s) => s.id === facing.shelfId)

  if (!facing || !sku || !shelf) {
    return (
      <Panel title="Facing" className="shrink-0">
        <p className="p-3 text-xs text-slate-600">
          Select a facing on the canvas to edit it, or drag a SKU from the catalogue onto a shelf.
        </p>
      </Panel>
    )
  }

  const box = facingFootprint(facing, sku)
  const facingStats = stats.perFacing.get(facing.id)
  const dos = facingStats?.dos ?? 0
  const dosTone = dos < STOCKOUT_DOS ? 'bad' : dos > OVERSTOCK_DOS ? 'warn' : 'good'

  return (
    <Panel
      title="Facing"
      className="shrink-0"
      actions={
        <div className="flex gap-1">
          <IconButton
            onClick={() => togglePin(facing.id)}
            title={facing.pinned ? 'Unpin (allow autofacing)' : 'Pin (protect from autofacing)'}
            active={facing.pinned}
          >
            <Pin size={13} />
          </IconButton>
          <IconButton onClick={() => removeFacing(facing.id)} title="Remove from planogram">
            <Trash2 size={13} />
          </IconButton>
        </div>
      }
    >
      <div className="flex items-start gap-2 border-b border-ink-850 p-2">
        <span
          className="h-10 w-6 shrink-0 rounded-sm border border-black/40"
          style={{ background: packagingColor(sku) }}
        />
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-slate-100">{sku.name}</div>
          <div className="tabular text-[10px] text-slate-500">
            {sku.dims.w}×{sku.dims.h}×{sku.dims.d} mm · €{sku.price.toFixed(2)} · margin{' '}
            {fmt.pct((sku.price - sku.cost) / sku.price)}
          </div>
          <div className="mt-1 flex gap-1">
            <Badge tone={sku.abc === 'A' ? 'good' : sku.abc === 'B' ? 'warn' : 'default'}>
              class {sku.abc}
            </Badge>
            <Badge>shelf {shelf.index + 1}</Badge>
            {facing.pinned && <Badge tone="warn">pinned</Badge>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-2">
        <Counter
          label="Facings wide"
          value={facing.wide}
          onDec={() => bumpWide(facing.id, -1)}
          onInc={() => bumpWide(facing.id, 1)}
        />
        <Counter
          label="Stacked high"
          value={facing.high}
          onDec={() => bumpHigh(facing.id, -1)}
          onInc={() => bumpHigh(facing.id, 1)}
        />
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-ink-850 px-2 py-2 text-[11px]">
        <Row label="Occupies" value={fmt.mm(box.width)} />
        <Row label="Deep" value={`${facing.deep} packs`} />
        <Row label="Capacity" value={`${facingStats?.capacity ?? 0} units`} />
        <Row
          label="Days of supply"
          value={Number.isFinite(dos) ? `${dos.toFixed(1)} d` : '—'}
          tone={dosTone}
        />
        <Row label="Demand" value={`${fmt.num(sku.unitsPerDay)} u/day`} />
        <Row label="Margin" value={`€${fmt.num(facingStats?.realizedMarginPerDay ?? 0, 2)}/day`} />
      </dl>

      {box.height > shelf.gap && (
        <p className="border-t border-ink-850 px-2 py-2 text-[11px] text-rose-400">
          Stack is {Math.round(box.height - shelf.gap)} mm taller than the shelf clearance.
        </p>
      )}
    </Panel>
  )
}

function Counter({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string
  value: number
  onDec: () => void
  onInc: () => void
}) {
  return (
    <div className="rounded-md border border-ink-800 bg-ink-850/60 px-2 py-1.5">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="flex items-center justify-between">
        <IconButton onClick={onDec} title={`Decrease ${label}`}>
          <Minus size={13} />
        </IconButton>
        <span className="tabular text-base font-semibold text-slate-100">{value}</span>
        <IconButton onClick={onInc} title={`Increase ${label}`}>
          <Plus size={13} />
        </IconButton>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'good' | 'warn' | 'bad'
}) {
  const toneClass =
    tone === 'bad'
      ? 'text-rose-400'
      : tone === 'warn'
        ? 'text-amber-400'
        : tone === 'good'
          ? 'text-leaf-400'
          : 'text-slate-200'
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className={`tabular text-right font-medium ${toneClass}`}>{value}</dd>
    </>
  )
}
