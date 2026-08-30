import { Check, Sparkles, X } from 'lucide-react'

import type { Objective } from '@/demo/autofacing'
import { usePlanogramStore, usePreviewStats, usePlanogramStats } from '@/demo/state/planogramStore'
import { Field, Panel, Segmented, Slider, cx, fmt } from '@/demo/ui/primitives'

const OBJECTIVES: { value: Objective; label: string; title: string }[] = [
  { value: 'margin', label: 'Margin', title: 'Give space to the most profitable demand' },
  { value: 'sales', label: 'Sales', title: 'Give space to revenue' },
  { value: 'units', label: 'Units', title: 'Give space to volume' },
  { value: 'dos', label: 'Cover', title: 'Equalise days of supply, stop once a week is covered' },
]

export default function OptimizePanel() {
  const options = usePlanogramStore((s) => s.autofacing)
  const preview = usePlanogramStore((s) => s.preview)
  const setOptions = usePlanogramStore((s) => s.setAutofacingOptions)
  const run = usePlanogramStore((s) => s.runAutofacing)
  const apply = usePlanogramStore((s) => s.applyPreview)
  const clear = usePlanogramStore((s) => s.clearPreview)
  const select = usePlanogramStore((s) => s.select)

  const stats = usePlanogramStats()
  const previewStats = usePreviewStats()

  const marginDelta = previewStats
    ? previewStats.totals.marginPerDay - stats.totals.marginPerDay
    : 0

  return (
    <Panel
      title="Autofacing"
      className="min-h-0 flex-1"
      actions={
        preview ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={apply}
              className="inline-flex items-center gap-1 rounded border border-leaf-500/50 bg-leaf-500/15 px-2 py-0.5 text-[10px] font-medium text-leaf-300 hover:bg-leaf-500/25"
            >
              <Check size={11} /> Apply
            </button>
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 rounded border border-ink-700 px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200"
            >
              <X size={11} /> Discard
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={run}
            className="inline-flex items-center gap-1 rounded border border-leaf-500/50 bg-leaf-500/15 px-2 py-0.5 text-[10px] font-medium text-leaf-300 hover:bg-leaf-500/25"
          >
            <Sparkles size={11} /> Optimise
          </button>
        )
      }
    >
      <div className="space-y-2.5 border-b border-ink-850 p-2">
        <Field label="Objective">
          <Segmented
            size="sm"
            value={options.objective}
            options={OBJECTIVES}
            onChange={(objective) => setOptions({ objective })}
          />
        </Field>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
            <span>Aggressiveness</span>
            <span className="tabular text-slate-500">
              {options.aggressiveness < 0.33
                ? 'flat'
                : options.aggressiveness < 0.7
                  ? 'balanced'
                  : 'demand-led'}
            </span>
          </div>
          <Slider
            value={options.aggressiveness}
            min={0}
            max={1}
            step={0.05}
            onChange={(aggressiveness) => setOptions({ aggressiveness })}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Min">
            <input
              type="number"
              min={0}
              max={4}
              value={options.minFacings}
              onChange={(event) => setOptions({ minFacings: Number(event.target.value) })}
              className="tabular w-14 rounded border border-ink-800 bg-ink-950 px-1.5 py-0.5 text-right text-xs text-slate-200 outline-none focus:border-ink-600"
            />
          </Field>
          <Field label="Max">
            <input
              type="number"
              min={1}
              max={16}
              value={options.maxFacings}
              onChange={(event) => setOptions({ maxFacings: Number(event.target.value) })}
              className="tabular w-14 rounded border border-ink-800 bg-ink-950 px-1.5 py-0.5 text-right text-xs text-slate-200 outline-none focus:border-ink-600"
            />
          </Field>
        </div>
      </div>

      {!preview ? (
        <p className="p-3 text-[11px] leading-relaxed text-slate-600">
          Reallocates facings across every shelf: each SKU starts at the minimum, then extra
          facings go to whichever product returns most per millimetre of shelf it takes. Pinned
          facings are left alone. Nothing changes until you apply.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between border-b border-ink-850 bg-ink-850/40 px-2 py-1.5 text-[11px]">
            <span className="text-slate-400">
              {preview.changes.length} change{preview.changes.length === 1 ? '' : 's'} proposed
            </span>
            <span
              className={cx(
                'tabular font-semibold',
                marginDelta >= 0 ? 'text-leaf-400' : 'text-rose-400',
              )}
            >
              {marginDelta >= 0 ? '+' : '−'}€{fmt.eur(Math.abs(marginDelta))}/day margin
            </span>
          </div>

          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-ink-900/95 text-[10px] uppercase tracking-wider text-slate-500 backdrop-blur">
              <tr>
                <th className="px-2 py-1 text-left font-medium">Product</th>
                <th className="px-1 py-1 text-right font-medium">Now</th>
                <th className="px-1 py-1 text-right font-medium">→</th>
                <th className="px-2 py-1 text-right font-medium">€/day</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-850">
              {preview.changes.map((change) => (
                <tr
                  key={change.facingId}
                  onClick={() => select(change.facingId)}
                  className="cursor-pointer hover:bg-ink-850"
                >
                  <td className="max-w-0 truncate px-2 py-1 text-slate-300" title={change.skuName}>
                    {change.skuName}
                  </td>
                  <td className="tabular px-1 py-1 text-right text-slate-500">{change.from}</td>
                  <td
                    className={cx(
                      'tabular px-1 py-1 text-right font-semibold',
                      change.delta > 0 ? 'text-leaf-400' : 'text-orange-400',
                    )}
                  >
                    {change.to}
                  </td>
                  <td
                    className={cx(
                      'tabular px-2 py-1 text-right',
                      change.marginDelta >= 0 ? 'text-leaf-400' : 'text-rose-400',
                    )}
                  >
                    {change.marginDelta >= 0 ? '+' : '−'}
                    {Math.abs(change.marginDelta).toFixed(2)}
                  </td>
                </tr>
              ))}
              {preview.changes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-3 text-center text-slate-600">
                    Already optimal for these settings.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  )
}
