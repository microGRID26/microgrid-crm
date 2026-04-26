import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ZoomToolbar } from '@/app/planset/components/ZoomToolbar'

describe('ZoomToolbar', () => {
  it('renders zoom-in and zoom-out buttons', () => {
    const onScaleChange = vi.fn()
    render(<ZoomToolbar scale={0.55} onScaleChange={onScaleChange} min={0.25} max={2.0} />)
    expect(screen.queryByLabelText(/zoom in/i)).toBeTruthy()
    expect(screen.queryByLabelText(/zoom out/i)).toBeTruthy()
    expect(screen.queryByLabelText(/reset zoom/i)).toBeTruthy()
  })

  it('displays current scale as percentage', () => {
    const onScaleChange = vi.fn()
    render(<ZoomToolbar scale={0.55} onScaleChange={onScaleChange} min={0.25} max={2.0} />)
    expect(screen.getByText('55%')).toBeTruthy()
  })

  it('calls onScaleChange with incremented value on zoom-in click', () => {
    const onScaleChange = vi.fn()
    render(<ZoomToolbar scale={0.55} onScaleChange={onScaleChange} min={0.25} max={2.0} />)
    fireEvent.click(screen.getByLabelText(/zoom in/i))
    expect(onScaleChange).toHaveBeenCalledWith(expect.any(Function))
    // Call the updater function with 0.55 and verify result
    const updater = onScaleChange.mock.calls[0][0]
    expect(updater(0.55)).toBeCloseTo(0.65, 2)
  })

  it('calls onScaleChange with decremented value on zoom-out click', () => {
    const onScaleChange = vi.fn()
    render(<ZoomToolbar scale={0.55} onScaleChange={onScaleChange} min={0.25} max={2.0} />)
    fireEvent.click(screen.getByLabelText(/zoom out/i))
    const updater = onScaleChange.mock.calls[0][0]
    expect(updater(0.55)).toBeCloseTo(0.45, 2)
  })

  it('disables zoom-out at min scale', () => {
    const onScaleChange = vi.fn()
    render(<ZoomToolbar scale={0.25} onScaleChange={onScaleChange} min={0.25} max={2.0} />)
    expect(screen.getByLabelText(/zoom out/i)).toBeDisabled()
    expect(screen.getByLabelText(/zoom in/i)).not.toBeDisabled()
  })

  it('disables zoom-in at max scale', () => {
    const onScaleChange = vi.fn()
    render(<ZoomToolbar scale={2.0} onScaleChange={onScaleChange} min={0.25} max={2.0} />)
    expect(screen.getByLabelText(/zoom in/i)).toBeDisabled()
    expect(screen.getByLabelText(/zoom out/i)).not.toBeDisabled()
  })

  it('calls onScaleChange with 0.55 on reset', () => {
    const onScaleChange = vi.fn()
    render(<ZoomToolbar scale={1.5} onScaleChange={onScaleChange} min={0.25} max={2.0} />)
    fireEvent.click(screen.getByLabelText(/reset zoom/i))
    expect(onScaleChange).toHaveBeenCalledWith(0.55)
  })
})
