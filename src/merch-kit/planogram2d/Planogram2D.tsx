import { useCallback, useMemo, useState } from 'react'
import { Group, Layer, Line, Rect, Stage } from 'react-konva'
import type Konva from 'konva'

import { ControlButton, ControlGroup, Hint, Readout, icons, overlayBase } from '../chrome'
import { buildScale, colorFor } from '../colors'
import { planogramStats } from '../metrics'
import { byId, facingFootprint, type Facing, type Sku } from '../model'
import { insertIndexAt, shelfAtHeight } from '../packing'
import { resolveTheme } from '../theme'
import type { FacingMove, PlanogramViewProps, SkuDrop } from '../types'

import { FacingBlock } from './FacingBlock'
import { FixtureLayer, LABEL_GUTTER, UPRIGHT } from './FixtureLayer'
import { useViewport } from './useViewport'

const MARGIN_TOP = 70
const MARGIN_RIGHT = 240
const MARGIN_BOTTOM = 120

export const SKU_DROP_MIME = 'application/x-sku'

export type Planogram2DProps = PlanogramViewProps & {
  /** A facing was dragged to a new shelf and position. */
  onMoveFacing?: (move: FacingMove) => void
  /** A SKU was dragged in from outside the canvas (HTML drag and drop). */
  onDropSku?: (drop: SkuDrop) => void
  /** Drag payload type read on drop. Defaults to `application/x-sku`. */
  dropMimeType?: string
  /** Rendered centred when the fixture holds no facings. */
  emptyState?: React.ReactNode
}

type DropHint = { shelfId: string; x: number; top: number; height: number } | null

/**
 * Front elevation of one fixture, drawn to scale in millimetres.
 *
 * Controlled component: it never mutates the planogram it is given, it reports
 * the move the user made and waits to be re-rendered with new facings.
 */
