'use client'

import { ZoomIn, ZoomOut } from 'lucide-react'

const ZOOM_STEP = 0.1
const DEFAULT_SCALE = 0.55

interface ZoomToolbarProps {
  scale: number
  onScaleChange: (updater: number | ((prev: number) => number)) => void
  min: number
  max: number
}

export function ZoomToolbar({ scale, onScaleChange, min, max }: ZoomToolbarProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-md">
      <button
        onClick={() => onScaleChange(s => Math.max(min, parseFloat((s - ZOOM_STEP).toFixed(2))))}
        aria-label="Zoom out"
        disabled={scale <= min}
        className="px-2 py-1.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded-l-md disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ZoomOut size={14} />
      </button>
      <span className="px-2 text-xs text-gray-400 font-mono w-12 text-center">
        {Math.round(scale * 100)}%
      </span>
      <button
        onClick={() => onScaleChange(s => Math.min(max, parseFloat((s + ZOOM_STEP).toFixed(2))))}
        aria-label="Zoom in"
        disabled={scale >= max}
        className="px-2 py-1.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded-r-md disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ZoomIn size={14} />
      </button>
      <button
        onClick={() => onScaleChange(DEFAULT_SCALE)}
        aria-label="Reset zoom"
        className="px-2 py-1.5 text-xs text-gray-500 hover:text-white border-l border-gray-700"
      >
        Reset
      </button>
    </div>
  )
}
