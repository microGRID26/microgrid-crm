# SLD asset library

Static SVG assets for high-fidelity equipment internals on the planset SLD.

## Background

The procedural layout function (`lib/sld-layout.ts:calculateSldLayoutMicroInverter`) emits an `svg-asset` `SldElement` wherever an equipment box should render at AHJ-permit-ready CAD fidelity (Sonnen battery internals, Eaton disconnect interiors, panel boards, MSP, etc.). The renderer (`components/SldRenderer.tsx`) looks up the `assetId` in this directory's registry and renders the asset's React component at the given `(x, y, w, h)` position.

See the master plan at `~/.claude/plans/cozy-herding-quilt.md` for the full hybrid-renderer architecture and phase plan.

## Per-asset interface contract

Each asset is a TypeScript file exporting a React component:

```tsx
// components/planset/sld-assets/sonnen-score-p20.tsx
'use client'

export interface AssetProps {
  x: number
  y: number
  w: number
  h: number
  props?: Record<string, string | number>
}

export function SonnenScoreP20({ x, y, w, h, props }: AssetProps) {
  // Component renders an inline <g transform="translate(x,y) scale(scaleX, scaleY)">
  // wrapping the static SVG content drawn by Claude Design (or hand-edited from
  // her .svg deliverable). Optional `props` injects per-project overrides.
  return (
    <g transform={`translate(${x},${y}) scale(${w/360}, ${h/280})`}>
      {/* Static SVG content here, drawn at native 360×280 viewBox */}
    </g>
  )
}
```

## Registering an asset

Add an entry to `index.tsx`:

```tsx
import { SonnenScoreP20 } from './sonnen-score-p20'

export const ASSET_REGISTRY: Record<string, React.FC<AssetProps>> = {
  'sonnen-score-p20': SonnenScoreP20,
  // ...
}
```

The renderer (`components/SldRenderer.tsx`) imports `ASSET_REGISTRY` and dispatches by `assetId`.

## Per-asset workflow (Greg ↔ Claude Design ↔ Atlas)

1. **Atlas writes the asset spec** at `~/Desktop/asset-spec-<assetId>.md` — equipment model, native dimensions, content, anchor IDs, prop overrides.
2. **Greg sends spec + Tyson reference page** to Claude Design.
3. **Claude Design draws SVG** in Inkscape/Figma/hand-coded.
4. **Claude Design returns SVG file** → Greg drops in `~/Desktop/`.
5. **Atlas integrates**:
   - Convert raw SVG to React component at `components/planset/sld-assets/<assetId>.tsx`
   - Register in `index.tsx`
   - Replace procedural drawing in `calculateSldLayoutMicroInverter` with `{ type: 'svg-asset', assetId, x, y, w, h }`
   - Typecheck + screenshot test
6. **Iterate** until visual matches Tyson reference at print scale.

## Catalog (target — Phase 1+2)

| assetId | Equipment | Native size | Status |
|---|---|---|---|
| `sonnen-score-p20` | SonnenCore+ SCORE-P20 battery | 360×280 | not started |
| `eaton-dg222urb` | Eaton DG222URB 60A PV Disconnect | 100×130 | not started |
| `eaton-dg221urb` | Eaton DG221URB 30A ESS Disconnect | 100×130 | not started |
| `eaton-dg222nrb-fused` | Eaton DG222NRB 60A Customer Gen Disc, 2×45A fuses | 120×130 | not started |
| `brp12l125r` | Eaton BRP12L125R PV Load Center | 130×140 | not started |
| `brp20b125r` | Eaton BRP20B125R Protected Load Panel | 140×160 | not started |
| `msp-225a-residential` | 225A residential MSP | 150×170 | not started |
| `nema3-junction-box` | 600V NEMA 3 junction box | 80×70 | not started |
| `bidirectional-meter` | (E) bi-directional utility meter | 90×120 | not started |
| `gec-ground-assembly` | GEC + grounding electrode | 140×100 | not started |
| `dpcrgm-cell` | Duracell DTU PC-PRO-C | 130×80 | not started |
| `ethernet-switch` | 5-port ethernet switch | 100×40 | not started |
| `homeowner-router` | Generic home router | 100×40 | not started |
| `sonnen-production-ct` | Sonnen production CT (dashed-tap) | 30×30 | not started |
| `dpc-rgm-cts` | DPC RGM CTs (dashed-tap) | 30×30 | not started |

Live status tracked in `notes/planset-asset-library.md`.
