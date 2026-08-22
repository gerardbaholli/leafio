import { memo, useRef } from 'react'
import { Group, Line, Rect, Text } from 'react-konva'
import type Konva from 'konva'

import { readableText } from '@/core/colors'
import { facingFootprint, type Facing, type Shelf, type Sku } from '@/core/model'

export type FacingBlockProps = {
  facing: Facing
  sku: Sku
  shelf: Shelf
  fixtureHeight: number
  color: string
  scale: number
  selected: boolean
  hasFitIssue: boolean
  dimmed: boolean
  /** Target width in mm after autofacing, when a preview is pending. */
  previewWidth?: number
  onSelect: (facingId: string) => void
  onDragMove: (facingId: string, node: Konva.Group) => void
  onDragEnd: (facingId: string, node: Konva.Group) => void
}

function FacingBlockImpl({
  facing,
  sku,
  shelf,
  fixtureHeight,
  color,
  scale,
  selected,
  hasFitIssue,
  dimmed,
  previewWidth,
  onSelect,
  onDragMove,
  onDragEnd,
}: FacingBlockProps) {
  const ref = useRef<Konva.Group>(null)
  const box = facingFootprint(facing, sku)

  // Konva's y grows downward; the domain measures height from the floor up.
  const top = fixtureHeight - (shelf.y + box.height)
  const textFill = readableText(color)
  const px = (mm: number) => mm * scale

  const showLabel = px(box.width) > 34 && px(box.height) > 26
  const showUnits = facing.wide * facing.high <= 40 && px(box.width / facing.wide) > 7

  return (
    <Group
      ref={ref}
      x={facing.x}
      y={top}
      draggable
      opacity={dimmed ? 0.35 : 1}
      onMouseDown={() => onSelect(facing.id)}
      onTap={() => onSelect(facing.id)}
      onDragMove={() => ref.current && onDragMove(facing.id, ref.current)}
      onDragEnd={() => {
        if (!ref.current) return
        onDragEnd(facing.id, ref.current)
        // State is the source of truth: snap the node back to its prop position
        // so an unchanged drop cannot leave the node detached from the model.
        ref.current.position({ x: facing.x, y: top })
      }}
      onMouseEnter={(event) => {
        const stage = event.target.getStage()
        if (stage) stage.container().style.cursor = 'grab'
      }}
      onMouseLeave={(event) => {
        const stage = event.target.getStage()
        if (stage) stage.container().style.cursor = 'default'
      }}
    >
      <Rect
        width={box.width}
        height={box.height}
        fill={color}
        cornerRadius={2 / scale}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
        stroke={hasFitIssue ? '#f43f5e' : 'rgba(0,0,0,0.35)'}
        strokeWidth={(hasFitIssue ? 2.5 : 1) / scale}
      />

      {/* Pack separators, so a block of 4 facings reads as four packs. */}
      {showUnits &&
        Array.from({ length: facing.wide - 1 }, (_, i) => (
          <Line
            key={`v${i}`}
            points={[box.unitW * (i + 1), 0, box.unitW * (i + 1), box.height]}
            stroke="rgba(0,0,0,0.28)"
            strokeWidth={0.8 / scale}
            listening={false}
            perfectDrawEnabled={false}
          />
        ))}
      {showUnits &&
        Array.from({ length: facing.high - 1 }, (_, i) => (
          <Line
            key={`h${i}`}
            points={[0, sku.dims.h * (i + 1), box.width, sku.dims.h * (i + 1)]}
            stroke="rgba(0,0,0,0.28)"
            strokeWidth={0.8 / scale}
            listening={false}
            perfectDrawEnabled={false}
          />
        ))}

      {/* Label band, mimicking the printed front of the pack. */}
      {showLabel && (
        <>
          <Rect
            x={box.width * 0.08}
            y={box.height * 0.34}
            width={box.width * 0.84}
            height={Math.min(box.height * 0.34, 26 / scale)}
            fill="rgba(255,255,255,0.14)"
            cornerRadius={1 / scale}
            listening={false}
            perfectDrawEnabled={false}
          />
          <Text
            x={2 / scale}
            y={box.height * 0.36}
            width={box.width - 4 / scale}
            align="center"
            text={sku.brand}
            fontSize={10 / scale}
            fontStyle="600"
            fill={textFill}
            listening={false}
            perfectDrawEnabled={false}
          />
          {px(box.height) > 46 && (
            <Text
              x={2 / scale}
              y={box.height * 0.36 + 12 / scale}
              width={box.width - 4 / scale}
              align="center"
              text={sku.name.replace(`${sku.brand} `, '')}
              fontSize={8 / scale}
              fill={textFill}
              opacity={0.8}
              wrap="none"
              ellipsis
              listening={false}
              perfectDrawEnabled={false}
            />
          )}
        </>
      )}

      {facing.pinned && (
        <Rect
          x={box.width - 12 / scale}
          y={4 / scale}
          width={8 / scale}
          height={8 / scale}
          fill="#fbbf24"
          cornerRadius={4 / scale}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* Ghost outline of the width autofacing would give this facing. */}
      {previewWidth !== undefined && Math.abs(previewWidth - box.width) > 0.5 && (
        <Rect
          width={previewWidth}
          height={box.height}
          stroke={previewWidth > box.width ? '#4ade80' : '#f97316'}
          strokeWidth={2 / scale}
          dash={[6 / scale, 4 / scale]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {selected && (
        <Rect
          x={-2 / scale}
          y={-2 / scale}
          width={box.width + 4 / scale}
          height={box.height + 4 / scale}
          stroke="#4ade80"
          strokeWidth={2.5 / scale}
          cornerRadius={3 / scale}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  )
}

export const FacingBlock = memo(FacingBlockImpl)
