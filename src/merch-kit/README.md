# merch-kit

The 2D and 3D merchandising canvases, packaged so they can be lifted out of this
demo and dropped into another application.

Everything under this folder is self-contained. Nothing here imports from the
demo app, from a state library, or from a CSS framework — a boundary test
([`__tests__/boundary.test.ts`](__tests__/boundary.test.ts)) fails the build if
that ever stops being true.

## Three entry points

| Import | Contains | Costs you |
| --- | --- | --- |
| `merch-kit` | model, shelf geometry, KPIs, colours, theme | nothing but React types |
| `merch-kit/planogram2d` | the front-elevation editor | `konva`, `react-konva` |
| `merch-kit/planogram3d` | the lit 3D bay | `three`, `@react-three/fiber`, `@react-three/drei` |

The barrel is **headless on purpose**: it does not re-export the renderers. A
single static re-export there would pull three.js into whatever imports the
domain and quietly defeat any attempt to lazy-load the 3D view. Keeping them
apart is what lets a host do this and mean it:

```tsx
const Planogram3D = lazy(() => import('./merch-kit/planogram3d'))
```

## Taking it somewhere else

1. Copy `src/merch-kit/` into the target project.
2. Install what you actually use:

   ```bash
   pnpm add react react-dom                                  # always
   pnpm add konva react-konva                                # for planogram2d
   pnpm add three @react-three/fiber @react-three/drei       # for planogram3d
   ```

3. Feed it your own data in the shape of [`model.ts`](model.ts).

There is nothing else: no build step, no global stylesheet, no provider to
mount, no context to wrap around it.

## Using it

Both views are **controlled components**. State goes in as props, user intent
comes out as callbacks — the kit never mutates the planogram it is handed.

```tsx
import { byId, insertIndexAt, placeFacing } from './merch-kit'
import { Planogram2D } from './merch-kit/planogram2d'

function Editor() {
  const [facings, setFacings] = useState(initialFacings)
  const [selected, setSelected] = useState<string | null>(null)
  const index = useMemo(() => byId(skus), [skus])

  return (
    <Planogram2D
      fixture={fixture}
      facings={facings}
      skus={skus}
      metric="margin"
      selectedFacingId={selected}
      onSelect={setSelected}
      onMoveFacing={({ facingId, shelfId, x }) => {
        const row = facings.filter((f) => f.shelfId === shelfId)
        const at = insertIndexAt(row, index, x, facingId)
        setFacings(placeFacing(facings, index, facingId, shelfId, at))
      }}
    />
  )
}
```

`Planogram3D` takes the same props, so switching views is a one-line swap and
loses nothing — same selection, same colours, same layout. See
[`src/demo/shelf-space/PlanogramCanvas.tsx`](../demo/shelf-space/PlanogramCanvas.tsx)
for the whole integration, which is the only file in the demo that touches the
kit.

### Props

| Prop | Purpose |
| --- | --- |
| `fixture`, `facings`, `skus` | The planogram to draw. `skus` accepts a list or a prebuilt `Map`. |
| `metric` | Colours facings by `sales`, `margin`, `abc`, `turnover`, `dos`, or `none` for packaging colours. |
| `selectedFacingId`, `onSelect` | Selection, controlled by the host. |
| `preview` | `Map<facingId, targetWide>` drawn as ghost outlines — for showing a pending optimisation before it is applied. |
| `theme` | Partial override of [`theme.ts`](theme.ts). Every colour the canvases draw comes from there. |
| `getFacingColor` | Bypasses the built-in metric ramp entirely, for hosts with their own analytics. |
| `controls`, `hints` | Turn off the built-in floating UI and supply your own. |
| `onMoveFacing` *(2D)* | A facing was dragged to a new shelf and position. |
| `onDropSku` *(2D)* | A SKU was dragged in from outside the canvas, via HTML drag and drop with the `application/x-sku` payload (`dropMimeType` to change it). |
| `cameraPreset`, `onCameraPresetChange` *(3D)* | Optional controlled camera; unset means the view manages its own. |
| `overlay` *(3D)* | Host content rendered over the canvas, top left. |

## What is in here, and what is not

Included, because the views need it to draw and to stay internally consistent:

- `model.ts` — fixture → shelf → facing → SKU, all dimensions in **millimetres**
- `packing.ts` — shelf layout, hit-testing, reorder; the host mutates planograms through these
- `metrics.ts` — capacity, days of supply, service level, per-shelf and total KPIs
- `colors.ts` — the metric ramps both renderers share
- `theme.ts` — every colour, in one object

Deliberately **not** included, because they are the demo's business, not the
canvas's: fake-data generation, the autofacing algorithm, the zustand store, the
side panels, and anything Tailwind.

## Two rules to keep

1. **Millimetres everywhere.** Renderers convert at their boundary and nowhere
   else — 2D multiplies by a px/mm scale, 3D divides by 1000 to get metres.
2. **Array order is row order.** `layoutShelf` assigns `x` from the array order
   it is given and never re-sorts; a facing spliced into a new position still
   carries its old `x`, and sorting would silently undo the reorder.
