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
  windSpeed: 130,
  dcRunLengthFt: 50,
  acRunLengthFt: 30,
  stories: 3,
  roofType: 'Comp Shingle',
  rafterSize: '2x6',
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

  it('preserves 0 as a valid value for existingPanelCount (falsy-zero fix)', () => {
    let overrides: PlansetOverrides = {}
    const onOverridesChange = vi.fn((o: PlansetOverrides) => { overrides = o })
    render(
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
    // existingPanelCount displays '12' from baseData — type '0'
    const input = screen.getByDisplayValue('12')
    fireEvent.change(input, { target: { value: '0' } })
    expect(onOverridesChange).toHaveBeenCalledWith(expect.objectContaining({ existingPanelCount: 0 }))
    const call = onOverridesChange.mock.calls[onOverridesChange.mock.calls.length - 1][0] as PlansetOverrides
    expect(call.existingPanelCount).toBe(0)
    expect(call.existingPanelCount).not.toBeUndefined()
  })

  it('preserves 0 as a valid value for windSpeed (Building Info block)', () => {
    let overrides: PlansetOverrides = {}
    const onOverridesChange = vi.fn((o: PlansetOverrides) => { overrides = o })
    render(
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
    const input = screen.getByDisplayValue('130') // windSpeed from baseData
    fireEvent.change(input, { target: { value: '0' } })
    expect(onOverridesChange).toHaveBeenCalledWith(expect.objectContaining({ windSpeed: 0 }))
    const call = onOverridesChange.mock.calls[onOverridesChange.mock.calls.length - 1][0] as PlansetOverrides
    expect(call.windSpeed).toBe(0)
    expect(call.windSpeed).not.toBeUndefined()
  })

  it('preserves 0 as a valid value for dcRunLengthFt (Wire Run block)', () => {
    let overrides: PlansetOverrides = {}
    const onOverridesChange = vi.fn((o: PlansetOverrides) => { overrides = o })
    render(
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
    const input = screen.getByDisplayValue('50') // dcRunLengthFt from baseData
    fireEvent.change(input, { target: { value: '0' } })
    expect(onOverridesChange).toHaveBeenCalledWith(expect.objectContaining({ dcRunLengthFt: 0 }))
    const call = onOverridesChange.mock.calls[onOverridesChange.mock.calls.length - 1][0] as PlansetOverrides
    expect(call.dcRunLengthFt).toBe(0)
    expect(call.dcRunLengthFt).not.toBeUndefined()
  })
})
