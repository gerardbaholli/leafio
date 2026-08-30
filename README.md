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
pnpm test       # kit geometry/KPIs, the boundary guard, and the demo generator
pnpm build      # typecheck + production build
```

## Deploying

Pushing to `main` publishes to GitHub Pages via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
`pnpm test` runs first, so a change that breaks the kit's portability guard
stops the deploy instead of shipping. Live at
<https://gerardbaholli.github.io/leafio/>.

`base: './'` in [vite.config.ts](vite.config.ts) is what makes the same build
work at the domain root and under `/leafio/`. Safe here because the demo is a
single page with no client-side routing — with a router it would need the
explicit `/leafio/` path instead.

Enabling it once, on GitHub: **Settings → Pages → Source: GitHub Actions**.

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

The repository is split in two zones, and the split is the point: the graphics
are meant to be liftable into another project, the demo around them is not.

```
src/
├── merch-kit/   PORTABLE — copy this folder and it works elsewhere
│   ├── model.ts        fixture -> shelf -> facing -> SKU, millimetres
│   ├── packing.ts      shelf layout, hit-testing, reorder
│   ├── metrics.ts      capacity, days of supply, service level, KPIs
│   ├── colors.ts       the metric ramps both renderers share
│   ├── theme.ts        every colour the canvases draw, in one object
│   ├── types.ts        the public props
│   ├── chrome.tsx      inline-styled floating UI (no CSS framework)
│   ├── planogram2d/    Konva front elevation
│   ├── planogram3d/    three.js bay
│   └── __tests__/      standalone tests + the boundary guard
│
├── demo/        NOT portable — this app, wrapped around the kit
│   ├── data/           seeded fake-data generator (rng, catalog, generate)
│   ├── autofacing.ts   space-aware facing allocation
│   ├── state/          zustand + zundo undo/redo
│   ├── ui/             Tailwind panel primitives
│   └── shelf-space/    toolbar, side panels, and PlanogramCanvas — the one
│                       file that talks to the kit
└── App.tsx
```

[`src/merch-kit/README.md`](src/merch-kit/README.md) documents the kit's API and
how to take it somewhere else.

Four rules hold the thing together:

1. **Millimetres everywhere.** Renderers convert at their boundary and nowhere
   else — 2D multiplies by a px/mm scale, 3D divides by 1000 to get metres.
2. **2D and 3D are two renderers over one state.** Switching view keeps
   selection, colours and layout, because there is nothing to convert.
3. **Array order is row order.** `layoutShelf` assigns `x` from the array order
   it is given and never re-sorts, so a reorder cannot be undone by a stale `x`.
4. **The kit never imports the app.** `src/merch-kit/__tests__/boundary.test.ts`
   fails the build if a kit file reaches for the `@/` alias, escapes its folder,
   pulls in zustand/recharts/lucide, or styles with a utility class. The
   portability claim is enforced, not just asserted.

## Fake data

Everything is generated from a seed with `mulberry32`. Names are assembled from
per-category brand/line/variant/format tables ("Valcrest Cola Zero 1.5L"),
packaging dimensions come from the format, and demand follows a Pareto curve so
a fifth of the range carries most of the volume. Change the seed in the toolbar
to rebuild the store; the same seed always rebuilds it identically.

The starting planogram is deliberately *hand-built quality*: the range is spread
over the shelves that can physically take each product, then each row is evened
out until it is full. That flat allocation is what autofacing then improves on.