export function Planogram2D({
  fixture,
  facings,
  skus,
  metric = 'none',
  selectedFacingId = null,
  preview = null,
  theme: themeOverride,
  getFacingColor,
  onSelect,
  onMoveFacing,
  onDropSku,
  dropMimeType = SKU_DROP_MIME,
  controls = true,
  hints = true,
  emptyState,
  className,
  style,
}: Planogram2DProps) {
  const theme = useMemo(() => resolveTheme(themeOverride), [themeOverride])
  const skuIndex = useMemo(
    () => (skus instanceof Map ? skus : byId(skus as Sku[])),
    [skus],
  )
  const stats = useMemo(
    () => planogramStats(fixture, facings, skuIndex),
    [fixture, facings, skuIndex],
  )
  const scaleInfo = useMemo(
    () => buildScale(metric, stats.perFacing.values()),
    [metric, stats],
  )

  const contentW = LABEL_GUTTER + UPRIGHT * 2 + fixture.w + MARGIN_RIGHT
  const contentH = fixture.h + MARGIN_TOP + MARGIN_BOTTOM
  const { containerRef, size, scale, pan, setPan, fit, zoomBy, onWheel, toContentMm } = useViewport(
    contentW,
    contentH,
  )

  const originX = LABEL_GUTTER + UPRIGHT
  const originY = MARGIN_TOP

  const [dropHint, setDropHint] = useState<DropHint>(null)

  const reports = useMemo(
    () => new Map(stats.perShelf.map((report) => [report.shelfId, report])),
    [stats],
  )
  const fitIssues = useMemo(
    () => new Set(stats.perShelf.flatMap((r) => [...r.tooTall, ...r.tooDeep])),
    [stats],
  )

  /** Where a facing sitting at these stage coordinates would land. */
  const resolveDrop = useCallback(
    (localX: number, localTopY: number, boxHeight: number, ignoreId?: string) => {
      const bottomDomainY = fixture.h - (localTopY + boxHeight)
      const shelf = shelfAtHeight(fixture, bottomDomainY + 10)
      const row = facings.filter((f) => f.shelfId === shelf.id && f.id !== ignoreId)
      const index = insertIndexAt(row, skuIndex, localX, ignoreId)

      let offset = 0
      const ordered = [...row].sort((a, b) => a.x - b.x)
      for (let i = 0; i < index && i < ordered.length; i++) {
        const sku = skuIndex.get(ordered[i].skuId)
        if (sku) offset += facingFootprint(ordered[i], sku).width
      }

      return { shelf, index, offset }
    },
    [facings, fixture, skuIndex],
  )

  const handleDragMove = useCallback(
    (facingId: string, node: Konva.Group) => {
      const facing = facings.find((f) => f.id === facingId)
      const sku = facing && skuIndex.get(facing.skuId)
      if (!facing || !sku) return
      const box = facingFootprint(facing, sku)
      const { shelf, offset } = resolveDrop(node.x() + box.width / 2, node.y(), box.height, facingId)
      setDropHint({
        shelfId: shelf.id,
        x: offset,
        top: fixture.h - (shelf.y + shelf.gap),
        height: shelf.gap,
      })
    },
    [facings, fixture.h, resolveDrop, skuIndex],
  )

  const handleDragEnd = useCallback(
    (facingId: string, node: Konva.Group) => {
      setDropHint(null)
      const facing = facings.find((f) => f.id === facingId)
      const sku = facing && skuIndex.get(facing.skuId)
      if (!facing || !sku) return
      const box = facingFootprint(facing, sku)
      const { shelf, offset } = resolveDrop(node.x() + box.width / 2, node.y(), box.height, facingId)
      onMoveFacing?.({ facingId, shelfId: shelf.id, x: offset })
    },
    [facings, onMoveFacing, resolveDrop, skuIndex],
  )

  const handleHtmlDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setDropHint(null)
      const skuId = event.dataTransfer.getData(dropMimeType)
      const sku = skuId ? skuIndex.get(skuId) : undefined
      if (!sku || !onDropSku) return

      const point = toContentMm(event.clientX, event.clientY)
      const localX = point.x - originX
      const localY = point.y - originY
      const shelf = shelfAtHeight(fixture, fixture.h - localY)
      const { offset } = resolveDrop(localX, fixture.h - shelf.y - sku.dims.h, sku.dims.h)
      onDropSku({ skuId: sku.id, shelfId: shelf.id, x: offset })
    },
    [dropMimeType, fixture, onDropSku, originX, originY, resolveDrop, skuIndex, toContentMm],
  )

  const handleHtmlDragOver = useCallback(
    (event: React.DragEvent) => {
      if (!onDropSku || !event.dataTransfer.types.includes(dropMimeType)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'

      const point = toContentMm(event.clientX, event.clientY)
      const shelf = shelfAtHeight(fixture, fixture.h - (point.y - originY))
      setDropHint({
        shelfId: shelf.id,
        x: Math.max(0, point.x - originX),
        top: fixture.h - (shelf.y + shelf.gap),
        height: shelf.gap,
      })
    },
    [dropMimeType, fixture, onDropSku, originX, originY, toContentMm],
  )

  const previewWidthFor = (facing: Facing): number | undefined => {
    const target = preview?.get(facing.id)
    const sku = skuIndex.get(facing.skuId)
    if (target === undefined || !sku) return undefined
    return facingFootprint({ ...facing, wide: target }, sku).width
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: theme.background,
        ...style,
      }}
      onDrop={handleHtmlDrop}
      onDragOver={handleHtmlDragOver}
      onDragLeave={() => setDropHint(null)}
    >
      {size.w > 0 && (
        <Stage
          width={size.w}
          height={size.h}
          scaleX={scale}
          scaleY={scale}
          x={pan.x}
          y={pan.y}
          draggable
          onWheel={onWheel}
          onDragEnd={(event) => {
            if (event.target === event.target.getStage()) {
              setPan({ x: event.target.x(), y: event.target.y() })
            }
          }}
          onMouseDown={(event) => {
            if (event.target === event.target.getStage()) onSelect?.(null)
          }}
        >
          <Layer listening={false}>
            <Group x={originX} y={originY}>
              <FixtureLayer fixture={fixture} reports={reports} scale={scale} theme={theme} />
            </Group>
          </Layer>

          <Layer>
            <Group x={originX} y={originY}>
              {facings.map((facing) => {
                const sku = skuIndex.get(facing.skuId)
                const shelf = fixture.shelves.find((s) => s.id === facing.shelfId)
                if (!sku || !shelf) return null
                const facingStats = stats.perFacing.get(facing.id)
                return (
                  <FacingBlock
                    key={facing.id}
                    facing={facing}
                    sku={sku}
                    shelf={shelf}
                    fixtureHeight={fixture.h}
                    scale={scale}
                    theme={theme}
                    color={
                      getFacingColor?.(sku, facing, facingStats) ??
                      colorFor(sku, facing, facingStats, scaleInfo)
                    }
                    selected={selectedFacingId === facing.id}
                    hasFitIssue={fitIssues.has(facing.id)}
                    dimmed={Boolean(selectedFacingId) && selectedFacingId !== facing.id}
                    previewWidth={previewWidthFor(facing)}
                    onSelect={(id) => onSelect?.(id)}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                  />
                )
              })}
            </Group>
          </Layer>

          <Layer listening={false}>
            <Group x={originX} y={originY}>
              {dropHint && (
                <>
                  <Rect
                    x={-4}
                    y={dropHint.top}
                    width={fixture.w + 8}
                    height={dropHint.height}
                    fill={theme.accent}
                    opacity={0.07}
                    stroke={theme.accent}
                    strokeWidth={1 / scale}
                    perfectDrawEnabled={false}
                  />
                  <Line
                    points={[dropHint.x, dropHint.top, dropHint.x, dropHint.top + dropHint.height]}
                    stroke={theme.accent}
                    strokeWidth={3 / scale}
                    perfectDrawEnabled={false}
                  />
                </>
              )}
            </Group>
          </Layer>
        </Stage>
      )}

      {controls && (
        <div style={{ ...overlayBase(theme), left: 12, bottom: 12 }}>
          <ControlGroup theme={theme}>
            <ControlButton theme={theme} title="Zoom in" onClick={() => zoomBy(1.25)}>
              {icons.zoomIn}
            </ControlButton>
            <ControlButton theme={theme} title="Zoom out" onClick={() => zoomBy(0.8)}>
              {icons.zoomOut}
            </ControlButton>
            <ControlButton theme={theme} title="Fit to view" onClick={fit}>
              {icons.fit}
            </ControlButton>
          </ControlGroup>
          <Readout theme={theme}>{(scale * 1000).toFixed(0)} px/m</Readout>
        </div>
      )}

      {hints && <Hint theme={theme}>drag to move · wheel to zoom · drag the background to pan</Hint>}

      {facings.length === 0 && emptyState && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          {emptyState}
        </div>
      )}
    </div>
  )
}

export default Planogram2D
