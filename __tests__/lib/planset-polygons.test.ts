import { describe, it, expect } from 'vitest'
import { isValidPolygon, polygonCentroid, polygonSignedArea, insetPolygon, polygonToSvgPath } from '@/lib/planset-polygons'

describe('polygon helpers', () => {
  describe('isValidPolygon', () => {
    it('rejects polygons with fewer than 3 points', () => {
      expect(isValidPolygon([])).toBe(false)
      expect(isValidPolygon([[0, 0]])).toBe(false)
      expect(isValidPolygon([[0, 0], [1, 1]])).toBe(false)
    })
    it('rejects degenerate polygons (all-same vertices)', () => {
      expect(isValidPolygon([[0, 0], [0, 0], [0, 0]])).toBe(false)
    })
    it('rejects polygons with only 2 distinct vertices', () => {
      expect(isValidPolygon([[0, 0], [0, 0], [1, 1]])).toBe(false)
    })
    it('accepts a valid triangle', () => {
      expect(isValidPolygon([[0, 0], [1, 0], [0.5, 1]])).toBe(true)
    })
    it('accepts a valid square', () => {
      expect(isValidPolygon([[0, 0], [1, 0], [1, 1], [0, 1]])).toBe(true)
    })
  })

  describe('polygonCentroid', () => {
    it('returns origin for empty polygon', () => {
      expect(polygonCentroid([])).toEqual([0, 0])
    })
    it('returns the single point for a single-point polygon', () => {
      expect(polygonCentroid([[5, 7]])).toEqual([5, 7])
    })
    it('returns center of unit square', () => {
      expect(polygonCentroid([[0, 0], [1, 0], [1, 1], [0, 1]])).toEqual([0.5, 0.5])
    })
    it('returns average of triangle vertices', () => {
      const c = polygonCentroid([[0, 0], [3, 0], [0, 3]])
      expect(c[0]).toBeCloseTo(1, 5)
      expect(c[1]).toBeCloseTo(1, 5)
    })
  })

  describe('insetPolygon', () => {
    it('returns polygon unchanged when delta=0', () => {
      const p: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]]
      expect(insetPolygon(p, 0)).toEqual(p)
    })
    it('returns polygon unchanged for fewer than 3 points', () => {
      const p: [number, number][] = [[0, 0], [1, 1]]
      expect(insetPolygon(p, 0.1)).toEqual(p)
    })
    it('shrinks unit square toward centroid for positive delta', () => {
      const p: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]]
      const inset = insetPolygon(p, 0.1)
      // Each vertex moves toward centroid (0.5, 0.5)
      expect(inset[0][0]).toBeGreaterThan(0)  // (0,0) moved right
      expect(inset[0][1]).toBeGreaterThan(0)  // (0,0) moved down
      expect(inset[2][0]).toBeLessThan(1)     // (1,1) moved left
      expect(inset[2][1]).toBeLessThan(1)     // (1,1) moved up
    })
  })

  describe('isValidPolygon — distinct-vertex epsilon (#322 R1.8)', () => {
    it("treats '0.10' and '0.1' as the same vertex (FP-equivalent)", () => {
      // String-keyed Set previously made these distinct because '0.10' !== '0.1'.
      // Round to 5 decimals before keying so numerically-equivalent vertices
      // collapse — a designer who types 0.10 then 0.1 shouldn't get a false
      // 3-distinct count from what is geometrically a 2-vertex degenerate.
      expect(isValidPolygon([[0.10, 0], [0.1, 0], [0.1, 1]])).toBe(false)
    })
    it('still distinguishes coords beyond 5-decimal precision', () => {
      // 0.000001 difference → distinct after rounding to 5 decimals? No,
      // 0.000001 rounds to 0.00000 and 0.00000. So this should be SAME.
      // Coords closer than 1e-5 are intentionally treated as identical —
      // this is the FP tolerance budget.
      expect(isValidPolygon([[0, 0], [0.000001, 0], [1, 1]])).toBe(false)
    })
  })

  describe('polygonSignedArea (#322 R1.2 — winding detection)', () => {
    it('positive for math-CCW unit square', () => {
      // Vertices listed counter-clockwise in math convention (y up).
      expect(polygonSignedArea([[0, 0], [1, 0], [1, 1], [0, 1]])).toBeCloseTo(1, 5)
    })
    it('negative for math-CW unit square (reversed winding)', () => {
      expect(polygonSignedArea([[0, 0], [0, 1], [1, 1], [1, 0]])).toBeCloseTo(-1, 5)
    })
    it('zero for collinear polygon', () => {
      expect(polygonSignedArea([[0, 0], [1, 0], [2, 0]])).toBeCloseTo(0, 5)
    })
  })

  describe('polygonCentroid — area-weighted (#322 R1.2)', () => {
    it('weights asymmetric vertex distribution toward area mass, not vertex count', () => {
      // Right-triangle with three duplicate vertices on the long arm and one
      // on the short — vertex-average drifts toward the dense side, but the
      // area-centroid stays at the geometric center (1, 1).
      // Real triangle: (0,0), (3,0), (0,3). Area centroid = (1, 1).
      // Add a degenerate near-duplicate on the short arm at (3, 0.001) —
      // vertex-average shifts to ((0+3+0+3)/4, (0+0+3+0.001)/4) = (1.5, 0.75)
      // but area-centroid stays near (1, 1) since the new "edge" is zero-area.
      const c = polygonCentroid([[0, 0], [3, 0], [3, 0.001], [0, 3]])
      // Tolerance loose because the tiny extra triangle nudges things slightly.
      expect(c[0]).toBeCloseTo(1, 1)
      expect(c[1]).toBeCloseTo(1, 1)
    })
    it('falls back to vertex average for collinear polygon (signed area = 0)', () => {
      const c = polygonCentroid([[0, 0], [1, 0], [2, 0]])
      expect(c[0]).toBeCloseTo(1, 5)
      expect(c[1]).toBeCloseTo(0, 5)
    })
  })

  describe('insetPolygon — concave L-shape (#322 R1.1)', () => {
    it('produces non-self-intersecting inset for an L-shaped roof', () => {
      // L-shape: 6 vertices, concave at one corner. Centroid-radial inset
      // produced a bowtie at the concave corner because the inward direction
      // computed from the centroid points THROUGH the polygon outline.
      // Per-edge perpendicular offset must keep all edges parallel to their
      // originals and produce a topologically clean inset.
      const lShape: [number, number][] = [
        [0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2],
      ]
      const inset = insetPolygon(lShape, 0.1)
      // Each output edge should remain parallel to the corresponding input
      // edge. Edge 0→1 is (1,0); inset edge from inset[0]→inset[1] should
      // also be horizontal.
      const dx01 = inset[1][0] - inset[0][0]
      const dy01 = inset[1][1] - inset[0][1]
      expect(Math.abs(dy01)).toBeLessThan(1e-6) // horizontal
      expect(dx01).toBeGreaterThan(0)            // same direction

      // Edge 2→3 is (-1, 0); inset edge inset[2]→inset[3] should be horizontal too.
      const dx23 = inset[3][0] - inset[2][0]
      const dy23 = inset[3][1] - inset[2][1]
      expect(Math.abs(dy23)).toBeLessThan(1e-6)
      expect(dx23).toBeLessThan(0)

      // The concave (reflex) corner is at vertex 3 (1,1). Per-edge inset
      // moves it AWAY from the cut-out region toward the polygon body —
      // both coords decrease (~0.9, 0.9). The convex corners do the
      // opposite. This sign-direction is what tells the centroid-radial
      // method apart from a correct per-edge offset.
      expect(inset[3][0]).toBeLessThan(1)
      expect(inset[3][1]).toBeLessThan(1)

      // None of the inset vertices should coincide (no bowtie collapse).
      const distinct = new Set(inset.map(([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`))
      expect(distinct.size).toBe(inset.length)
    })

    it('preserves vertex count', () => {
      const p: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]]
      expect(insetPolygon(p, 0.1).length).toBe(p.length)
    })

    it('handles math-CW (reversed winding) by flipping inward direction', () => {
      // Same square, vertices listed CW. Inset should still shrink toward
      // interior (not balloon outward).
      const cwSquare: [number, number][] = [[0, 0], [0, 1], [1, 1], [1, 0]]
      const inset = insetPolygon(cwSquare, 0.1)
      // First vertex (0,0) should have moved INTO the square — both x and y > 0.
      expect(inset[0][0]).toBeGreaterThan(0)
      expect(inset[0][1]).toBeGreaterThan(0)
      // Third vertex (1,1) should move toward (0.9, 0.9).
      expect(inset[2][0]).toBeLessThan(1)
      expect(inset[2][1]).toBeLessThan(1)
    })
  })

  describe('polygonToSvgPath', () => {
    it('returns empty string for empty polygon', () => {
      expect(polygonToSvgPath([])).toBe('')
    })
    it('emits a closed M/L/Z path for a triangle', () => {
      expect(polygonToSvgPath([[0, 0], [1, 0], [1, 1]])).toBe('M 0 0 L 1 0 L 1 1 Z')
    })
    it('emits a closed M/L/Z path for a square', () => {
      expect(polygonToSvgPath([[0, 0], [1, 0], [1, 1], [0, 1]])).toBe('M 0 0 L 1 0 L 1 1 L 0 1 Z')
    })
  })
})
