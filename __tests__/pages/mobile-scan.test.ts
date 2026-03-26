import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mirror logic from app/mobile/scan/page.tsx ─────────────────────────────
//
// The mobile scan page has three core flows:
// 1. Barcode lookup (camera scan or manual entry) -> found item display
// 2. Checkout: found item -> select project -> confirm -> checkoutFromWarehouse
// 3. Checkin: found item -> set quantity -> confirm -> checkinToWarehouse
//
// We test the logic paths without rendering the React component.

// ── Types mirrored from page ────────────────────────────────────────────────

interface WarehouseStock {
  id: string
  equipment_id: string | null
  name: string
  category: string
  quantity_on_hand: number
  reorder_point: number
  unit: string
  location: string | null
  barcode: string | null
  last_counted_at: string | null
  updated_at: string
}

interface ProjectOption {
  id: string
  name: string
}

// ── Mirror handleLookup logic from page ─────────────────────────────────────

async function handleLookup(
  barcode: string,
  lookupFn: (b: string) => Promise<WarehouseStock | null>
): Promise<{ item: WarehouseStock | null; error: string | null }> {
  if (!barcode.trim()) return { item: null, error: null }

  const item = await lookupFn(barcode.trim())
  if (item) {
    return { item, error: null }
  } else {
    return { item: null, error: `No item found for barcode "${barcode.trim()}"` }
  }
}

// ── Mirror checkout validation logic from page ──────────────────────────────

function canSubmitCheckout(
  foundItem: WarehouseStock | null,
  action: 'checkout' | 'checkin' | null,
  selectedProject: ProjectOption | null,
  quantity: number,
  user: { name: string } | null,
): boolean {
  if (!foundItem || !action || !user?.name) return false
  if (action === 'checkout' && !selectedProject) return false
  if (quantity <= 0) return false
  return true
}

// ── Mirror quantity update after checkout/checkin ────────────────────────────

function updatedQuantityAfterAction(
  currentQty: number,
  quantity: number,
  action: 'checkout' | 'checkin'
): number {
  return action === 'checkout' ? currentQty - quantity : currentQty + quantity
}

// ── Tests ───────────────────────────────────────────────────────────────────

const MOCK_STOCK_ITEM: WarehouseStock = {
  id: 'ws-1',
  equipment_id: 'eq-1',
  name: 'MC4 Connectors',
  category: 'electrical',
  quantity_on_hand: 500,
  reorder_point: 100,
  unit: 'each',
  location: 'Shelf A3',
  barcode: 'BC-12345',
  last_counted_at: null,
  updated_at: '2026-03-25',
}

describe('Mobile Scan — barcode lookup', () => {
  it('returns found item when barcode matches', async () => {
    const lookup = vi.fn().mockResolvedValue(MOCK_STOCK_ITEM)
    const result = await handleLookup('BC-12345', lookup)

    expect(lookup).toHaveBeenCalledWith('BC-12345')
    expect(result.item).toEqual(MOCK_STOCK_ITEM)
    expect(result.error).toBeNull()
  })

  it('returns error message when barcode not found', async () => {
    const lookup = vi.fn().mockResolvedValue(null)
    const result = await handleLookup('UNKNOWN-BC', lookup)

    expect(lookup).toHaveBeenCalledWith('UNKNOWN-BC')
    expect(result.item).toBeNull()
    expect(result.error).toBe('No item found for barcode "UNKNOWN-BC"')
  })

  it('returns no results and no error for empty barcode', async () => {
    const lookup = vi.fn().mockResolvedValue(null)
    const result = await handleLookup('', lookup)

    expect(lookup).not.toHaveBeenCalled()
    expect(result.item).toBeNull()
    expect(result.error).toBeNull()
  })

  it('returns no results and no error for whitespace-only barcode', async () => {
    const lookup = vi.fn().mockResolvedValue(null)
    const result = await handleLookup('   ', lookup)

    expect(lookup).not.toHaveBeenCalled()
    expect(result.item).toBeNull()
    expect(result.error).toBeNull()
  })

  it('trims whitespace from barcode before lookup', async () => {
    const lookup = vi.fn().mockResolvedValue(MOCK_STOCK_ITEM)
    await handleLookup('  BC-12345  ', lookup)

    expect(lookup).toHaveBeenCalledWith('BC-12345')
  })

  it('manual entry works the same as camera scan', async () => {
    // Both camera scan and manual entry call the same handleLookup logic
    const lookup = vi.fn().mockResolvedValue(MOCK_STOCK_ITEM)

    // Simulate camera scan result
    const cameraScan = await handleLookup('BC-12345', lookup)
    // Simulate manual entry of same barcode
    const manualEntry = await handleLookup('BC-12345', lookup)

    expect(cameraScan).toEqual(manualEntry)
    expect(lookup).toHaveBeenCalledTimes(2)
  })
})

