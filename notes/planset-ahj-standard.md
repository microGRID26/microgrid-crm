# Planset AHJ-permit-ready standard

> Set by Greg, 2026-04-30. Standing rule: every planset sheet redesign going forward must hit this bar.

## The bar

A Houston AHJ inspector would accept the rendered planset on first submittal.

**Reference standard:** Tyson PROJ-26922 Rev1 PDF — the as-built TriSMART/Hyperion/Sonnen planset, AHJ-approved Houston City. Drafted by Franz Joseph E. Tenorio, P.E.

A sheet meets the bar when it satisfies all of:

- Every NEC-required disconnect rendered as a discrete equipment box with model number + amp rating
- Every breaker rendered with amp rating + pole count
- Internal equipment details (battery cells, panel breakers, terminals) rendered at CAD fidelity
- Conductors numbered with circular tags keyed to the wire chart on PV-6
- NEC dimension callouts where required ("10' MAX," "3' clearance," etc.)
- Code reference annotations (NEC 250.52, 230.85, 705.12, etc.) inline with the elements they constrain
- All components prefixed `(E)`xisting / `(N)`ew per Tyson convention
- Scope summary panels (BATTERY SCOPE + system SCOPE)
- Sheet border + title block + engineer's stamp area + sheet number anchor (large, bottom-right)
- Color coding (green for AC power conductors, blue dashed for communications, cyan/teal for control or grounding, black for structure)
- Print-legible at 11×17 ANSI B at 100% scale (no font smaller than ~5pt rendered, no overlapping labels)

## Architecture — hybrid renderer

Pure procedural primitive emission (TypeScript building `<rect>`/`<line>`/`<text>` elements) cannot reach this bar economically. v1–v5 of `calculateSldLayoutMicroInverter` proved this — structural skeleton was correct but every equipment internal collapsed into illegible labeled rectangles.

**Hybrid renderer:**

| Layer | Owns | Location |
|---|---|---|
| Procedural (TypeScript) | Equipment positions, connecting wires + colors, conductor tag numbering + placement, scope/notes/title-block panels, wire-spec annotation text | `lib/sld-layout.ts` |
| Renderer (React/SVG) | SVG element dispatch, viewBox, asset embedding | `components/SldRenderer.tsx` |
| Static SVG assets | Component internals (Sonnen, Eaton disconnects, panel boards, MSP, etc.) | `components/planset/sld-assets/*.tsx` |
| Asset author | Drafts each asset at native dimensions in Inkscape/Figma/hand-coded SVG | Claude Design (separate Claude window, via Greg-as-relay) |

The procedural function emits an `svg-asset` `SldElement` wherever an equipment box should render. The renderer looks up `assetId` in the registry and embeds the asset at `(x, y, w, h)`.

## Per-asset specification template

When commissioning a new asset from Claude Design, Atlas writes a spec containing:

1. **Equipment model + manufacturer** (e.g., "Eaton DG222URB PV Disconnect, 60A 2P 240V NEMA 3R")
2. **Native SVG viewBox dimensions** (e.g., 100×130 native units)
3. **Tyson reference page** with screenshot or page number
4. **Required visual elements** itemized
5. **Anchor point IDs** for procedural wire entry/exit (e.g., `id="anchor-line-l1"`, `id="anchor-load-l2"`, `id="anchor-ground"`)
6. **Prop overrides** — fields that vary per-project, injected by procedural code (e.g., `<text id="amp-label">{60}A</text>` overridden per call site)
7. **Color palette** — match Tyson exactly
8. **Deliverable path** — `repo-patches-vN/sld-assets/<assetId>.svg`

## Per-sheet workflow

For each sheet redesign (PV-1 cover, PV-3 site plan, PV-5 SLD, etc.):

1. Audit current sheet against this standard — what's missing
2. Identify which gaps are *layout* (procedural) vs *component fidelity* (asset-authored)
3. For every component-fidelity gap, commission an asset from Claude Design
4. Drop assets into `components/planset/sld-assets/` (for SLD) or per-sheet asset dirs (for other sheets)
5. Procedural code emits `svg-asset` elements at the right positions
6. Print-test the rendered output at 11×17 — verify legibility
7. Optional: informal Houston AHJ review before declaring sheet "ready"

## Tracking

- **Master plan:** `~/.claude/plans/cozy-herding-quilt.md`
- **Asset library status:** `notes/planset-asset-library.md`
- **Topology branching reference:** `notes/topology-sensitive-sheets.md`
- **Per-sheet redesign progress:** add entries to this doc as each sheet ships

## What "AHJ-permit-ready" is NOT

- A polished marketing diagram
- A simplified system-flow chart
- An infographic for non-technical audiences

If we want a Mark-the-CEO-friendly visual summary of a project, that's a separate artifact (a "system overview" diagram), not the planset SLD. Do not conflate them.
