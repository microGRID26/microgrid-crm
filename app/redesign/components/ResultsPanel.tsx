import { cn } from '@/lib/utils'
import { Zap, Sun, ArrowRight, AlertTriangle, FileDown } from 'lucide-react'
import { generateSingleLineDxf } from '@/lib/sld-template'
import { SingleLineDiagram } from './SingleLineDiagram'
import type { ExistingSystem, TargetSystem, Results } from './types'

interface ResultsPanelProps {
  existing: ExistingSystem
  target: TargetSystem
  results: Results
}

export function ResultsPanel({ existing, target, results }: ResultsPanelProps) {
  return (
    <div id="redesign-results" className="space-y-6">

      {/* 4a. String Sizing */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-green-400 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          String Sizing
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <p className="text-xs text-gray-400">Voc Corrected (cold)</p>
            <p className="text-lg font-semibold">{results.vocCorrected} V</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Vmp Hot</p>
            <p className="text-lg font-semibold">{results.vmpHot} V</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Max Modules/String</p>
            <p className="text-lg font-semibold">{results.maxModulesPerString}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Min Modules/String</p>
            <p className="text-lg font-semibold">{results.minModulesPerString}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Recommended Size</p>
            <p className="text-lg font-semibold text-green-400">{results.recommendedStringSize}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Total String Inputs</p>
            <p className="text-lg font-semibold">{results.totalStringInputs}</p>
          </div>
        </div>
      </div>

      {/* 4b. Panel Fit Estimate */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-green-400 mb-4 flex items-center gap-2">
          <Sun className="w-4 h-4" />
          Panel Fit Estimate
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs border-b border-gray-700">
                <th className="text-left py-2 pr-4">Roof Face</th>
                <th className="text-right py-2 px-4">Old Panels</th>
                <th className="text-right py-2 px-4">New Panels</th>
                <th className="text-right py-2 px-4">Delta</th>
                <th className="text-left py-2 pl-4">Method</th>
              </tr>
            </thead>
            <tbody>
              {results.panelFitEstimates.map(e => (
                <tr key={e.roofIndex} className="border-b border-gray-700/50">
                  <td className="py-2 pr-4">Roof {e.roofIndex + 1} ({existing.roofFaces[e.roofIndex]?.azimuth}° / {existing.roofFaces[e.roofIndex]?.tilt}°)</td>
                  <td className="text-right py-2 px-4">{e.oldCount}</td>
                  <td className="text-right py-2 px-4 font-semibold">{e.newCount}</td>
                  <td className={cn('text-right py-2 px-4 font-semibold', e.newCount - e.oldCount >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {e.newCount - e.oldCount >= 0 ? '+' : ''}{e.newCount - e.oldCount}
                  </td>
                  <td className="py-2 pl-4 text-gray-400">{e.method}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2 pr-4">Total</td>
                <td className="text-right py-2 px-4">{existing.panelCount}</td>
                <td className="text-right py-2 px-4 text-green-400">{results.newTotalPanels}</td>
                <td className={cn('text-right py-2 px-4', results.newTotalPanels - existing.panelCount >= 0 ? 'text-green-400' : 'text-red-400')}>
                  {results.newTotalPanels - existing.panelCount >= 0 ? '+' : ''}{results.newTotalPanels - existing.panelCount}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4c. Auto String Configuration */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-green-400 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          String Configuration
        </h3>
        {results.stringConfigs.length === 0 ? (
          <p className="text-gray-400 text-sm">No strings configured. Check panel counts and string sizing parameters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs border-b border-gray-700">
                  <th className="text-left py-2 pr-3">Inverter</th>
                  <th className="text-left py-2 px-3">MPPT</th>
                  <th className="text-left py-2 px-3">String</th>
                  <th className="text-right py-2 px-3">Modules</th>
                  <th className="text-right py-2 px-3">Voc Cold (V)</th>
                  <th className="text-right py-2 px-3">Vmp Nom (V)</th>
                  <th className="text-right py-2 px-3">Imp (A)</th>
                  <th className="text-left py-2 pl-3">Roof Face</th>
                </tr>
              </thead>
              <tbody>
                {results.stringConfigs.map((sc, i) => {
                  const inverterId = Math.ceil((sc.mppt) / target.mpptsPerInverter)
                  const mpptInInverter = ((sc.mppt - 1) % target.mpptsPerInverter) + 1
                  return (
                    <tr key={i} className="border-b border-gray-700/50">
                      <td className="py-2 pr-3">INV-{inverterId}</td>
                      <td className="py-2 px-3">MPPT-{mpptInInverter}</td>
                      <td className="py-2 px-3">S{sc.string}</td>
                      <td className="text-right py-2 px-3 font-semibold">{sc.modules}</td>
                      <td className={cn('text-right py-2 px-3', sc.vocCold > target.maxVoc ? 'text-red-400 font-semibold' : '')}>
                        {sc.vocCold}
                      </td>
                      <td className={cn('text-right py-2 px-3',
                        sc.vmpNominal < target.mpptMin ? 'text-red-400 font-semibold' :
                        sc.vmpNominal > target.mpptMax ? 'text-amber-400 font-semibold' : ''
                      )}>
                        {sc.vmpNominal}
                      </td>
                      <td className="text-right py-2 px-3">{sc.current}</td>
                      <td className="py-2 pl-3 text-gray-400">
                        {sc.roofFaceIndex >= 0 ? `Roof ${sc.roofFaceIndex + 1}` : 'Overflow'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-2">
              Total modules assigned: {results.stringConfigs.reduce((s, c) => s + c.modules, 0)} of {results.newTotalPanels} estimated
            </p>
          </div>
        )}
      </div>

      {/* 4d. BOM Comparison */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-green-400 mb-4 flex items-center gap-2">
          <ArrowRight className="w-4 h-4" />
          BOM Comparison
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs border-b border-gray-700">
                <th className="text-left py-2 pr-4">Component</th>
                <th className="text-left py-2 px-4">Existing</th>
                <th className="text-left py-2 pl-4">New</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-700/50">
                <td className="py-2.5 pr-4 text-gray-400">Panels</td>
                <td className="py-2.5 px-4">{existing.panelCount} x {existing.panelModel} ({existing.panelWattage}W)</td>
                <td className="py-2.5 pl-4 text-green-400">{results.newTotalPanels} x {target.panelModel} ({target.panelWattage}W)</td>
              </tr>
              <tr className="border-b border-gray-700/50">
                <td className="py-2.5 pr-4 text-gray-400">System DC</td>
                <td className="py-2.5 px-4">{results.existingSystemDc} kW</td>
                <td className="py-2.5 pl-4 text-green-400">{results.newSystemDc} kW</td>
              </tr>
              <tr className="border-b border-gray-700/50">
                <td className="py-2.5 pr-4 text-gray-400">Inverters</td>
                <td className="py-2.5 px-4">{existing.inverterCount} x {existing.inverterModel}</td>
                <td className="py-2.5 pl-4 text-green-400">{target.inverterCount} x {target.inverterModel}</td>
              </tr>
              <tr className="border-b border-gray-700/50">
                <td className="py-2.5 pr-4 text-gray-400">AC Output</td>
                <td className="py-2.5 px-4">{results.existingTotalAc} kW</td>
                <td className="py-2.5 pl-4 text-green-400">{results.newTotalAc} kW</td>
              </tr>
              <tr className="border-b border-gray-700/50">
                <td className="py-2.5 pr-4 text-gray-400">Batteries</td>
                <td className="py-2.5 px-4">{existing.batteryCount} x {existing.batteryModel}</td>
                <td className="py-2.5 pl-4 text-green-400">{target.batteryCount} x {target.batteryModel}</td>
              </tr>
              <tr className="border-b border-gray-700/50">
                <td className="py-2.5 pr-4 text-gray-400">Storage</td>
                <td className="py-2.5 px-4">{results.existingTotalStorage} kWh</td>
                <td className="py-2.5 pl-4 text-green-400">{results.newTotalStorage} kWh</td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-gray-400">Racking</td>
                <td className="py-2.5 px-4">{existing.rackingType}</td>
                <td className="py-2.5 pl-4 text-green-400">{target.rackingModel}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4e. Engineering Notes */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-amber-400 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Engineering Notes
        </h3>
        <ul className="space-y-2">
          {results.engineeringNotes.map((note, i) => {
            const isWarning = note.startsWith('WARNING')
            return (
              <li key={i} className={cn(
                'text-sm flex items-start gap-2 py-1.5 px-3 rounded',
                isWarning ? 'bg-red-900/30 text-red-300 border border-red-800/50' : 'bg-gray-700/50 text-gray-300'
              )}>
                {isWarning && <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />}
                {note}
              </li>
            )
          })}
        </ul>
      </div>

      {/* 4f. Single-Line Diagram */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-green-400 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Electrical Single-Line Diagram
          </h3>
          <button
            onClick={() => {
              const svg = document.getElementById('sld-svg')
              if (!svg) return
              const clone = svg.cloneNode(true) as SVGElement
              clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
              const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = `SLD-${existing.projectName.replace(/\s+/g, '-')}.svg`
              a.click()
              URL.revokeObjectURL(a.href)
            }}
            className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-md px-3 py-1.5 transition-colors"
          >
            Download SVG
          </button>
          <button
            onClick={() => {
              const dxf = generateSingleLineDxf({
                projectName: existing.projectName,
                address: existing.address,
                panelModel: target.panelModel,
                panelWattage: target.panelWattage,
                panelCount: results.newTotalPanels,
                inverterModel: target.inverterModel,
                inverterCount: target.inverterCount,
                inverterAcPower: 15,
                maxPvPower: target.maxPvPower,
                mpptsPerInverter: target.mpptsPerInverter,
                stringsPerMppt: target.stringsPerMppt,
                batteryModel: target.batteryModel,
                batteryCount: target.batteryCount,
                batteryCapacity: target.batteryCapacity,
                batteriesPerStack: target.batteriesPerStack,
                strings: results.stringConfigs,
                systemDcKw: results.newSystemDc,
                totalStorageKwh: results.newTotalStorage,
                rackingModel: target.rackingModel,
              })
              const blob = new Blob([dxf], { type: 'application/dxf' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = `SLD-${existing.projectName.replace(/\s+/g, '-')}.dxf`
              a.click()
              URL.revokeObjectURL(a.href)
            }}
            className="text-xs text-green-400 hover:text-green-300 border border-green-700 hover:border-green-500 rounded-md px-3 py-1.5 transition-colors flex items-center gap-1.5"
          >
            <FileDown className="w-3.5 h-3.5" />
            Download DXF (AutoCAD)
          </button>
          <button
            onClick={() => {
              const svg = document.getElementById('sld-svg')
              if (!svg) return
              const clone = svg.cloneNode(true) as SVGElement
              clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
              const win = window.open('', '_blank')
              if (!win) return
              win.document.write(`<!DOCTYPE html><html><head><title>SLD - ${existing.projectName}</title><style>@page{size:landscape;margin:0.25in}body{margin:0;padding:0;background:white}svg{width:100%;height:auto}</style></head><body>${clone.outerHTML}</body></html>`)
              win.document.close()
              setTimeout(() => win.print(), 500)
            }}
            className="text-xs text-blue-400 hover:text-blue-300 border border-blue-700 hover:border-blue-500 rounded-md px-3 py-1.5 transition-colors flex items-center gap-1.5"
          >
            <FileDown className="w-3.5 h-3.5" />
            Print / Save as PDF
          </button>
          <button
            onClick={() => {
              // Bridge redesign results to planset via sessionStorage
              const projectId = existing.projectName.match(/PROJ-\d+/)?.[0] ?? existing.projectName
              sessionStorage.setItem(`planset:redesign`, JSON.stringify({
                existing,
                target,
                results,
                strings: results.stringConfigs.map((sc, i) => ({
                  id: i + 1,
                  mppt: sc.mppt,
                  modules: sc.modules,
                  roofFace: sc.roofFaceIndex >= 0 ? sc.roofFaceIndex + 1 : 1,
                  vocCold: sc.vocCold,
                  vmpNominal: sc.vmpNominal,
                  current: sc.current,
                })),
              }))
              window.open(`/planset?project=${encodeURIComponent(projectId)}&fromRedesign=1`, '_blank')
            }}
            className="text-xs text-amber-400 hover:text-amber-300 border border-amber-700 hover:border-amber-500 rounded-md px-3 py-1.5 transition-colors flex items-center gap-1.5 font-medium"
          >
            <FileDown className="w-3.5 h-3.5" />
            Generate Plan Set (6 Sheets)
          </button>
          <a
            href="/batch"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-purple-400 hover:text-purple-300 border border-purple-700 hover:border-purple-500 rounded-md px-3 py-1.5 transition-colors flex items-center gap-1.5 font-medium"
          >
            <FileDown className="w-3.5 h-3.5" />
            Batch Processor
          </a>
        </div>
        <div className="overflow-x-auto bg-white rounded-lg p-4">
          <SingleLineDiagram
            existing={existing}
            target={target}
            results={results}
          />
        </div>
      </div>

    </div>
  )
}
