import { Box, Dices, Redo2, Square, Undo2 } from 'lucide-react'

import { CATEGORIES, CATEGORY_KEYS } from '@/core/catalog'
import { METRICS, type MetricKey } from '@/core/colors'
import { FIXTURE_PRESETS } from '@/core/generate'
import type { CategoryKey, FixtureType } from '@/core/model'
import { usePlanogramStore, useTimeTravel } from '@/state/planogramStore'
import { IconButton, Segmented } from '@/ui/primitives'

const selectClass =
  'rounded border border-ink-800 bg-ink-950 px-1.5 py-1 text-xs text-slate-200 outline-none focus:border-ink-600'

export default function Toolbar() {
  const options = usePlanogramStore((s) => s.options)
  const regenerate = usePlanogramStore((s) => s.regenerate)
  const view = usePlanogramStore((s) => s.view)
  const setView = usePlanogramStore((s) => s.setView)
  const metric = usePlanogramStore((s) => s.metric)
  const setMetric = usePlanogramStore((s) => s.setMetric)
  const { undo, redo, canUndo, canRedo } = useTimeTravel()

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ink-800 bg-ink-900/60 px-3 py-2">
      <div>
        <h1 className="text-sm font-semibold tracking-tight text-slate-100">
          Shelf Space Optimization
        </h1>
        <p className="text-[10px] text-slate-500">Micro space · planogram editor POC</p>
      </div>

      <div className="flex items-center gap-1.5">
        <select
          value={options.category}
          onChange={(event) => regenerate({ category: event.target.value as CategoryKey })}
          className={selectClass}
          title="Category"
        >
          {CATEGORY_KEYS.map((key) => (
            <option key={key} value={key}>
              {CATEGORIES[key].label}
            </option>
          ))}
        </select>

        <select
          value={options.fixtureType}
          onChange={(event) => regenerate({ fixtureType: event.target.value as FixtureType })}
          className={selectClass}
          title="Fixture"
        >
          {Object.values(FIXTURE_PRESETS).map((preset) => (
            <option key={preset.type} value={preset.type}>
              {preset.label}
            </option>
          ))}
        </select>

        <select
          value={options.skuCount}
          onChange={(event) => regenerate({ skuCount: Number(event.target.value) })}
          className={selectClass}
          title="Catalogue size"
        >
          {[24, 48, 72, 120, 200].map((count) => (
            <option key={count} value={count}>
              {count} SKU
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 rounded border border-ink-800 bg-ink-950 pl-1.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-600">seed</span>
          <input
            type="number"
            value={options.seed}
            onChange={(event) => regenerate({ seed: Number(event.target.value) })}
            className="tabular w-20 bg-transparent px-1 py-1 text-xs text-slate-200 outline-none"
          />
          <IconButton
            title="Random seed"
            onClick={() => regenerate({ seed: Math.floor(Math.random() * 99_999_999) })}
          >
            <Dices size={13} />
          </IconButton>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-600">colour by</span>
          <Segmented
            size="sm"
            value={metric}
            onChange={(value) => setMetric(value as MetricKey)}
            options={METRICS.map((m) => ({ value: m.key, label: m.label, title: m.hint }))}
          />
        </div>

        <div className="flex items-center gap-1">
          <IconButton onClick={undo} title="Undo (⌘Z)" disabled={!canUndo}>
            <Undo2 size={14} />
          </IconButton>
          <IconButton onClick={redo} title="Redo (⇧⌘Z)" disabled={!canRedo}>
            <Redo2 size={14} />
          </IconButton>
        </div>

        <Segmented
          value={view}
          onChange={setView}
          options={[
            {
              value: '2d',
              label: (
                <span className="flex items-center gap-1">
                  <Square size={11} /> 2D
                </span>
              ),
              title: 'Planogram editor',
            },
            {
              value: '3d',
              label: (
                <span className="flex items-center gap-1">
                  <Box size={11} /> 3D
                </span>
              ),
              title: 'Fixture walkthrough',
            },
          ]}
        />
      </div>
    </header>
  )
}
