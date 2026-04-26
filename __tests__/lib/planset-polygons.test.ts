import { describe, it, expect } from 'vitest'
import { isValidPolygon, polygonCentroid, insetPolygon, polygonToSvgPath } from '@/lib/planset-polygons'

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
