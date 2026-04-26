/**
 * Pure math helpers for roof-plane polygons used by the planset PV-3 renderer.
 *
 * All polygons are arrays of [x, y] points in normalized 0–1 coordinate space
 * (top-left origin, matching SVG conventions). The renderer scales these into
 * the actual SVG viewBox dimensions.
 */
export type Point = [number, number]
export type Polygon = Point[]

/** True if polygon is a closed loop with >= 3 distinct vertices */
export function isValidPolygon(p: Polygon): boolean {
  if (p.length < 3) return false
  const distinct = new Set(p.map(([x, y]) => `${x},${y}`))
  return distinct.size >= 3
}

/** Average of polygon vertices — used for label placement and inset direction */
export function polygonCentroid(p: Polygon): Point {
  if (p.length === 0) return [0, 0]
  let sx = 0
  let sy = 0
  for (const [x, y] of p) {
    sx += x
    sy += y
  }
  return [sx / p.length, sy / p.length]
}

/**
 * Inset polygon by `delta` units toward its centroid. Used to draw the
 * dashed setback band INSIDE the plane outline. Negative delta produces an
 * outset (rare but valid).
 *
 * Polygons with fewer than 3 points or delta=0 are returned unchanged.
 */
export function insetPolygon(p: Polygon, delta: number): Polygon {
  if (p.length < 3 || delta === 0) return p
  const c = polygonCentroid(p)
  return p.map(([x, y]) => {
    const dx = x - c[0]
    const dy = y - c[1]
    const len = Math.hypot(dx, dy) || 1
    return [x - (dx / len) * delta, y - (dy / len) * delta] as Point
  })
}

/** SVG path string from polygon points (closed loop, M/L/Z form) */
export function polygonToSvgPath(p: Polygon): string {
  if (p.length === 0) return ''
  return `M ${p[0][0]} ${p[0][1]} ` + p.slice(1).map(([x, y]) => `L ${x} ${y}`).join(' ') + ' Z'
}
