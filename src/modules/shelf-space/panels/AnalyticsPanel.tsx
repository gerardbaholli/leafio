import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts'

import { ABC_COLORS, METRICS, rampColor } from '@/core/colors'
import { OVERSTOCK_DOS, STOCKOUT_DOS } from '@/core/metrics'
import {
  useMetricScale,
  usePlanogramStats,
  usePlanogramStore,
  usePreviewStats,
  useSkuIndex,
} from '@/state/planogramStore'
import { Panel, Stat, fmt } from '@/ui/primitives'

export default function AnalyticsPanel() {
  const stats = usePlanogramStats()
  const previewStats = usePreviewStats()
  const skuIndex = useSkuIndex()
  const fixture = usePlanogramStore((s) => s.fixture)

  const totals = stats.totals
  const after = previewStats?.totals

  const perShelf = stats.perShelf.map((report, i) => {
    const margin = report.facings.reduce(
      (sum, facing) => sum + (stats.perFacing.get(facing.id)?.realizedMarginPerDay ?? 0),
      0,
    )
    return {
      name: `S${i + 1}`,
      margin: Number(margin.toFixed(2)),
      fill: report.fillRate,
      overflow: report.overflow,
    }
  })

  return (
    <Panel title="Performance" className="shrink-0">
      <div className="grid grid-cols-2 gap-2 p-2">
        <Stat
          label="Margin / linear m"
          value={`€${fmt.eur(totals.marginPerLinearM)}`}
          unit="/day"
          delta={after ? after.marginPerLinearM - totals.marginPerLinearM : undefined}
          hint="Realized daily gross margin divided by the linear metres of shelf in use"
        />
        <Stat
          label="Sales / linear m"
          value={`€${fmt.eur(totals.salesPerLinearM)}`}
          unit="/day"
          delta={after ? after.salesPerLinearM - totals.salesPerLinearM : undefined}
        />
        <Stat
          label="Lost sales"
          value={`€${fmt.eur(totals.lostSalesPerDay)}`}
          unit="/day"
          tone={totals.lostSalesPerDay > totals.salesPerDay * 0.08 ? 'bad' : 'default'}
          delta={after ? -(after.lostSalesPerDay - totals.lostSalesPerDay) : undefined}
          hint="Demand forfeited by facings that cannot hold a week of sales"
        />
        <Stat
          label="Space used"
          value={fmt.pct(totals.fillRate)}
          unit={`of ${(totals.totalLinearMm / 1000).toFixed(1)} m`}
          tone={totals.fillRate > 0.97 ? 'warn' : 'default'}
          delta={after ? after.fillRate - totals.fillRate : undefined}
        />
        <Stat
          label="Avg days of supply"
          value={fmt.num(totals.avgDos)}
          unit="days"
          tone={totals.avgDos < STOCKOUT_DOS ? 'bad' : totals.avgDos > OVERSTOCK_DOS ? 'warn' : 'good'}
          delta={after ? after.avgDos - totals.avgDos : undefined}
        />
        <Stat
          label="SKUs on fixture"
          value={String(totals.skuCount)}
          unit={`/ ${skuIndex.size}`}
          hint={`${totals.facingCount} facings over ${fixture.shelves.length} shelves`}
        />
      </div>

      {(totals.stockoutRisk > 0 || totals.overflowShelves > 0 || totals.fitIssues > 0) && (
        <div className="flex flex-wrap gap-1.5 px-2 pb-2 text-[10px]">
          {totals.stockoutRisk > 0 && (
            <span className="rounded border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-rose-300">
              {totals.stockoutRisk} SKU under {STOCKOUT_DOS} days of cover
            </span>
          )}
          {totals.overstocked > 0 && (
            <span className="rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-violet-300">
              {totals.overstocked} overstocked
            </span>
          )}
          {totals.overflowShelves > 0 && (
            <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-amber-300">
              {totals.overflowShelves} shelf over width
            </span>
          )}
          {totals.fitIssues > 0 && (
            <span className="rounded border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-rose-300">
              {totals.fitIssues} product does not fit
            </span>
          )}
        </div>
      )}

      <div className="border-t border-ink-850 px-2 py-2">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
          Margin by shelf · €/day
        </div>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perShelf} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="name"
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={{ stroke: '#1f2c3f' }}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148,163,184,0.06)' }}
                contentStyle={{
                  background: '#0d1420',
                  border: '1px solid #24334a',
                  borderRadius: 6,
                  fontSize: 11,
                }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(value) => [`€${Number(value ?? 0).toFixed(2)}/day`, 'Margin']}
              />
              <Bar dataKey="margin" radius={[2, 2, 0, 0]}>
                {perShelf.map((entry) => (
                  <Cell key={entry.name} fill={entry.overflow > 0 ? '#f43f5e' : '#22c55e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Legend />
    </Panel>
  )
}

function Legend() {
  const metric = usePlanogramStore((s) => s.metric)
  const scale = useMetricScale()
  if (metric === 'none') return null

  const label = METRICS.find((m) => m.key === metric)?.label ?? metric

  return (
    <div className="border-t border-ink-850 px-2 py-2">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">{label} scale</div>

      {metric === 'abc' ? (
        <div className="flex gap-2">
          {(['A', 'B', 'C'] as const).map((cls) => (
            <span key={cls} className="flex items-center gap-1 text-[10px] text-slate-400">
              <span
                className="h-2.5 w-4 rounded-sm"
                style={{ background: ABC_COLORS[cls] }}
              />
              {cls}
            </span>
          ))}
        </div>
      ) : metric === 'dos' ? (
        <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-4 rounded-sm bg-rose-600" /> &lt; {STOCKOUT_DOS} d
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-4 rounded-sm" style={{ background: rampColor(0.45) }} /> healthy
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-4 rounded-sm bg-violet-600" /> &gt; {OVERSTOCK_DOS} d
          </span>
        </div>
      ) : (
        <div>
          <div
            className="h-2.5 w-full rounded-sm"
            style={{
              background: `linear-gradient(90deg, ${[0, 0.2, 0.4, 0.6, 0.8, 1]
                .map((t) => rampColor(t))
                .join(',')})`,
            }}
          />
          <div className="tabular mt-1 flex justify-between text-[10px] text-slate-500">
            <span>{scale.min.toFixed(1)}</span>
            <span>{scale.max.toFixed(1)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

