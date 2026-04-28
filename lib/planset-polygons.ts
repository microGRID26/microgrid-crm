/**
 * Pure math helpers for roof-plane polygons used by the planset PV-3 renderer.
 *
 * All polygons are arrays of [x, y] points in normalized 0–1 coordinate space
 * (top-left origin, matching SVG conventions). The renderer scales these into
 * the actual SVG viewBox dimensions.
 */
export type Point = [number, number]
export type Polygon = Point[]

const EPS = 1e-9
const COORD_DEDUP_DECIMALS = 5

/** True if polygon is a closed loop with >= 3 distinct vertices */
export function isValidPolygon(p: Polygon): boolean {
  if (p.length < 3) return false
  // Round before key-stringification so '0.10' and '0.1' (and FP drift) collapse
  // to the same key. Without this, a designer who edits the same vertex twice
  // and ends up at a numerically-equivalent coord can produce two "distinct"
  // entries in the dedup set.
  const distinct = new Set(
    p.map(([x, y]) => `${x.toFixed(COORD_DEDUP_DECIMALS)},${y.toFixed(COORD_DEDUP_DECIMALS)}`)
  )
  return distinct.size >= 3
}

/**
 * Signed area of polygon under the shoelace formula. Positive in math CCW,
 * negative in math CW. Useful for detecting winding and for the area-centroid.
 */
export function polygonSignedArea(p: Polygon): number {
  if (p.length < 3) return 0
  let sum = 0
  for (let i = 0; i < p.length; i++) {
    const [xi, yi] = p[i]
    const [xj, yj] = p[(i + 1) % p.length]
    sum += xi * yj - xj * yi
  }
  return sum / 2
}

/**
 * Area-weighted centroid of polygon (NOT vertex average). Real roofs are
 * typically not symmetric in vertex distribution — an L-shaped face can have
 * three vertices on the long arm and three on the short, and a vertex average
 * drifts toward the dense side. The signed-area formula gives the geometric
 * center that label placement and inset-direction should be relative to.
 *
 * Falls back to the vertex average when the polygon is degenerate (collinear
 * vertices → zero signed area), since the area formula is undefined there.
 */
export function polygonCentroid(p: Polygon): Point {
  if (p.length === 0) return [0, 0]
  if (p.length === 1) return [p[0][0], p[0][1]]

  const a = polygonSignedArea(p)
  if (Math.abs(a) < EPS) {
    // Degenerate / collinear → fall back to vertex average.
    let sx = 0
    let sy = 0
    for (const [x, y] of p) {
      sx += x
      sy += y
    }
    return [sx / p.length, sy / p.length]
  }

  let cx = 0
  let cy = 0
  for (let i = 0; i < p.length; i++) {
    const [xi, yi] = p[i]
    const [xj, yj] = p[(i + 1) % p.length]
    const cross = xi * yj - xj * yi
    cx += (xi + xj) * cross
    cy += (yi + yj) * cross
  }
  const factor = 1 / (6 * a)
  return [cx * factor, cy * factor]
}

/**
 * Inset polygon by `delta` units inward (toward the interior). Used to draw
 * the dashed setback band INSIDE the plane outline. Negative delta produces
 * an outset.
 *
 * Uses per-edge perpendicular offset + line-intersection — the correct method
 * for non-convex polygons. The earlier centroid-radial method produced
 * bowtie self-intersections on L-shapes and any concave roof face.
 *
 * Polygons with fewer than 3 points or delta=0 are returned unchanged.
 */
export function insetPolygon(p: Polygon, delta: number): Polygon {
  if (p.length < 3 || delta === 0) return p

  // Inward direction depends on winding. In screen-Y-down coords:
  //  signed area > 0 → math CCW → inward = LEFT of edge direction.
  //  signed area < 0 → math CW  → inward = RIGHT of edge direction.
  const area = polygonSignedArea(p)
  if (Math.abs(area) < EPS) return p // degenerate; caller should isValidPolygon-gate
  const ccw = area > 0
  const inwardSign = ccw ? 1 : -1

  // Per-edge offset lines: each edge i is shifted by delta * inward_normal_i.
  // Then the new vertex i is the intersection of offset edge (i-1) and
  // offset edge i.
  const n = p.length

  /** Edge i: from p[i] to p[(i+1) % n]. Returns origin point + direction. */
  const edge = (i: number): { o: Point; d: Point; len: number } => {
    const [x0, y0] = p[i]
    const [x1, y1] = p[(i + 1) % n]
    const dx = x1 - x0
    const dy = y1 - y0
    const len = Math.hypot(dx, dy)
    return { o: [x0, y0], d: [dx, dy], len }
  }

  /**
   * Inward unit normal of an edge. Left-perp of (dx, dy) is (-dy, dx);
   * right-perp is (dy, -dx). Multiply by inwardSign to pick the side.
   */
  const inwardNormal = (e: { d: Point; len: number }): Point => {
    if (e.len < EPS) return [0, 0]
    const [dx, dy] = e.d
    return [(-dy / e.len) * inwardSign, (dx / e.len) * inwardSign]
  }

  // 2D line intersection. Lines defined by point + direction.
  // P = a.o + t*a.d  =  b.o + s*b.d
  // Returns null if lines are parallel (det ≈ 0).
  const intersect = (
    a: { o: Point; d: Point },
    b: { o: Point; d: Point }
  ): Point | null => {
    const det = a.d[0] * (-b.d[1]) - (-b.d[0]) * a.d[1]
    if (Math.abs(det) < EPS) return null
    const dx = b.o[0] - a.o[0]
    const dy = b.o[1] - a.o[1]
    const t = (dx * -b.d[1] - (-b.d[0]) * dy) / det
    return [a.o[0] + t * a.d[0], a.o[1] + t * a.d[1]]
  }

  const out: Polygon = []
  for (let i = 0; i < n; i++) {
    const prev = edge((i - 1 + n) % n)
    const curr = edge(i)

    if (prev.len < EPS || curr.len < EPS) {
      // Zero-length adjacent edge — keep the original vertex. Better to
      // render a tight band than to NaN-explode the SVG.
      out.push([p[i][0], p[i][1]])
      continue
    }

    const nPrev = inwardNormal(prev)
    const nCurr = inwardNormal(curr)

    // Offset line for prev: passes through prev.o + delta*nPrev, direction prev.d
    const aLine = { o: [prev.o[0] + nPrev[0] * delta, prev.o[1] + nPrev[1] * delta] as Point, d: prev.d }
    const bLine = { o: [curr.o[0] + nCurr[0] * delta, curr.o[1] + nCurr[1] * delta] as Point, d: curr.d }

    const x = intersect(aLine, bLine)
    if (x) {
      out.push(x)
    } else {
      // Parallel adjacent edges (rare, e.g. straight pass-through vertex).
      // Fall back to the offset of the shared endpoint along the bisector
      // direction, which for parallel edges is just one normal's offset.
      out.push([p[i][0] + nCurr[0] * delta, p[i][1] + nCurr[1] * delta])
    }
  }

  return out
}

/** SVG path string from polygon points (closed loop, M/L/Z form) */
export function polygonToSvgPath(p: Polygon): string {
  if (p.length === 0) return ''
  return `M ${p[0][0]} ${p[0][1]} ` + p.slice(1).map(([x, y]) => `L ${x} ${y}`).join(' ') + ' Z'
}
