# LEAFIO POC — Merchandising demos

Graphics proof-of-concept for the [LEAFIO AI merchandising suite](https://www.leafio.ai/merchandising-software-solution/),
built on fake data. The point is to prove out the **visual** side — 2D planogram
editing, 3D fixture rendering, analytics overlays — not to build a product.
There is no backend, no persistence and no authentication.

| Module | Leafio equivalent | Status |
| --- | --- | --- |
| Shelf Space Optimization | `/micro-space-management/` | built |
| Store Layout Optimization | `/space-planning-software/` | next |
| Auto planogram generation | `/auto-planogram-generation/` | planned |
| Planogram compliance AI | `/ai-planogram-image-recognition/` | planned |

## Running it

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # core logic (packing, metrics, autofacing, generator)
pnpm build      # typecheck + production build
```

## What the first demo does

- **2D planogram editor** (`react-konva`) — drag facings between and along
  shelves, snap guides, per-shelf fill bars, overflow and does-not-fit warnings,
  wheel zoom, undo/redo.
- **3D fixture view** (`react-three-fiber`) — the same planogram as boxes on a
  lit bay, orbit controls, front/three-quarter/top presets, click to select.
- **Analytics overlays** — colour facings by sales, margin, ABC, turnover or
  days of supply, in both views at once, with KPI tiles and a per-shelf chart.
- **Autofacing** — reallocates facings across every shelf towards a chosen
  objective, previewed as a diff before you apply it.

## How it is put together

```
src/
├── core/        pure domain logic, no React — the only place with unit tests
│   ├── model.ts       store -> fixture -> shelf -> facing -> SKU
│   ├── rng.ts         seeded PRNG; one seed rebuilds one store exactly
│   ├── catalog.ts     brand/line/format tables the generator combines
│   ├── generate.ts    scenario generator (catalogue + fixture + planogram)
│   ├── packing.ts     shelf layout, hit-testing, reorder
│   ├── metrics.ts     capacity, days of supply, service level, KPIs
│   ├── colors.ts      one colour source shared by both renderers
│   └── autofacing.ts  space-aware facing allocation
├── state/       zustand store + zundo undo/redo
├── ui/          shared chrome primitives
└── modules/shelf-space/{canvas2d,canvas3d,panels}
```

Three rules hold the thing together:

1. **Millimetres everywhere.** Renderers convert at their boundary and nowhere
   else — 2D multiplies by a px/mm scale, 3D divides by 1000 to get metres.
2. **2D and 3D are two renderers over one store.** Switching view keeps
   selection, colours and layout, because there is nothing to convert.
3. **Array order is row order.** `layoutShelf` assigns `x` from the array order
   it is given and never re-sorts, so a reorder cannot be undone by a stale `x`.

## Fake data

Everything is generated from a seed with `mulberry32`. Names are assembled from
per-category brand/line/variant/format tables ("Valcrest Cola Zero 1.5L"),
packaging dimensions come from the format, and demand follows a Pareto curve so
a fifth of the range carries most of the volume. Change the seed in the toolbar
to rebuild the store; the same seed always rebuilds it identically.

The starting planogram is deliberately *hand-built quality*: the range is spread
over the shelves that can physically take each product, then each row is evened
out until it is full. That flat allocation is what autofacing then improves on.
