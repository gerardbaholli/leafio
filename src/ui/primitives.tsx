import type { ReactNode } from 'react'

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' ')

export function Panel({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cx(
        'flex min-h-0 flex-col rounded-lg border border-ink-800 bg-ink-900/70 backdrop-blur',
        className,
      )}
    >
      {title && (
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-ink-800 px-3 py-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {title}
          </h2>
          {actions}
        </header>
      )}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  )
}

export function Stat({
  label,
  value,
  unit,
  delta,
  hint,
  tone = 'default',
}: {
  label: string
  value: string
  unit?: string
  delta?: number
  hint?: string
  tone?: 'default' | 'warn' | 'bad' | 'good'
}) {
  const toneClass =
    tone === 'bad'
      ? 'text-rose-400'
      : tone === 'warn'
        ? 'text-amber-400'
        : tone === 'good'
          ? 'text-leaf-400'
          : 'text-slate-100'

  return (
    <div className="rounded-md border border-ink-800 bg-ink-850/60 px-3 py-2" title={hint}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={cx('tabular text-lg font-semibold', toneClass)}>{value}</span>
        {unit && <span className="text-[11px] text-slate-500">{unit}</span>}
      </div>
      {delta !== undefined && Math.abs(delta) > 0.0001 && (
        <div
          className={cx(
            'tabular text-[11px] font-medium',
            delta > 0 ? 'text-leaf-400' : 'text-rose-400',
          )}
        >
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta) < 1 ? Math.abs(delta).toFixed(2) : Math.abs(delta).toFixed(1)}
        </div>
      )}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
  onChange: (value: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex rounded-md border border-ink-800 bg-ink-950/60 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          onClick={() => onChange(option.value)}
          className={cx(
            'rounded px-2 py-1 font-medium transition-colors',
            size === 'sm' ? 'text-[10px]' : 'text-xs',
            value === option.value
              ? 'bg-ink-700 text-slate-100'
              : 'text-slate-400 hover:text-slate-200',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function IconButton({
  onClick,
  title,
  disabled,
  active,
  children,
}: {
  onClick: () => void
  title: string
  disabled?: boolean
  active?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex h-7 w-7 items-center justify-center rounded border transition-colors',
        disabled
          ? 'cursor-not-allowed border-ink-800 text-slate-700'
          : active
            ? 'border-leaf-500/50 bg-leaf-500/15 text-leaf-300'
            : 'border-ink-800 text-slate-400 hover:border-ink-600 hover:text-slate-100',
      )}
    >
      {children}
    </button>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs text-slate-400">
      <span className="shrink-0">{label}</span>
      {children}
    </label>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-1 w-full cursor-pointer appearance-none rounded-full bg-ink-700 accent-leaf-500"
    />
  )
}

export function Badge({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'default' | 'good' | 'warn' | 'bad'
}) {
  const toneClass = {
    default: 'border-ink-700 bg-ink-800 text-slate-300',
    good: 'border-leaf-500/40 bg-leaf-500/10 text-leaf-300',
    warn: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    bad: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  }[tone]

  return (
    <span className={cx('rounded border px-1.5 py-0.5 text-[10px] font-medium', toneClass)}>
      {children}
    </span>
  )
}

export const fmt = {
  eur: (value: number) =>
    value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(value < 10 ? 2 : 0),
  num: (value: number, digits = 1) => value.toFixed(digits),
  pct: (value: number) => `${(value * 100).toFixed(0)}%`,
  mm: (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(2)} m` : `${Math.round(value)} mm`),
}
