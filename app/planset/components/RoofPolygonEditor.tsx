'use client'

import { useState, useEffect } from 'react'
import { polygonToSvgPath, isValidPolygon } from '@/lib/planset-polygons'
import type { PlansetRoofFace } from '@/lib/planset-types'

interface Props {
  faceId: number
  initialPolygon: Array<[number, number]>
  initialSetbacks?: PlansetRoofFace['setbacks']
  onSave: (polygon: Array<[number, number]>, setbacks: PlansetRoofFace['setbacks']) => void
  onClose: () => void
}

const W = 600
const H = 400

export function RoofPolygonEditor({ faceId, initialPolygon, initialSetbacks, onSave, onClose }: Props) {
  // Convert normalized initial polygon to canvas coords
  const [points, setPoints] = useState<Array<[number, number]>>(
    initialPolygon.map(([x, y]) => [x * W, y * H] as [number, number])
  )
  const [setbacks, setSetbacks] = useState<PlansetRoofFace['setbacks']>(
    initialSetbacks ?? { ridge: false, eave: false, rake: false, pathClear: 'walkable' }
  )

  // Escape key closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function onCanvasClick(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setPoints(prev => [...prev, [x, y]])
  }

  function handleSave() {
    // Convert canvas coords back to normalized 0–1
    const normalized = points.map(([x, y]) => [x / W, y / H] as [number, number])
    onSave(normalized, setbacks)
  }

  function handleClear() {
    if (points.length === 0) return
    if (!window.confirm(`Discard ${points.length} placed vertices?`)) return
    setPoints([])
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    // Check for unsaved changes vs. initial polygon. Float === would falsely
    // flag identical polygons after JSON round-trip (initial coords may carry
    // FP drift after deserialize). Use 1e-6 tolerance — well below visible
    // pixel resolution at the editor's 600×400 canvas.
    const initial = initialPolygon.map(([x, y]) => [x * W, y * H] as [number, number])
    const PIXEL_EPS = 1e-6
    const changed = points.length !== initial.length ||
      points.some((p, i) =>
        Math.abs(p[0] - (initial[i]?.[0] ?? 0)) > PIXEL_EPS ||
        Math.abs(p[1] - (initial[i]?.[1] ?? 0)) > PIXEL_EPS
      )
    if (changed && !window.confirm('Discard unsaved polygon changes?')) return
    onClose()
  }

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (canSave) handleSave()
  }

  const canSave = isValidPolygon(points.map(([x, y]) => [x / W, y / H] as [number, number]))

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <form
        className="bg-gray-800 rounded-lg p-4 max-w-3xl w-full"
        onSubmit={handleFormSubmit}
      >
        <header className="flex justify-between items-center mb-3">
          <h2 className="text-white text-lg font-medium">
            Roof Plane Editor — Face #{faceId}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white">
            ✕
          </button>
        </header>

        <p className="text-gray-300 text-sm mb-2">
          Click on the canvas to add polygon vertices. Set the setback flags below per face.
        </p>

        <svg
          data-testid="polygon-canvas"
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          onClick={onCanvasClick}
          className="bg-gray-100 cursor-crosshair"
        >
          {points.length >= 3 && (
            <path
              d={polygonToSvgPath(points)}
              fill="rgba(0,128,255,0.2)"
              stroke="#06f"
              strokeWidth={2}
            />
          )}
          {points.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={4} fill="#06f" />
          ))}
        </svg>

        <div className="grid grid-cols-2 gap-3 mt-3 text-white text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label="Ridge setback required"
              checked={setbacks.ridge}
              onChange={e => setSetbacks({ ...setbacks, ridge: e.target.checked })}
            />
            Ridge setback required
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label="Eave setback required"
              checked={setbacks.eave}
              onChange={e => setSetbacks({ ...setbacks, eave: e.target.checked })}
            />
            Eave setback required
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label="Rake setback required"
              checked={setbacks.rake}
              onChange={e => setSetbacks({ ...setbacks, rake: e.target.checked })}
            />
            Rake setback required
          </label>
          <label className="flex items-center gap-2">
            <span>Path:</span>
            <select
              value={setbacks.pathClear}
              onChange={e => setSetbacks({ ...setbacks, pathClear: e.target.value as 'walkable' | 'partial' | 'blocked' })}
              className="bg-gray-700 text-white px-2 py-1 rounded"
            >
              <option value="walkable">Walkable</option>
              <option value="partial">Partial</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
        </div>

        <footer className="mt-4 flex flex-col gap-2">
          {!canSave && (
            <p className="text-xs text-amber-400">
              Need at least 3 non-degenerate vertices for a valid polygon ({points.length} placed)
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-500"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className={`px-3 py-1.5 rounded ${canSave ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-gray-500 text-gray-300 cursor-not-allowed'}`}
            >
              Save
            </button>
          </div>
        </footer>
      </form>
    </div>
  )
}
