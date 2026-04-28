import type { PlansetRoofFace, PlansetString } from '@/lib/planset-types'
import { polygonToSvgPath, insetPolygon, polygonCentroid, isValidPolygon } from '@/lib/planset-polygons'

interface Props {
  faces: PlansetRoofFace[]
  strings: PlansetString[]
  width: number
  height: number
}

// Inset multipliers differ per edge type so multiple bands are visually
// distinct. Hoisted to module scope so each render doesn't re-allocate.
const SETBACK_CFG = [
  { kind: 'ridge', insetFactor: 0.04, stroke: '#c33' },
  { kind: 'eave',  insetFactor: 0.06, stroke: '#c63' },
  { kind: 'rake',  insetFactor: 0.08, stroke: '#996' },
] as const

// Cap how many per-string label rows render before collapsing to overflow
// indicator. Keeps dense roof faces (8+ strings) from pushing labels off
// the polygon and into adjacent faces.
const MAX_STRING_LABELS = 4

/**
 * Renders roof planes as SVG polygons with fire-setback hatching, walking-
 * ridge labels, per-string callouts, and azimuth/tilt annotations.
 *
 * Polygons are in normalized 0–1 coordinate space; this component scales
 * them into the actual width × height viewBox.
 *
 * Faces with empty / invalid polygons are skipped (graceful fallback for
 * projects whose redesign tool hasn't drawn polygons yet).
 */
export function RoofPlaneSvg({ faces, strings, width, height }: Props) {
  const stringsByFace = new Map<number, PlansetString[]>()
  for (const s of strings) {
    if (!stringsByFace.has(s.roofFace)) stringsByFace.set(s.roofFace, [])
    stringsByFace.get(s.roofFace)!.push(s)
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {faces.map(face => {
        if (!isValidPolygon(face.polygon)) return null

        // Scale polygon from normalized 0–1 to actual viewBox units
        const scaledPoly = face.polygon.map(([x, y]) => [x * width, y * height] as [number, number])
        const path = polygonToSvgPath(scaledPoly)
        const [cx, cy] = polygonCentroid(scaledPoly)
        const facetStrings = stringsByFace.get(face.id) ?? []

        // pathClear label config
        const pathClear = face.setbacks.pathClear
        const pathLabelCfg =
          pathClear === 'walkable' ? { text: 'WALKABLE',         fill: '#080' } :
          pathClear === 'partial'  ? { text: 'PARTIAL ACCESS',   fill: '#a60' } :
                                     { text: 'BLOCKED — NO PATH', fill: '#c00' }

        return (
          <g key={face.id} data-face-id={face.id}>
            {/* Plane fill */}
            <path d={path} fill="#f5f5f5" stroke="#333" strokeWidth={1.5} />

            {/* Setback bands — one per active edge type, distinct inset + color */}
            {SETBACK_CFG.map(({ kind, insetFactor, stroke }) => {
              if (!face.setbacks[kind]) return null
              const insetPath = polygonToSvgPath(insetPolygon(scaledPoly, Math.min(width, height) * insetFactor))
              return (
                <path
                  key={kind}
                  d={insetPath}
                  data-setback={kind}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
              )
            })}

            {/* Walking-path marker — all three states */}
            <text x={cx} y={cy - 14} textAnchor="middle" fontSize={6} fill={pathLabelCfg.fill} fontWeight="bold">
              {pathLabelCfg.text}
            </text>

            {/* Roof label */}
            <text x={cx} y={cy} textAnchor="middle" fontSize={7} fontWeight="bold" fill="#222">
              ROOF #{face.id}
            </text>

            {/* Per-string label rows — capped so dense faces don't overflow */}
            {facetStrings.slice(0, MAX_STRING_LABELS).map((s, i) => (
              <text
                key={s.id}
                x={cx}
                y={cy + 10 + i * 8}
                textAnchor="middle"
                fontSize={5.5}
                fill="#333"
              >
                STRING {s.id} — {s.modules} MODULES
              </text>
            ))}
            {facetStrings.length > MAX_STRING_LABELS && (
              <text
                x={cx}
                y={cy + 10 + MAX_STRING_LABELS * 8}
                textAnchor="middle"
                fontSize={5.5}
                fill="#666"
                fontStyle="italic"
              >
                +{facetStrings.length - MAX_STRING_LABELS} more
              </text>
            )}

            {/* Azimuth / tilt callout (rows shown + overflow row when present) */}
            <text
              x={cx}
              y={cy + 10 + Math.min(facetStrings.length, MAX_STRING_LABELS) * 8 + (facetStrings.length > MAX_STRING_LABELS ? 8 : 0) + 8}
              textAnchor="middle"
              fontSize={5}
              fill="#666"
            >
              AZ {face.azimuth}° / TILT {face.tilt}°
            </text>
          </g>
        )
      })}
    </svg>
  )
}