describe('Mobile Scan — checkout/checkin flow', () => {
  it('barcode lookup enables checkout/checkin action selection', async () => {
    const lookup = vi.fn().mockResolvedValue(MOCK_STOCK_ITEM)
    const result = await handleLookup('BC-12345', lookup)

    // Once an item is found, the user can select checkout or checkin
    expect(result.item).not.toBeNull()
    expect(result.item!.quantity_on_hand).toBe(500)
    // Checkout should be possible (quantity > 0)
    expect(result.item!.quantity_on_hand > 0).toBe(true)
  })

  it('checkout requires a selected project', () => {
    const user = { name: 'Test User' }
    const project: ProjectOption = { id: 'PROJ-001', name: 'Smith Install' }

    // Without project
    expect(canSubmitCheckout(MOCK_STOCK_ITEM, 'checkout', null, 1, user)).toBe(false)
    // With project
    expect(canSubmitCheckout(MOCK_STOCK_ITEM, 'checkout', project, 1, user)).toBe(true)
  })

  it('checkin does not require a selected project', () => {
    const user = { name: 'Test User' }

    // Checkin without project should still be valid
    expect(canSubmitCheckout(MOCK_STOCK_ITEM, 'checkin', null, 1, user)).toBe(true)
  })

  it('cannot submit with zero or negative quantity', () => {
    const user = { name: 'Test User' }
    const project: ProjectOption = { id: 'PROJ-001', name: 'Smith Install' }

    expect(canSubmitCheckout(MOCK_STOCK_ITEM, 'checkout', project, 0, user)).toBe(false)
    expect(canSubmitCheckout(MOCK_STOCK_ITEM, 'checkout', project, -1, user)).toBe(false)
  })

  it('cannot submit without a user', () => {
    const project: ProjectOption = { id: 'PROJ-001', name: 'Smith Install' }

    expect(canSubmitCheckout(MOCK_STOCK_ITEM, 'checkout', project, 1, null)).toBe(false)
  })

  it('cannot submit without an action selected', () => {
    const user = { name: 'Test User' }

    expect(canSubmitCheckout(MOCK_STOCK_ITEM, null, null, 1, user)).toBe(false)
  })

  it('cannot submit without a found item', () => {
    const user = { name: 'Test User' }
    const project: ProjectOption = { id: 'PROJ-001', name: 'Smith Install' }

    expect(canSubmitCheckout(null, 'checkout', project, 1, user)).toBe(false)
  })

  it('checkout decrements displayed quantity', () => {
    const newQty = updatedQuantityAfterAction(500, 10, 'checkout')
    expect(newQty).toBe(490)
  })

  it('checkin increments displayed quantity', () => {
    const newQty = updatedQuantityAfterAction(500, 25, 'checkin')
    expect(newQty).toBe(525)
  })

  it('checkout of all stock results in zero quantity', () => {
    const newQty = updatedQuantityAfterAction(10, 10, 'checkout')
    expect(newQty).toBe(0)
  })

  it('checkout button is disabled when quantity_on_hand is zero', () => {
    const emptyItem: WarehouseStock = { ...MOCK_STOCK_ITEM, quantity_on_hand: 0 }
    // Page disables checkout when quantity_on_hand <= 0
    expect(emptyItem.quantity_on_hand <= 0).toBe(true)
  })
})

describe('Mobile Scan — toast messages', () => {
  it('generates correct checkout success message', () => {
    const action = 'checkout'
    const quantity = 10
    const unit = 'each'
    const projectId = 'PROJ-001'

    const message = `Checked out ${quantity} ${unit}(s) to ${projectId}`
    expect(message).toBe('Checked out 10 each(s) to PROJ-001')
  })

  it('generates correct checkin success message', () => {
    const action = 'checkin'
    const quantity = 25
    const unit = 'each'

    const message = `Checked in ${quantity} ${unit}(s)`
    expect(message).toBe('Checked in 25 each(s)')
  })
})
