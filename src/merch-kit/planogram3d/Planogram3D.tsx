import { memo, useMemo, useRef, useState, type ComponentRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useEffect } from 'react'

import { ControlButton, ControlGroup, Hint, overlayBase } from '../chrome'
import { buildScale, colorFor } from '../colors'
import { planogramStats, type FacingStats } from '../metrics'
import { byId, facingFootprint, type Facing, type Fixture, type Shelf, type Sku } from '../model'
import { resolveTheme, type PlanogramTheme } from '../theme'
import type { PlanogramViewProps } from '../types'

/** Domain millimetres to three.js metres. */
const MM = 0.001
const FOV = 38

export type CameraPreset = 'front' | 'angle' | 'top'

export const CAMERA_PRESETS: { value: CameraPreset; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'angle', label: '3/4' },
  { value: 'top', label: 'Top' },
]

export type Planogram3DProps = PlanogramViewProps & {
  /** Controlled camera preset. Leave unset to let the view manage its own. */
  cameraPreset?: CameraPreset
  onCameraPresetChange?: (preset: CameraPreset) => void
  /** Rendered over the canvas, top left — for host badges and notices. */
  overlay?: React.ReactNode
}

function FixtureMesh({ fixture, theme }: { fixture: Fixture; theme: PlanogramTheme }) {
  const w = fixture.w * MM
  const h = fixture.h * MM
  const d = fixture.d * MM
  const upright = 0.055
  const plinth = (fixture.shelves[0]?.y ?? 120) * MM

  return (
    <group>
      <mesh position={[0, h / 2, -d / 2]} receiveShadow>
        <boxGeometry args={[w + upright * 2, h, 0.02]} />
        <meshStandardMaterial color={theme.fixture.back} roughness={0.9} />
      </mesh>

      {[-(w / 2) - upright / 2, w / 2 + upright / 2].map((x) => (
        <mesh key={x} position={[x, h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[upright, h, d]} />
          <meshStandardMaterial color={theme.fixture.upright} roughness={0.75} metalness={0.15} />
        </mesh>
      ))}

      <mesh position={[0, plinth / 2, 0]} receiveShadow>
        <boxGeometry args={[w, plinth, d * 0.92]} />
        <meshStandardMaterial color={theme.fixture.plinth} roughness={0.85} />
      </mesh>

      {fixture.shelves.map((shelf) => (
        <mesh
          key={shelf.id}
          position={[0, (shelf.y - shelf.thickness / 2) * MM, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[w, shelf.thickness * MM, shelf.depth * MM]} />
          <meshStandardMaterial
            color={theme.fixture.shelfBoard}
            roughness={0.75}
            metalness={0.15}
          />
        </mesh>
      ))}
    </group>
  )
}

type FacingMeshProps = {
  facing: Facing
  sku: Sku
  shelf: Shelf
  fixture: Fixture
  color: string
  theme: PlanogramTheme
  selected: boolean
  dimmed: boolean
  stats?: FacingStats
  previewWide?: number
  onSelect: (id: string) => void
}

function FacingMeshImpl({
  facing,
  sku,
  shelf,
  fixture,
  color,
  theme,
  selected,
  dimmed,
  stats,
  previewWide,
  onSelect,
}: FacingMeshProps) {
  const [hovered, setHovered] = useState(false)
  const box = facingFootprint(facing, sku)

  const w = box.width * MM
  const h = box.height * MM
  const d = box.depth * MM

  // Products sit flush with the front edge of the shelf.
  const x = (-fixture.w / 2 + facing.x) * MM + w / 2
  const y = shelf.y * MM + h / 2
  const z = (fixture.d / 2) * MM - d / 2 - 0.01

  const previewDelta =
    previewWide !== undefined && previewWide !== facing.wide ? previewWide - facing.wide : 0

  return (
    <group position={[x, y, z]}>
      <mesh
        castShadow
        receiveShadow
        onClick={(event) => {
          event.stopPropagation()
          onSelect(facing.id)
        }}
        onPointerOver={(event) => {
          event.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'default'
        }}
      >
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color={color}
          roughness={0.55}
          metalness={0.05}
          transparent={dimmed}
          opacity={dimmed ? 0.28 : 1}
          emissive={selected ? theme.accent : hovered ? '#ffffff' : '#000000'}
          emissiveIntensity={selected ? 0.35 : hovered ? 0.12 : 0}
        />
      </mesh>

      {/* Label band on the front face. */}
      <mesh position={[0, 0, d / 2 + 0.001]}>
        <planeGeometry args={[w * 0.86, Math.min(h * 0.3, 0.055)]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={dimmed ? 0.06 : 0.18} />
      </mesh>

      {(hovered || selected) && (
        <Html
          position={[0, h / 2 + 0.05, d / 2]}
          center
          distanceFactor={3}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              whiteSpace: 'nowrap',
              borderRadius: 4,
              border: `1px solid ${theme.surfaceBorder}`,
              background: theme.surface,
              padding: '4px 7px',
              fontSize: 10,
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              color: theme.text,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <div style={{ fontWeight: 600 }}>{sku.name}</div>
            <div style={{ color: theme.textMuted }}>
              {facing.wide}×{facing.high} facings · {stats ? stats.capacity : 0} u ·{' '}
              {stats && Number.isFinite(stats.dos) ? `${stats.dos.toFixed(1)} d` : '—'}
            </div>
            {previewDelta !== 0 && (
              <div style={{ color: previewDelta > 0 ? theme.increase : theme.decrease }}>
                target: {facing.wide} → {facing.wide + previewDelta} facings
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

const FacingMesh = memo(FacingMeshImpl)

function CameraRig({
  preset,
  width,
  height,
}: {
  preset: CameraPreset
  width: number
  height: number
}) {
  const { camera, size } = useThree()
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const lookAt = useMemo(() => new THREE.Vector3(0, height * 0.48, 0), [height])

  const target = useMemo(() => {
    // Pull back far enough that the whole bay fits the actual canvas aspect,
    // not a guessed one — a wide run in a tall panel needs a lot more room.
    const vHalf = Math.tan((FOV * Math.PI) / 360)
    const hHalf = vHalf * (size.width / Math.max(size.height, 1))
    const distance = Math.max((width / 2 + 0.25) / hHalf, (height / 2 + 0.25) / vHalf) * 1.08

    const direction = {
      front: new THREE.Vector3(0, 0.1, 1),
      angle: new THREE.Vector3(0.62, 0.4, 0.78),
      top: new THREE.Vector3(0, 0.95, 0.32),
    }[preset]

    return lookAt.clone().add(direction.normalize().multiplyScalar(distance))
  }, [preset, width, height, size.width, size.height, lookAt])

  const animating = useRef(true)

  useEffect(() => {
    animating.current = true
  }, [preset])

  useFrame(() => {
    if (!animating.current) return
    camera.position.lerp(target, 0.12)
    controls.current?.target.lerp(lookAt, 0.12)
    controls.current?.update()
    if (camera.position.distanceTo(target) < 0.01) animating.current = false
  })

  return (
    <OrbitControls
      ref={controls}
      enableDamping
      dampingFactor={0.08}
      minDistance={0.5}
      maxDistance={Math.max(width, height) * 6}
      maxPolarAngle={Math.PI / 2 - 0.02}
      onStart={() => {
        animating.current = false
      }}
    />
  )
}

/**
 * The same planogram as a lit 3D bay. Shares every input with `Planogram2D`,
 * so a host can toggle between them without converting anything.
 */
export function Planogram3D({
  fixture,
  facings,
  skus,
  metric = 'none',
  selectedFacingId = null,
  preview = null,
  theme: themeOverride,
  getFacingColor,
  onSelect,
  cameraPreset,
  onCameraPresetChange,
  controls = true,
  hints = true,
  overlay,
  className,
  style,
}: Planogram3DProps) {
  const theme = useMemo(() => resolveTheme(themeOverride), [themeOverride])
  const skuIndex = useMemo(() => (skus instanceof Map ? skus : byId(skus as Sku[])), [skus])
  const stats = useMemo(
    () => planogramStats(fixture, facings, skuIndex),
    [fixture, facings, skuIndex],
  )
  const scaleInfo = useMemo(() => buildScale(metric, stats.perFacing.values()), [metric, stats])

  const [internalPreset, setInternalPreset] = useState<CameraPreset>('angle')
  const preset = cameraPreset ?? internalPreset
  const setPreset = (next: CameraPreset) => {
    setInternalPreset(next)
    onCameraPresetChange?.(next)
  }

  const width = fixture.w * MM
  const height = fixture.h * MM
  const span = Math.max(width, height)

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: theme.background,
        ...style,
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: FOV, near: 0.05, far: span * 40, position: [span, height, span * 1.6] }}
        onPointerMissed={() => onSelect?.(null)}
      >
        <color attach="background" args={[theme.background]} />
        <fog attach="fog" args={[theme.background, span * theme.scene.fogNear, span * theme.scene.fogFar]} />

        <ambientLight intensity={0.85} />
        <directionalLight
          position={[span * 1.2, span * 2.2, span * 1.6]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-span * 2}
          shadow-camera-right={span * 2}
          shadow-camera-top={span * 2}
          shadow-camera-bottom={-span * 2}
        />
        <directionalLight position={[-span, span, -span]} intensity={0.35} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[span * 24, span * 24]} />
          <meshStandardMaterial color={theme.scene.floor} roughness={1} />
        </mesh>
        <Grid
          args={[span * 24, span * 24]}
          cellSize={0.25}
          cellColor={theme.scene.grid}
          sectionSize={1}
          sectionColor={theme.scene.gridSection}
          fadeDistance={span * 10}
          infiniteGrid
          position={[0, 0.001, 0]}
        />

        <FixtureMesh fixture={fixture} theme={theme} />

        {facings.map((facing) => {
          const sku = skuIndex.get(facing.skuId)
          const shelf = fixture.shelves.find((s) => s.id === facing.shelfId)
          if (!sku || !shelf) return null
          const facingStats = stats.perFacing.get(facing.id)
          return (
            <FacingMesh
              key={facing.id}
              facing={facing}
              sku={sku}
              shelf={shelf}
              fixture={fixture}
              theme={theme}
              color={
                getFacingColor?.(sku, facing, facingStats) ??
                colorFor(sku, facing, facingStats, scaleInfo)
              }
              selected={selectedFacingId === facing.id}
              dimmed={Boolean(selectedFacingId) && selectedFacingId !== facing.id}
              stats={facingStats}
              previewWide={preview?.get(facing.id)}
              onSelect={(id) => onSelect?.(id)}
            />
          )
        })}

        <CameraRig preset={preset} width={width} height={height} />
      </Canvas>

      {overlay && <div style={{ ...overlayBase(theme), left: 12, top: 12 }}>{overlay}</div>}

      {controls && (
        <div style={{ ...overlayBase(theme), left: 12, bottom: 12 }}>
          <ControlGroup theme={theme}>
            {CAMERA_PRESETS.map((option) => (
              <ControlButton
                key={option.value}
                theme={theme}
                title={`${option.label} view`}
                active={preset === option.value}
                onClick={() => setPreset(option.value)}
              >
                {option.label}
              </ControlButton>
            ))}
          </ControlGroup>
        </div>
      )}

      {hints && <Hint theme={theme}>drag to orbit · wheel to zoom · click a pack to select</Hint>}
    </div>
  )
}

export default Planogram3D
