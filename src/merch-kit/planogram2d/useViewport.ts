import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type Konva from 'konva'

export type Viewport = {
  scale: number
  pan: { x: number; y: number }
  size: { w: number; h: number }
}

const MIN_SCALE = 0.02
const MAX_SCALE = 3

/**
 * Pan/zoom for a Konva stage drawn in millimetre coordinates.
 * `scale` is px per mm, so a 1000 mm shelf at scale 0.25 is 250 px wide.
 */
export function useViewport(contentW: number, contentH: number, padding = 56) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [scale, setScale] = useState(0.2)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const fit = useCallback(() => {
    if (size.w === 0 || size.h === 0 || contentW === 0) return
    const next = Math.min((size.w - padding * 2) / contentW, (size.h - padding * 2) / contentH)
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next))
    setScale(clamped)
    setPan({
      x: (size.w - contentW * clamped) / 2,
      y: (size.h - contentH * clamped) / 2,
    })
  }, [size.w, size.h, contentW, contentH, padding])

  // Refit whenever the container or the fixture changes shape.
  useEffect(() => {
    fit()
  }, [fit])

  const onWheel = useCallback((event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault()
    const stage = event.target.getStage()
    const pointer = stage?.getPointerPosition()
    if (!stage || !pointer) return

    const oldScale = stage.scaleX()
    const direction = event.evt.deltaY > 0 ? -1 : 1
    const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, oldScale * (1 + direction * 0.12)))

    // Keep the point under the cursor fixed while zooming.
    const origin = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }
    setScale(next)
    setPan({ x: pointer.x - origin.x * next, y: pointer.y - origin.y * next })
  }, [])

  const zoomBy = useCallback(
    (factor: number) => {
      setScale((current) => {
        const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, current * factor))
        setPan((currentPan) => ({
          x: size.w / 2 - ((size.w / 2 - currentPan.x) / current) * next,
          y: size.h / 2 - ((size.h / 2 - currentPan.y) / current) * next,
        }))
        return next
      })
    },
    [size.w, size.h],
  )

  /** Client coordinates -> millimetre coordinates of the stage content. */
  const toContentMm = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      return { x: (clientX - rect.left - pan.x) / scale, y: (clientY - rect.top - pan.y) / scale }
    },
    [pan.x, pan.y, scale],
  )

  return { containerRef, size, scale, pan, setPan, fit, zoomBy, onWheel, toContentMm }
}
