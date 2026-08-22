import { memo, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

import { colorFor } from '@/core/colors'
import { facingFootprint, type Facing, type Fixture, type Shelf, type Sku } from '@/core/model'
import type { FacingStats } from '@/core/metrics'
import type { MetricScale } from '@/core/colors'
import { useMetricScale, usePlanogramStats, usePlanogramStore, useSkuIndex } from '@/state/planogramStore'
import { Segmented } from '@/ui/primitives'

/** Domain millimetres to three.js metres. */
const MM = 0.001

type CameraPreset = 'front' | 'angle' | 'top'

const SHELF_MATERIAL = { color: '#5b6b85', roughness: 0.75, metalness: 0.15 }
const FOV = 38

function FixtureMesh({ fixture }: { fixture: Fixture }) {
  const w = fixture.w * MM
  const h = fixture.h * MM
  const d = fixture.d * MM
  const upright = 0.055

  return (
    <group>
      {/* Back panel */}
      <mesh position={[0, h / 2, -d / 2]} receiveShadow>
        <boxGeometry args={[w + upright * 2, h, 0.02]} />
        <meshStandardMaterial color="#1b2637" roughness={0.9} />
      </mesh>

      {/* Uprights */}
      {[-(w / 2) - upright / 2, w / 2 + upright / 2].map((x) => (
        <mesh key={x} position={[x, h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[upright, h, d]} />
          <meshStandardMaterial {...SHELF_MATERIAL} color="#33425c" />
        </mesh>
      ))}

      {/* Base plinth */}
      <mesh position={[0, (fixture.shelves[0]?.y ?? 120) * MM * 0.5, 0]} receiveShadow>
        <boxGeometry args={[w, (fixture.shelves[0]?.y ?? 120) * MM, d * 0.92]} />
        <meshStandardMaterial color="#24324a" roughness={0.85} />
      </mesh>

      {fixture.shelves.map((shelf) => (
        <mesh
          key={shelf.id}
          position={[0, (shelf.y - shelf.thickness / 2) * MM, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[w, shelf.thickness * MM, shelf.depth * MM]} />
          <meshStandardMaterial {...SHELF_MATERIAL} />
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
          emissive={selected ? '#4ade80' : hovered ? '#ffffff' : '#000000'}
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
          <div className="tabular whitespace-nowrap rounded border border-ink-700 bg-ink-950/95 px-2 py-1 text-[10px] text-slate-200 shadow-lg">
            <div className="font-semibold">{sku.name}</div>
            <div className="text-slate-400">
              {facing.wide}×{facing.high} facings · {stats ? stats.capacity : 0} u ·{' '}
              {stats && Number.isFinite(stats.dos) ? `${stats.dos.toFixed(1)} d` : '—'}
            </div>
            {previewDelta !== 0 && (
              <div className={previewDelta > 0 ? 'text-leaf-400' : 'text-orange-400'}>
                autofacing: {facing.wide} → {facing.wide + previewDelta} facings
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
  const { camera } = useThree()
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)

  const { size } = useThree()
  const lookAt = useMemo(() => new THREE.Vector3(0, height * 0.48, 0), [height])

  const target = useMemo(() => {
    // Pull back far enough that the whole bay fits the actual canvas aspect,
    // not a guessed one — a 3.75 m run in a tall panel needs a lot more room.
    const vHalf = Math.tan((FOV * Math.PI) / 360)
    const hHalf = vHalf * (size.width / Math.max(size.height, 1))
    const distance =
      Math.max((width / 2 + 0.25) / hHalf, (height / 2 + 0.25) / vHalf) * 1.08

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

export default function Planogram3D() {
  const fixture = usePlanogramStore((s) => s.fixture)
  const facings = usePlanogramStore((s) => s.facings)
  const selectedFacingId = usePlanogramStore((s) => s.selectedFacingId)
  const preview = usePlanogramStore((s) => s.preview)
  const select = usePlanogramStore((s) => s.select)

  const skuIndex = useSkuIndex()
  const stats = usePlanogramStats()
  const scale = useMetricScale()

  const [preset, setPreset] = useState<CameraPreset>('angle')
  const width = fixture.w * MM
  const height = fixture.h * MM
  const span = Math.max(width, height)

  return (
    <div className="relative h-full w-full bg-ink-950">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: FOV, near: 0.05, far: span * 40, position: [span, height, span * 1.6] }}
        onPointerMissed={() => select(null)}
      >
        <color attach="background" args={['#070b12']} />
        <fog attach="fog" args={['#070b12', span * 4, span * 12]} />

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

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[span * 24, span * 24]} />
          <meshStandardMaterial color="#0b1119" roughness={1} />
        </mesh>
        <Grid
          args={[span * 24, span * 24]}
          cellSize={0.25}
          cellColor="#16202f"
          sectionSize={1}
          sectionColor="#1f2d42"
          fadeDistance={span * 10}
          infiniteGrid
          position={[0, 0.001, 0]}
        />

        <FixtureMesh fixture={fixture} />

        {facings.map((facing) => {
          const sku = skuIndex.get(facing.skuId)
          const shelf = fixture.shelves.find((s) => s.id === facing.shelfId)
          if (!sku || !shelf) return null
          return (
            <FacingMesh
              key={facing.id}
              facing={facing}
              sku={sku}
              shelf={shelf}
              fixture={fixture}
              color={colorFor(sku, facing, stats.perFacing.get(facing.id), scale as MetricScale)}
              selected={selectedFacingId === facing.id}
              dimmed={Boolean(selectedFacingId) && selectedFacingId !== facing.id}
              stats={stats.perFacing.get(facing.id)}
              previewWide={preview?.targets.get(facing.id)}
              onSelect={select}
            />
          )
        })}

        <CameraRig preset={preset} width={width} height={height} />
      </Canvas>

      <div className="absolute bottom-3 left-3">
        <Segmented
          size="sm"
          value={preset}
          onChange={setPreset}
          options={[
            { value: 'front', label: 'Front' },
            { value: 'angle', label: '3/4' },
            { value: 'top', label: 'Top' },
          ]}
        />
      </div>

      {preview && preview.changes.length > 0 && (
        <div className="pointer-events-none absolute left-3 top-3 rounded border border-leaf-500/40 bg-leaf-500/10 px-2 py-1 text-[10px] text-leaf-300">
          Autofacing preview · {preview.changes.length} changes — switch to 2D to review the diff
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 right-3 text-[10px] text-slate-600">
        drag to orbit · wheel to zoom · click a pack to select
      </div>
    </div>
  )
}
