'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import type { PlansetData, PlansetOverrides, PlansetString, PlansetRoofFace } from '@/lib/planset-types'
import { PANEL_PRESETS, PANEL_PRESET_LABELS } from '@/lib/planset-types'

export interface PlansetImageUrls {
  sitePlanImageUrl: string | null
  roofPlanImageUrl: string | null
  aerialPhotoUrl: string | null
  housePhotoUrl: string | null
  equipmentPhotos: (string | null)[]  // up to 4 slots
}

export function OverridesPanel({ data, strings, onStringsChange, overrides, onOverridesChange, roofFaces, onRoofFacesChange, images, onImagesChange, enhanced = false }: {
  data: PlansetData
  strings: PlansetString[]
  onStringsChange: (s: PlansetString[]) => void
  overrides: PlansetOverrides
  onOverridesChange: (o: PlansetOverrides) => void
  roofFaces: PlansetRoofFace[]
  onRoofFacesChange: (rf: PlansetRoofFace[]) => void
  images: PlansetImageUrls
  onImagesChange: (imgs: PlansetImageUrls) => void
  enhanced?: boolean
}) {
  const sitePlanImageUrl = images.sitePlanImageUrl
  const onSitePlanChange = (url: string | null) => onImagesChange({ ...images, sitePlanImageUrl: url })
  const [expanded, setExpanded] = useState(false)

  const updateStringModules = (idx: number, modules: number) => {
    const updated = [...strings]
    updated[idx] = {
      ...updated[idx],
      modules,
      vocCold: parseFloat((modules * data.vocCorrected).toFixed(1)),
      vmpNominal: parseFloat((modules * data.panelVmp).toFixed(1)),
    }
    onStringsChange(updated)
  }

  const addString = () => {
    const nextId = strings.length > 0 ? Math.max(...strings.map(s => s.id)) + 1 : 1
    const nextMppt = strings.length > 0 ? Math.max(...strings.map(s => s.mppt)) + 1 : 1
    onStringsChange([...strings, {
      id: nextId,
      mppt: nextMppt,
      modules: 9,
      roofFace: 1,
      vocCold: parseFloat((9 * data.vocCorrected).toFixed(1)),
      vmpNominal: parseFloat((9 * data.panelVmp).toFixed(1)),
      current: data.panelImp,
    }])
  }

  const removeString = (idx: number) => {
    onStringsChange(strings.filter((_, i) => i !== idx))
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-300 hover:text-white transition-colors"
      >
        <span>Overrides &amp; String Configuration ({strings.length} strings, {strings.reduce((s, x) => s + x.modules, 0)} modules)</span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-700 pt-4 space-y-6">
          {/* Equipment Preset (enhanced mode) */}
          {enhanced && <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Equipment Preset</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Panel Preset</label>
                <select
                  value={Object.entries(PANEL_PRESETS).find(([, p]) => p.panelModel === (overrides.panelModel ?? data.panelModel))?.[0] ?? 'custom'}
                  onChange={e => {
                    const presetKey = e.target.value
                    if (presetKey === 'custom') return
                    const preset = PANEL_PRESETS[presetKey]
                    if (preset) {
                      onOverridesChange({
                        ...overrides,
                        panelModel: preset.panelModel,
                        panelWattage: preset.panelWattage,
                        panelVoc: preset.panelVoc,
                        panelVmp: preset.panelVmp,
                        panelIsc: preset.panelIsc,
                        panelImp: preset.panelImp,
                      })
                    }
                  }}
                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-white focus:ring-1 focus:ring-green-500 focus:outline-none"
                >
                  {Object.entries(PANEL_PRESET_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Panel Model</label>
                <input
                  value={overrides.panelModel ?? data.panelModel}
                  onChange={e => onOverridesChange({ ...overrides, panelModel: e.target.value })}
                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-white focus:ring-1 focus:ring-green-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Panel Wattage</label>
                <input
                  value={overrides.panelWattage ?? data.panelWattage}
                  onChange={e => onOverridesChange({ ...overrides, panelWattage: parseInt(e.target.value) || 0 })}
                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-white focus:ring-1 focus:ring-green-500 focus:outline-none"
                />
              </div>
            </div>
          </div>}

          {/* Building overrides */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Building Info</h3>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Roof Type', key: 'roofType' as const, val: 'roofType' in overrides ? String(overrides.roofType ?? '') : String(data.roofType ?? '') },
                { label: 'Rafter Size', key: 'rafterSize' as const, val: 'rafterSize' in overrides ? String(overrides.rafterSize ?? '') : String(data.rafterSize ?? '') },
                { label: 'Stories', key: 'stories' as const, val: 'stories' in overrides ? String(overrides.stories ?? '') : String(data.stories ?? '') },
                { label: 'Wind Speed (MPH)', key: 'windSpeed' as const, val: 'windSpeed' in overrides ? String(overrides.windSpeed ?? '') : String(data.windSpeed ?? '') },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
                  <input
                    value={f.val}
                    onChange={e => {
                      const v = e.target.value
                      if (f.key === 'stories' || f.key === 'windSpeed') {
                        if (v === '') {
                          const next = { ...overrides } as Record<string, unknown>
                          next[f.key] = undefined
                          onOverridesChange(next as PlansetOverrides)
                        } else {
                          const n = parseInt(v)
                          onOverridesChange({ ...overrides, [f.key]: Number.isNaN(n) ? undefined : n })
                        }
                      } else {
                        onOverridesChange({ ...overrides, [f.key]: v === '' ? undefined : v })
                      }
                    }}
                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-white focus:ring-1 focus:ring-green-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Wire run lengths */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Wire Run Lengths</h3>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'DC Run (ft)', key: 'dcRunLengthFt' as const, val: 'dcRunLengthFt' in overrides ? String(overrides.dcRunLengthFt ?? '') : String(data.dcRunLengthFt ?? '') },
                { label: 'AC Run (ft)', key: 'acRunLengthFt' as const, val: 'acRunLengthFt' in overrides ? String(overrides.acRunLengthFt ?? '') : String(data.acRunLengthFt ?? '') },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
                  <input
                    value={f.val}
                    onChange={e => {
                      const v = e.target.value
                      if (v === '') {
                        const next = { ...overrides } as Record<string, unknown>
                        next[f.key] = undefined
                        onOverridesChange(next as PlansetOverrides)
                      } else {
                        const n = parseInt(v)
                        onOverridesChange({ ...overrides, [f.key]: Number.isNaN(n) ? undefined : n })
                      }
                    }}
                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-white focus:ring-1 focus:ring-green-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Existing system overrides */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Existing System (Optional)</h3>
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: 'Panel Model', key: 'existingPanelModel' as const, val: 'existingPanelModel' in overrides ? String(overrides.existingPanelModel ?? '') : String(data.existingPanelModel ?? '') },
                { label: 'Panel Count', key: 'existingPanelCount' as const, val: 'existingPanelCount' in overrides ? String(overrides.existingPanelCount ?? '') : String(data.existingPanelCount ?? '') },
                { label: 'Panel Wattage', key: 'existingPanelWattage' as const, val: 'existingPanelWattage' in overrides ? String(overrides.existingPanelWattage ?? '') : String(data.existingPanelWattage ?? '') },
                { label: 'Inverter Model', key: 'existingInverterModel' as const, val: 'existingInverterModel' in overrides ? String(overrides.existingInverterModel ?? '') : String(data.existingInverterModel ?? '') },
                { label: 'Inverter Count', key: 'existingInverterCount' as const, val: 'existingInverterCount' in overrides ? String(overrides.existingInverterCount ?? '') : String(data.existingInverterCount ?? '') },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
                  <input
                    value={f.val}
                    onChange={e => {
                      const v = e.target.value
                      const numericKey = ['existingPanelCount', 'existingPanelWattage', 'existingInverterCount'].includes(f.key)
                      const next = { ...overrides } as Record<string, unknown>
                      if (numericKey) {
                        if (v === '') {
                          next[f.key] = undefined
                        } else {
                          const n = parseInt(v)
                          next[f.key] = Number.isNaN(n) ? undefined : n
                        }
                      } else {
                        next[f.key] = v === '' ? undefined : v
                      }
                      onOverridesChange(next as PlansetOverrides)
                    }}
                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-white focus:ring-1 focus:ring-green-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Site Plan Image */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Site Plan Image (PV-3)</h3>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer px-4 py-2 text-sm rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors">
                {sitePlanImageUrl ? 'Replace Image' : 'Upload Image'}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (sitePlanImageUrl) URL.revokeObjectURL(sitePlanImageUrl)
                    const url = URL.createObjectURL(file)
                    onSitePlanChange(url)
                    e.target.value = ''
                  }}
                />
              </label>
              {sitePlanImageUrl && (
                <button
                  onClick={() => {
                    URL.revokeObjectURL(sitePlanImageUrl)
                    onSitePlanChange(null)
                  }}
                  className="px-3 py-2 text-sm rounded-md bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
                >
                  Remove
                </button>
              )}
              {sitePlanImageUrl && (
                <div className="flex items-center gap-2">
                  <img src={sitePlanImageUrl} alt="Site plan preview" className="h-16 rounded border border-gray-600" />
                  <span className="text-xs text-gray-500">Preview</span>
                </div>
              )}
              {!sitePlanImageUrl && (
                <span className="text-xs text-gray-500">No image uploaded. Accepts image files or PDF.</span>
              )}
            </div>
          </div>

          {/* Enhanced mode image uploads */}
          {enhanced && <>
          {/* Roof Plan Image (PV-4) */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Roof Plan Image (PV-4)</h3>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer px-4 py-2 text-sm rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors">
                {images.roofPlanImageUrl ? 'Replace Image' : 'Upload SubHub Layout'}
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const file = e.target.files?.[0]; if (!file) return
                  if (images.roofPlanImageUrl) URL.revokeObjectURL(images.roofPlanImageUrl)
                  onImagesChange({ ...images, roofPlanImageUrl: URL.createObjectURL(file) }); e.target.value = ''
                }} />
              </label>
              {images.roofPlanImageUrl && (
                <button onClick={() => { URL.revokeObjectURL(images.roofPlanImageUrl!); onImagesChange({ ...images, roofPlanImageUrl: null }) }}
                  className="px-3 py-2 text-sm rounded-md bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors">Remove</button>
              )}
              {images.roofPlanImageUrl && <img src={images.roofPlanImageUrl} alt="Roof plan preview" className="h-16 rounded border border-gray-600" />}
              {!images.roofPlanImageUrl && <span className="text-xs text-gray-500">Upload the SubHub satellite screenshot showing module placement on roof.</span>}
            </div>
          </div>

          {/* Cover Page Images (PV-1) */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Cover Page Images (PV-1)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-2">Aerial Photo (drone shot)</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-3 py-1.5 text-xs rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors">
                    {images.aerialPhotoUrl ? 'Replace' : 'Upload'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0]; if (!file) return
                      if (images.aerialPhotoUrl) URL.revokeObjectURL(images.aerialPhotoUrl)
                      onImagesChange({ ...images, aerialPhotoUrl: URL.createObjectURL(file) }); e.target.value = ''
                    }} />
                  </label>
                  {images.aerialPhotoUrl && (
                    <button onClick={() => { URL.revokeObjectURL(images.aerialPhotoUrl!); onImagesChange({ ...images, aerialPhotoUrl: null }) }}
                      className="text-xs text-red-400 hover:text-red-300">Remove</button>
                  )}
                  {images.aerialPhotoUrl && <img src={images.aerialPhotoUrl} alt="Aerial preview" className="h-12 rounded border border-gray-600" />}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-2">House Photo (street view)</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-3 py-1.5 text-xs rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors">
                    {images.housePhotoUrl ? 'Replace' : 'Upload'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0]; if (!file) return
                      if (images.housePhotoUrl) URL.revokeObjectURL(images.housePhotoUrl)
                      onImagesChange({ ...images, housePhotoUrl: URL.createObjectURL(file) }); e.target.value = ''
                    }} />
                  </label>
                  {images.housePhotoUrl && (
                    <button onClick={() => { URL.revokeObjectURL(images.housePhotoUrl!); onImagesChange({ ...images, housePhotoUrl: null }) }}
                      className="text-xs text-red-400 hover:text-red-300">Remove</button>
                  )}
                  {images.housePhotoUrl && <img src={images.housePhotoUrl} alt="House preview" className="h-12 rounded border border-gray-600" />}
                </div>
              </div>
            </div>
          </div>

          {/* Equipment Elevation Photos (PV-3.1) */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Equipment Photos (PV-3.1)</h3>
            <div className="grid grid-cols-4 gap-3">
              {['Exterior Wall 1', 'Exterior Wall 2', 'Interior Wall', 'Equipment Detail'].map((label, i) => (
                <div key={label}>
                  <label className="text-xs text-gray-500 block mb-2">{label}</label>
                  <div className="flex flex-col items-start gap-2">
                    <label className="cursor-pointer px-3 py-1.5 text-xs rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors">
                      {images.equipmentPhotos[i] ? 'Replace' : 'Upload'}
                      <input type="file" accept="image/*" className="hidden" onChange={e => {
                        const file = e.target.files?.[0]; if (!file) return
                        const updated = [...images.equipmentPhotos]
                        if (updated[i]) URL.revokeObjectURL(updated[i]!)
                        updated[i] = URL.createObjectURL(file)
                        onImagesChange({ ...images, equipmentPhotos: updated }); e.target.value = ''
                      }} />
                    </label>
                    {images.equipmentPhotos[i] && (
                      <>
                        <img src={images.equipmentPhotos[i]!} alt={`${label} preview`} className="h-12 rounded border border-gray-600" />
                        <button onClick={() => {
                          const updated = [...images.equipmentPhotos]; URL.revokeObjectURL(updated[i]!); updated[i] = null
                          onImagesChange({ ...images, equipmentPhotos: updated })
                        }} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          </>}

          {/* Roof Faces */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Roof Faces</h3>
            {roofFaces.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-3">No roof faces derived yet. Add strings with roof face assignments to populate.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-700">
                    <th className="text-left py-1 px-2">Roof Face</th>
                    <th className="text-left py-1 px-2">Modules</th>
                    <th className="text-left py-1 px-2">Tilt (&deg;)</th>
                    <th className="text-left py-1 px-2">Azimuth (&deg;)</th>
                  </tr>
                </thead>
                <tbody>
                  {roofFaces.map((rf, i) => (
                    <tr key={rf.id} className="border-b border-gray-700/50">
                      <td className="py-1 px-2 text-gray-300">Roof {rf.id}</td>
                      <td className="py-1 px-2 text-gray-400 text-xs">{rf.modules}</td>
                      <td className="py-1 px-2">
                        <input value={rf.tilt} onChange={e => {
                          const updated = [...roofFaces]
                          updated[i] = { ...rf, tilt: parseInt(e.target.value) || 0 }
                          onRoofFacesChange(updated)
                        }} className="w-16 px-1 py-0.5 bg-gray-900 border border-gray-700 rounded text-xs text-white" />
                      </td>
                      <td className="py-1 px-2">
                        <input value={rf.azimuth} onChange={e => {
                          const updated = [...roofFaces]
                          updated[i] = { ...rf, azimuth: parseInt(e.target.value) || 0 }
                          onRoofFacesChange(updated)
                        }} className="w-16 px-1 py-0.5 bg-gray-900 border border-gray-700 rounded text-xs text-white" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="text-xs text-gray-600 mt-2">Roof faces are auto-derived from string assignments. Edit tilt and azimuth here.</p>
          </div>

          {/* String configuration table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">String Configuration</h3>
              <button onClick={addString}
                className="text-xs px-3 py-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors">
                + Add String
              </button>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-700">
                  <th className="text-left py-1 px-2">String</th>
                  <th className="text-left py-1 px-2">MPPT</th>
                  <th className="text-left py-1 px-2">Modules</th>
                  <th className="text-left py-1 px-2">Roof Face</th>
                  <th className="text-left py-1 px-2">Voc Cold</th>
                  <th className="text-left py-1 px-2">Vmp</th>
                  <th className="text-left py-1 px-2">Imp</th>
                  <th className="text-left py-1 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {strings.map((s, i) => (
                  <tr key={s.id} className="border-b border-gray-700/50">
                    <td className="py-1 px-2 text-gray-300">S{s.id}</td>
                    <td className="py-1 px-2">
                      <input value={s.mppt} onChange={e => {
                        const updated = [...strings]; updated[i] = { ...s, mppt: parseInt(e.target.value) || 1 }; onStringsChange(updated)
                      }} className="w-14 px-1 py-0.5 bg-gray-900 border border-gray-700 rounded text-xs text-white" />
                    </td>
                    <td className="py-1 px-2">
                      <input value={s.modules} onChange={e => updateStringModules(i, parseInt(e.target.value) || 0)}
                        className="w-14 px-1 py-0.5 bg-gray-900 border border-gray-700 rounded text-xs text-white" />
                    </td>
                    <td className="py-1 px-2">
                      <input value={s.roofFace} onChange={e => {
                        const updated = [...strings]; updated[i] = { ...s, roofFace: parseInt(e.target.value) || 1 }; onStringsChange(updated)
                      }} className="w-14 px-1 py-0.5 bg-gray-900 border border-gray-700 rounded text-xs text-white" />
                    </td>
                    <td className="py-1 px-2 text-gray-400 text-xs">{s.vocCold.toFixed(1)}V</td>
                    <td className="py-1 px-2 text-gray-400 text-xs">{s.vmpNominal.toFixed(1)}V</td>
                    <td className="py-1 px-2 text-gray-400 text-xs">{s.current}A</td>
                    <td className="py-1 px-2">
                      <button onClick={() => removeString(i)} className="text-red-400/60 hover:text-red-400 text-xs">
                        <X className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {strings.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">No strings configured. Click &quot;+ Add String&quot; or auto-distribute will be used.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
