import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OverridesPanel } from '@/app/planset/components/OverridesPanel'
import type { PlansetData, PlansetOverrides } from '@/lib/planset-types'

const baseData: Partial<PlansetData> = {
  existingInverterCount: 1,
  existingInverterModel: 'EcoFlow Smart Panel',
  existingPanelCount: 12,
  existingPanelModel: 'Old SunPower',
  existingPanelWattage: 320,
  vocCorrected: 50, panelVmp: 35, panelImp: 13, panelModel: 'Seraphim 440',
}

describe('OverridesPanel — Existing System fields', () => {
  it('keeps user-typed value after they edit it (does not pop back to project data)', () => {
    let overrides: PlansetOverrides = {}
    const onOverridesChange = vi.fn((o: PlansetOverrides) => { overrides = o })

    const { rerender } = render(
      <OverridesPanel
        data={baseData as PlansetData}
        strings={[]} onStringsChange={() => {}}
        overrides={overrides} onOverridesChange={onOverridesChange}
        roofFaces={[]} onRoofFacesChange={() => {}}
        images={{ sitePlanImageUrl: null, roofPlanImageUrl: null, aerialPhotoUrl: null, housePhotoUrl: null, equipmentPhotos: [null, null, null, null] }}
        onImagesChange={() => {}}
        enhanced={false}
      />
    )
    fireEvent.click(screen.getByText(/Overrides/i)) // expand
    const input = screen.getByDisplayValue('1') // existingInverterCount = 1 from data
    fireEvent.change(input, { target: { value: '2' } })
    expect(onOverridesChange).toHaveBeenCalledWith(expect.objectContaining({ existingInverterCount: 2 }))

    rerender(
      <OverridesPanel
        data={baseData as PlansetData}
        strings={[]} onStringsChange={() => {}}
        overrides={overrides} onOverridesChange={onOverridesChange}
        roofFaces={[]} onRoofFacesChange={() => {}}
        images={{ sitePlanImageUrl: null, roofPlanImageUrl: null, aerialPhotoUrl: null, housePhotoUrl: null, equipmentPhotos: [null, null, null, null] }}
        onImagesChange={() => {}}
        enhanced={false}
      />
    )
    expect(screen.getByDisplayValue('2')).toBeTruthy()
  })

  it('preserves explicitly-cleared field as empty (does not fall back to project data)', () => {
    let overrides: PlansetOverrides = {}
    const onOverridesChange = vi.fn((o: PlansetOverrides) => { overrides = o })
    const { rerender } = render(
      <OverridesPanel
        data={baseData as PlansetData}
        strings={[]} onStringsChange={() => {}}
        overrides={overrides} onOverridesChange={onOverridesChange}
        roofFaces={[]} onRoofFacesChange={() => {}}
        images={{ sitePlanImageUrl: null, roofPlanImageUrl: null, aerialPhotoUrl: null, housePhotoUrl: null, equipmentPhotos: [null, null, null, null] }}
        onImagesChange={() => {}}
        enhanced={false}
      />
    )
    fireEvent.click(screen.getByText(/Overrides/i))
    const input = screen.getByDisplayValue('1')
    fireEvent.change(input, { target: { value: '' } })
    rerender(
      <OverridesPanel
        data={baseData as PlansetData}
        strings={[]} onStringsChange={() => {}}
        overrides={overrides} onOverridesChange={onOverridesChange}
        roofFaces={[]} onRoofFacesChange={() => {}}
        images={{ sitePlanImageUrl: null, roofPlanImageUrl: null, aerialPhotoUrl: null, housePhotoUrl: null, equipmentPhotos: [null, null, null, null] }}
        onImagesChange={() => {}}
        enhanced={false}
      />
    )
    // After clearing, the input should be empty, not fall back to '1' from data
    expect(screen.queryByDisplayValue('1')).toBeNull()
  })
})
