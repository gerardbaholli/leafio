import { memo } from 'react'
import { Group, Line, Rect, Text } from 'react-konva'

import type { Fixture } from '../model'
import type { ShelfReport } from '../packing'
import type { PlanogramTheme } from '../theme'

export const UPRIGHT = 55
export const LABEL_GUTTER = 460

/** Static fixture chrome: back panel, uprights, shelf boards, shelf labels. */
function FixtureLayerImpl({
  fixture,
  reports,
  scale,
  theme,
}: {
  fixture: Fixture
  reports: Map<string, ShelfReport>
  scale: number
  theme: PlanogramTheme
}) {
  const h = fixture.h
  const f = theme.fixture

  return (
    <Group listening={false}>
      <Rect
        x={-UPRIGHT}
        y={0}
        width={fixture.w + UPRIGHT * 2}
        height={h}
        fill={f.frame}
        stroke={f.frameEdge}
        strokeWidth={1 / scale}
        perfectDrawEnabled={false}
      />
      <Rect x={0} y={0} width={fixture.w} height={h} fill={f.back} perfectDrawEnabled={false} />

      {[-UPRIGHT, fixture.w].map((x) => (
        <Rect
          key={x}
          x={x}
          y={0}
          width={UPRIGHT}
          height={h}
          fill={f.upright}
          perfectDrawEnabled={false}
        />
      ))}

      {/* Floor line and overall dimensions. */}
      <Line
        points={[-UPRIGHT - 120, h, fixture.w + UPRIGHT + 120, h]}
        stroke={f.floorLine}
        strokeWidth={1.5 / scale}
        perfectDrawEnabled={false}
      />
      <Text
        x={0}
        y={h + 16 / scale}
        width={fixture.w}
        align="center"
        text={`${fixture.name}  ·  ${(fixture.w / 1000).toFixed(2)} m × ${(fixture.h / 1000).toFixed(2)} m × ${fixture.d} mm`}
        fontSize={11 / scale}
        fill={theme.textFaint}
        perfectDrawEnabled={false}
      />

      {fixture.shelves.map((shelf) => {
        const report = reports.get(shelf.id)
        const boardTop = h - shelf.y
        const fill = report?.fillRate ?? 0
        const crowded = fill > 0.97

        return (
          <Group key={shelf.id}>
            <Rect
              x={0}
              y={boardTop}
              width={fixture.w}
              height={shelf.thickness}
              fill={f.shelfBoard}
              perfectDrawEnabled={false}
            />
            <Rect
              x={0}
              y={boardTop}
              width={fixture.w}
              height={shelf.thickness * 0.35}
              fill={f.shelfEdge}
              perfectDrawEnabled={false}
            />

            {/* Used-width bar sitting on the board front. */}
            <Rect
              x={0}
              y={boardTop + shelf.thickness}
              width={fixture.w}
              height={7 / scale}
              fill={f.shelfTrack}
              perfectDrawEnabled={false}
            />
            <Rect
              x={0}
              y={boardTop + shelf.thickness}
              width={fixture.w * Math.min(1, fill)}
              height={7 / scale}
              fill={crowded ? theme.warning : f.fillBar}
              opacity={0.75}
              perfectDrawEnabled={false}
            />

            {report && report.overflow > 0 && (
              <Rect
                x={fixture.w}
                y={boardTop - shelf.gap}
                width={report.overflow}
                height={shelf.gap}
                fill={theme.danger}
                opacity={0.18}
                stroke={theme.danger}
                strokeWidth={1.5 / scale}
                dash={[8 / scale, 5 / scale]}
                perfectDrawEnabled={false}
              />
            )}

            <Text
              x={-LABEL_GUTTER - UPRIGHT}
              y={boardTop - 34 / scale}
              width={LABEL_GUTTER}
              align="right"
              text={`S${shelf.index + 1} · ${Math.round(fill * 100)}%`}
              wrap="none"
              fontSize={11 / scale}
              fontStyle="600"
              fill={crowded ? theme.pin : theme.textMuted}
              perfectDrawEnabled={false}
            />
            <Text
              x={-LABEL_GUTTER - UPRIGHT}
              y={boardTop - 20 / scale}
              width={LABEL_GUTTER}
              align="right"
              text={`gap ${shelf.gap}`}
              wrap="none"
              fontSize={9.5 / scale}
              fill={theme.textFaint}
              perfectDrawEnabled={false}
            />
          </Group>
        )
      })}
    </Group>
  )
}

export const FixtureLayer = memo(FixtureLayerImpl)
