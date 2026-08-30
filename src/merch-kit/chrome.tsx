/**
 * Minimal floating UI for the canvases: zoom buttons, camera presets, hints.
 *
 * Deliberately styled inline from the theme rather than with CSS classes — the
 * kit must render identically in a host app that has no Tailwind, no design
 * system and no global stylesheet of ours.
 */

import type { CSSProperties, ReactNode } from 'react'

import type { PlanogramTheme } from './theme'

export const overlayBase = (theme: PlanogramTheme): CSSProperties => ({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  color: theme.textMuted,
})

export function ControlGroup({
  theme,
  children,
  style,
}: {
  theme: PlanogramTheme
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        borderRadius: 6,
        border: `1px solid ${theme.surfaceBorder}`,
        background: theme.surface,
        backdropFilter: 'blur(6px)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function ControlButton({
  theme,
  title,
  active,
  onClick,
  children,
}: {
  theme: PlanogramTheme
  title: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 26,
        height: 24,
        padding: '0 7px',
        borderRadius: 4,
        border: `1px solid ${active ? theme.accent : 'transparent'}`,
        background: active ? `${theme.accent}22` : 'transparent',
        color: active ? theme.accent : theme.textMuted,
        font: 'inherit',
        fontSize: 11,
        fontWeight: 500,
        cursor: 'pointer',
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  )
}

export function Readout({ theme, children }: { theme: PlanogramTheme; children: ReactNode }) {
  return (
    <span
      style={{
        padding: '4px 7px',
        borderRadius: 4,
        border: `1px solid ${theme.surfaceBorder}`,
        background: theme.surface,
        color: theme.textFaint,
        fontSize: 10,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {children}
    </span>
  )
}

export function Hint({ theme, children }: { theme: PlanogramTheme; children: ReactNode }) {
  return (
    <div
      style={{
        ...overlayBase(theme),
        right: 12,
        bottom: 12,
        pointerEvents: 'none',
        fontSize: 10,
        color: theme.textFaint,
      }}
    >
      {children}
    </div>
  )
}

const svg = (path: ReactNode) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {path}
  </svg>
)

export const icons = {
  zoomIn: svg(
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3M11 8v6M8 11h6" />
    </>,
  ),
  zoomOut: svg(
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3M8 11h6" />
    </>,
  ),
  fit: svg(<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />),
}
