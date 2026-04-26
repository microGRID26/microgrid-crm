import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RoofPlaneSvg } from '@/components/planset/RoofPlaneSvg'
import type { PlansetRoofFace, PlansetString } from '@/lib/planset-types'

const square: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]]

const face: PlansetRoofFace = {
  id: 1, tilt: 25, azimuth: 180, modules: 12,
  polygon: square,
  setbacks: { ridge: true, eave: false, rake: false, pathClear: 'walkable' },
}

const str: PlansetString = {
  id: 1, mppt: 1, modules: 12, roofFace: 1, vocCold: 0, vmpNominal: 0, current: 0,
}

describe('RoofPlaneSvg', () => {
  it('renders one polygon path per valid face', () => {
    const { container } = render(<RoofPlaneSvg faces={[face]} strings={[str]} width={400} height={300} />)
    expect(container.querySelectorAll('path').length).toBeGreaterThanOrEqual(1)
  })

  it('renders setback hatching when face.setbacks.ridge is true', () => {
    const { container } = render(<RoofPlaneSvg faces={[face]} strings={[str]} width={400} height={300} />)
    expect(container.querySelector('[data-setback]')).not.toBeNull()
  })

  it('does not render setback hatching when no setbacks are flagged', () => {
    const noSetbackFace: PlansetRoofFace = {
      ...face,
      setbacks: { ridge: false, eave: false, rake: false, pathClear: 'walkable' },
    }
    const { container } = render(<RoofPlaneSvg faces={[noSetbackFace]} strings={[str]} width={400} height={300} />)
    expect(container.querySelector('[data-setback]')).toBeNull()
  })

  it('renders the per-string label "STRING N — M MODULES"', () => {
    const { container } = render(<RoofPlaneSvg faces={[face]} strings={[str]} width={400} height={300} />)
    expect(container.textContent).toContain('STRING 1')
    expect(container.textContent).toContain('12 MODULES')
  })

  it('renders ROOF #N label', () => {
    const { container } = render(<RoofPlaneSvg faces={[face]} strings={[str]} width={400} height={300} />)
    expect(container.textContent).toContain('ROOF #1')
  })

  it('renders azimuth and tilt callout', () => {
    const { container } = render(<RoofPlaneSvg faces={[face]} strings={[str]} width={400} height={300} />)
    expect(container.textContent).toContain('AZ 180')
    expect(container.textContent).toContain('TILT 25')
  })

  it('skips faces with empty polygon (graceful fallback)', () => {
    const emptyFace: PlansetRoofFace = { ...face, polygon: [] }
    const { container } = render(<RoofPlaneSvg faces={[emptyFace]} strings={[str]} width={400} height={300} />)
    // No polygon → no paths rendered for that face. The svg root may still
    // contain other structural paths, so check that no <g data-face-id="1">
    // contains a polygon path. Simpler: assert no paths total since this
    // single-face test has no other content.
    expect(container.querySelectorAll('path').length).toBe(0)
  })

  it('renders walking-ridge marker when pathClear is walkable', () => {
    const { container } = render(<RoofPlaneSvg faces={[face]} strings={[str]} width={400} height={300} />)
    expect(container.textContent).toMatch(/WALKABLE/i)
  })

  it('renders multiple faces independently', () => {
    const face2: PlansetRoofFace = {
      id: 2, tilt: 30, azimuth: 90, modules: 6,
      polygon: [[0.1, 0.1], [0.4, 0.1], [0.4, 0.4], [0.1, 0.4]],
      setbacks: { ridge: false, eave: false, rake: false, pathClear: 'walkable' },
    }
    const str2: PlansetString = { ...str, id: 2, modules: 6, roofFace: 2 }
    const { container } = render(<RoofPlaneSvg faces={[face, face2]} strings={[str, str2]} width={400} height={300} />)
    expect(container.textContent).toContain('ROOF #1')
    expect(container.textContent).toContain('ROOF #2')
    expect(container.querySelectorAll('path').length).toBeGreaterThanOrEqual(2)
  })
})
