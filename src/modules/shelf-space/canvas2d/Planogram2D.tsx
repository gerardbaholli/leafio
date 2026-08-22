import { useCallback, useState } from 'react'
import { Group, Layer, Line, Rect, Stage } from 'react-konva'
import type Konva from 'konva'
import { Crosshair, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'

import { colorFor } from '@/core/colors'
import { facingFootprint, type Facing } from '@/core/model'
import { insertIndexAt, shelfAtHeight } from '@/core/packing'
import {
  useMetricScale,
  usePlanogramStats,
  usePlanogramStore,
  useSkuIndex,
} from '@/state/planogramStore'
import { IconButton } from '@/ui/primitives'

import { FacingBlock } from './FacingBlock'
import { FixtureLayer, LABEL_GUTTER, UPRIGHT } from './FixtureLayer'
import { useViewport } from './useViewport'

const MARGIN_TOP = 70
const MARGIN_RIGHT = 240
const MARGIN_BOTTOM = 120

type DropHint = { shelfId: string; x: number; top: number; height: number } | null

export default function Planogram2D() {
  const fixture = usePlanogramStore((s) => s.fixture)
  const facings = usePlanogramStore((s) => s.facings)
  const selectedFacingId = usePlanogramStore((s) => s.selectedFacingId)
  const preview = usePlanogramStore((s) => s.preview)
  const select = usePlanogramStore((s) => s.select)
  const moveFacing = usePlanogramStore((s) => s.moveFacing)
  const addSkuToShelf = usePlanogramStore((s) => s.addSkuToShelf)

  const skuIndex = useSkuIndex()
  const stats = usePlanogramStats()
  const scaleInfo = useMetricScale()

  const contentW = LABEL_GUTTER + UPRIGHT * 2 + fixture.w + MARGIN_RIGHT
  const contentH = fixture.h + MARGIN_TOP + MARGIN_BOTTOM
  const { containerRef, size, scale, pan, setPan, fit, zoomBy, onWheel, toContentMm } = useViewport(
    contentW,
    contentH,
  )

  const originX = LABEL_GUTTER + UPRIGHT
  const originY = MARGIN_TOP

  const [dropHint, setDropHint] = useState<DropHint>(null)

  const reports = new Map(stats.perShelf.map((report) => [report.shelfId, report]))
  const fitIssues = new Set(stats.perShelf.flatMap((r) => [...r.tooTall, ...r.tooDeep]))

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
      moveFacing(facingId, shelf.id, offset)
    },
    [facings, moveFacing, resolveDrop, skuIndex],
  )

  const handleHtmlDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setDropHint(null)
      const skuId = event.dataTransfer.getData('application/x-sku')
      const sku = skuId ? skuIndex.get(skuId) : undefined
      if (!sku) return

      const point = toContentMm(event.clientX, event.clientY)
      const localX = point.x - originX
      const localY = point.y - originY
      const domainY = fixture.h - localY
      const shelf = shelfAtHeight(fixture, domainY)
      const { offset } = resolveDrop(localX, fixture.h - shelf.y - sku.dims.h, sku.dims.h)
      addSkuToShelf(sku.id, shelf.id, offset)
    },
    [addSkuToShelf, fixture, originX, originY, resolveDrop, skuIndex, toContentMm],
  )

  const handleHtmlDragOver = useCallback(
    (event: React.DragEvent) => {
      if (!event.dataTransfer.types.includes('application/x-sku')) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'

      const point = toContentMm(event.clientX, event.clientY)
      const domainY = fixture.h - (point.y - originY)
      const shelf = shelfAtHeight(fixture, domainY)
      setDropHint({
        shelfId: shelf.id,
        x: Math.max(0, point.x - originX),
        top: fixture.h - (shelf.y + shelf.gap),
        height: shelf.gap,
      })
    },
    [fixture, originX, originY, toContentMm],
  )

  const previewWidthFor = (facing: Facing): number | undefined => {
    const target = preview?.targets.get(facing.id)
    const sku = skuIndex.get(facing.skuId)
    if (target === undefined || !sku) return undefined
    return facingFootprint({ ...facing, wide: target }, sku).width
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-ink-950"
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
            if (event.target === event.target.getStage()) select(null)
          }}
        >
          <Layer listening={false}>
            <Group x={originX} y={originY}>
              <FixtureLayer fixture={fixture} reports={reports} scale={scale} />
            </Group>
          </Layer>

          <Layer>
            <Group x={originX} y={originY}>
              {facings.map((facing) => {
                const sku = skuIndex.get(facing.skuId)
                const shelf = fixture.shelves.find((s) => s.id === facing.shelfId)
                if (!sku || !shelf) return null
                return (
                  <FacingBlock
                    key={facing.id}
                    facing={facing}
                    sku={sku}
                    shelf={shelf}
                    fixtureHeight={fixture.h}
                    scale={scale}
                    color={colorFor(sku, facing, stats.perFacing.get(facing.id), scaleInfo)}
                    selected={selectedFacingId === facing.id}
                    hasFitIssue={fitIssues.has(facing.id)}
                    dimmed={Boolean(selectedFacingId) && selectedFacingId !== facing.id}
                    previewWidth={previewWidthFor(facing)}
                    onSelect={select}
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
                    fill="rgba(74,222,128,0.07)"
                    stroke="rgba(74,222,128,0.35)"
                    strokeWidth={1 / scale}
                    perfectDrawEnabled={false}
                  />
                  <Line
                    points={[dropHint.x, dropHint.top, dropHint.x, dropHint.top + dropHint.height]}
                    stroke="#4ade80"
                    strokeWidth={3 / scale}
                    perfectDrawEnabled={false}
                  />
                </>
              )}
            </Group>
          </Layer>
        </Stage>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2">
        <div className="pointer-events-auto flex gap-1 rounded-md border border-ink-800 bg-ink-900/90 p-1 backdrop-blur">
          <IconButton onClick={() => zoomBy(1.25)} title="Zoom in">
            <ZoomIn size={14} />
          </IconButton>
          <IconButton onClick={() => zoomBy(0.8)} title="Zoom out">
            <ZoomOut size={14} />
          </IconButton>
          <IconButton onClick={fit} title="Fit to view">
            <Maximize2 size={14} />
          </IconButton>
        </div>
        <span className="tabular rounded border border-ink-800 bg-ink-900/90 px-2 py-1 text-[10px] text-slate-500">
          {(scale * 1000).toFixed(0)} px/m
        </span>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 text-[10px] text-slate-600">
        <Crosshair size={11} />
        drag to move · wheel to zoom · drag the background to pan
      </div>

      {facings.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded border border-ink-800 bg-ink-900/90 px-3 py-2 text-xs text-slate-400">
            Empty fixture — drag SKUs from the catalogue, or run autofacing.
          </span>
        </div>
      )}
    </div>
  )
}
