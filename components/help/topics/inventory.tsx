'use client'

import { useState } from 'react'
import type { HelpTopicData } from './index'

/* ── Reusable inventory mock components (from original InventoryTraining) ─── */

function StatusBadge({ status, tooltip }: { status: string; tooltip: string }) {
  const [showTip, setShowTip] = useState(false)
  const colors: Record<string, string> = {
    needed: 'bg-gray-500/20 text-gray-400',
    ordered: 'bg-blue-500/20 text-blue-400',
    shipped: 'bg-amber-500/20 text-amber-400',
    delivered: 'bg-green-500/20 text-green-400',
    installed: 'bg-emerald-500/20 text-emerald-300',
  }
  const dots: Record<string, string> = {
    needed: 'bg-gray-400',
    ordered: 'bg-blue-400',
    shipped: 'bg-amber-400',
    delivered: 'bg-green-400',
    installed: 'bg-emerald-300',
  }
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowTip(!showTip)}
        className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer transition-all hover:ring-1 hover:ring-gray-600 ${colors[status] || colors.needed}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dots[status] || dots.needed}`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </button>
      {showTip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 shadow-xl">
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
          {tooltip}
        </div>
      )}
    </div>
  )
}

function POStatusStep({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <span className={`text-xs font-medium ${done ? 'text-green-400' : active ? 'text-blue-400' : 'text-gray-500'}`}>
      {done ? '\u2713 ' : active ? '\u25CF ' : ''}{label}
    </span>
  )
}

const MOCK_MATERIALS = [
  { name: 'Q.PEAK DUO 405W', cat: 'module', catColor: 'bg-blue-500/20 text-blue-400', qty: 25, unit: 'each', source: 'dropship', status: 'needed' as const },
  { name: 'IQ8PLUS-72-2-US', cat: 'inverter', catColor: 'bg-purple-500/20 text-purple-400', qty: 25, unit: 'each', source: 'dropship', status: 'ordered' as const },
  { name: 'Powerwall 3', cat: 'battery', catColor: 'bg-emerald-500/20 text-emerald-400', qty: 2, unit: 'each', source: 'dropship', status: 'shipped' as const },
  { name: '#10 AWG Wire', cat: 'electrical', catColor: 'bg-red-500/20 text-red-400', qty: 200, unit: 'ft', source: 'warehouse', status: 'delivered' as const },
]

const STATUS_TOOLTIPS: Record<string, string> = {
  needed: 'Item identified but not yet ordered. Click to advance to "ordered" when you place the order.',
  ordered: 'Purchase order submitted to vendor. Click to advance to "shipped" when tracking info arrives.',
  shipped: 'In transit from vendor or warehouse. Click to advance to "delivered" when it arrives on site.',
  delivered: 'Arrived on site and ready for installation. Click to advance to "installed" after crew confirms.',
  installed: 'Physically installed on the project. Final status.',
}

function MaterialsTab() {
  return (
    <div>
      <div className="text-gray-300 mb-3 text-xs">
        Every project has a Materials tab. Track equipment and BOS items needed, ordered, and delivered for each job.
      </div>
      <div className="flex items-center gap-3 mb-3 text-xs">
        <span className="text-gray-500 font-medium">Status:</span>
        <span className="text-gray-400">2 needed</span>
        <span className="text-gray-600">&middot;</span>
        <span className="text-blue-400">1 ordered</span>
        <span className="text-gray-600">&middot;</span>
        <span className="text-amber-400">1 shipped</span>
        <span className="text-gray-600">&middot;</span>
        <span className="text-green-400">1 delivered</span>
      </div>
      <div className="rounded-lg border border-gray-700 overflow-hidden mb-4">
        <div className="grid grid-cols-[1fr_80px_50px_80px_100px] gap-2 px-3 py-2 bg-gray-800/80 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-700">
          <span>Item</span><span>Category</span><span className="text-right">Qty</span><span>Source</span><span>Status</span>
        </div>
        {MOCK_MATERIALS.map((m, i) => (
          <div key={i} className={`grid grid-cols-[1fr_80px_50px_80px_100px] gap-2 px-3 py-2 items-center text-xs border-b border-gray-800 last:border-b-0 ${i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/60'}`}>
            <span className="text-white font-medium truncate">{m.name}</span>
            <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium w-fit ${m.catColor}`}>{m.cat}</span>
            <span className="text-gray-300 text-right">{m.qty}</span>
            <span className="text-gray-400">{m.source}</span>
            <StatusBadge status={m.status} tooltip={STATUS_TOOLTIPS[m.status]} />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="bg-gray-800/50 rounded-lg px-4 py-3 border-l-2 border-green-500">
          <div className="text-xs font-bold text-green-400 mb-1">Step 1: Auto-Generate</div>
          <div className="text-xs text-gray-400">Click Auto-generate to pull equipment from the project specs.</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg px-4 py-3 border-l-2 border-blue-500">
          <div className="text-xs font-bold text-blue-400 mb-1">Step 2: Add Custom Items</div>
          <div className="text-xs text-gray-400">Add BOS items like wire, conduit, breakers, or racking.</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg px-4 py-3 border-l-2 border-amber-500">
          <div className="text-xs font-bold text-amber-400 mb-1">Step 3: Track Status</div>
          <div className="text-xs text-gray-400">Click any status badge to advance: needed &rarr; ordered &rarr; shipped &rarr; delivered &rarr; installed.</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg px-4 py-3 border-l-2 border-purple-500">
          <div className="text-xs font-bold text-purple-400 mb-1">Step 4: Create Purchase Orders</div>
          <div className="text-xs text-gray-400">Select items and click Create PO. System generates a PO number and marks items as ordered.</div>
        </div>
      </div>
    </div>
  )
}

function PurchaseOrders() {
  return (
    <div>
      <div className="text-gray-300 mb-3 text-xs">Purchase orders group materials by vendor and track through a 5-step lifecycle.</div>
      <div className="rounded-lg border border-gray-700 bg-gray-800/40 px-4 py-4 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-sm font-bold text-white">PO-20260325-001</div>
            <div className="text-xs text-gray-400 mt-0.5">Vendor: <span className="text-gray-300">Q Cells</span> <span className="text-gray-600 mx-2">&middot;</span> Project: <span className="text-green-400">PROJ-28490</span></div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium bg-blue-500/20 text-blue-400">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />Confirmed
          </span>
        </div>
        <div className="flex items-center gap-1 mb-3 px-2 py-2 bg-gray-900/60 rounded-md text-xs">
          <span className="text-[10px] text-gray-500 mr-2">Timeline:</span>
          <POStatusStep label="Draft" done active={false} />
          <span className="text-gray-600 mx-1">&rarr;</span>
          <POStatusStep label="Submitted" done active={false} />
          <span className="text-gray-600 mx-1">&rarr;</span>
          <POStatusStep label="Confirmed" done={false} active />
          <span className="text-gray-600 mx-1">&rarr;</span>
          <POStatusStep label="Shipped" done={false} active={false} />
          <span className="text-gray-600 mx-1">&rarr;</span>
          <POStatusStep label="Delivered" done={false} active={false} />
        </div>
      </div>
      <div className="space-y-1 text-xs">
        {[
          'When a PO reaches "Delivered", all linked materials auto-update',
          'Add tracking numbers when orders ship',
          'Cancelled POs revert materials back to "needed"',
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-gray-400">
            <span className="text-green-400 mt-0.5 font-bold shrink-0">&bull;</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Warehouse() {
  const items = [
    { name: '#10 AWG Wire (ft)', cat: 'electrical', catColor: 'bg-red-500/20 text-red-400', onHand: 150, reorder: 200, low: true },
    { name: '30A Breaker', cat: 'electrical', catColor: 'bg-red-500/20 text-red-400', onHand: 8, reorder: 10, low: true },
    { name: 'IronRidge XR100', cat: 'racking', catColor: 'bg-orange-500/20 text-orange-400', onHand: 45, reorder: 20, low: false },
  ]
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <span className="text-amber-400 text-sm">&#9888;</span>
        <span className="text-xs text-amber-400 font-medium">2 items below reorder point</span>
      </div>
      <div className="rounded-lg border border-gray-700 overflow-hidden mb-4">
        <div className="grid grid-cols-[1fr_80px_70px_70px] gap-2 px-3 py-2 bg-gray-800/80 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-700">
          <span>Item</span><span>Category</span><span className="text-right">On Hand</span><span className="text-right">Reorder</span>
        </div>
        {items.map((w, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_70px_70px] gap-2 px-3 py-2 items-center text-xs border-b border-gray-800 last:border-b-0 bg-gray-900">
            <span className="text-white font-medium truncate">{w.name}</span>
            <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium w-fit ${w.catColor}`}>{w.cat}</span>
            <span className={`text-right font-medium ${w.low ? 'text-red-400' : 'text-gray-300'}`}>{w.onHand}</span>
            <span className="text-right text-gray-500">{w.reorder}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-gray-800/50 rounded-lg px-3 py-2.5 border-l-2 border-green-500">
          <div className="font-bold text-green-400 mb-1">Checkout</div>
          <div className="text-[11px] text-gray-400">Select project, enter qty. Stock decreases.</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg px-3 py-2.5 border-l-2 border-blue-500">
          <div className="font-bold text-blue-400 mb-1">Check-in</div>
          <div className="text-[11px] text-gray-400">Return unused items. Stock increases.</div>
        </div>
      </div>
    </div>
  )
}

function BarcodeScan() {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">
        Scan warehouse item barcodes from your phone to instantly look up stock and perform check-out or check-in actions in the field.
      </p>
      <div className="space-y-3">
        <div className="bg-gray-800/50 rounded-lg px-4 py-3 border-l-2 border-green-500">
          <div className="text-xs font-bold text-green-400 mb-1">Step 1: Assign Barcodes</div>
          <div className="text-xs text-gray-400">Edit a warehouse stock item and enter its barcode value. Print labels and affix to bins or items.</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg px-4 py-3 border-l-2 border-blue-500">
          <div className="text-xs font-bold text-blue-400 mb-1">Step 2: Open Scanner</div>
          <div className="text-xs text-gray-400">Go to <span className="text-green-400 font-mono">/mobile/scan</span> on your phone. Tap to open the camera, or type the barcode manually.</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg px-4 py-3 border-l-2 border-amber-500">
          <div className="text-xs font-bold text-amber-400 mb-1">Step 3: Scan &amp; Act</div>
          <div className="text-xs text-gray-400">Point camera at barcode. System shows item details, quantity on hand, and location. Choose Checkout (for a project) or Check In.</div>
        </div>
      </div>
      <div className="mt-4 space-y-1 text-xs">
        {[
          'Supports EAN-13, EAN-8, QR Code, Code 128, Code 39, UPC-A, UPC-E',
          'Camera scanning requires Chrome or Edge on Android (BarcodeDetector API)',
          'Manual text entry works on all browsers as a fallback',
          'Use the Location field to track items by crew truck (e.g., "Truck 1")',
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-gray-400">
            <span className="text-green-400 mt-0.5 font-bold shrink-0">&bull;</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EquipmentCatalog() {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">Equipment fields in the project panel use autocomplete from a catalog of 2,517 items. System kW auto-calculates from module wattage and panel count.</p>
      <div className="space-y-1 text-xs">
        {[
          'Start typing a manufacturer or model name in any equipment field',
          'System kW = module wattage x panel count / 1000',
          'Admins manage the catalog from Equipment Manager in Admin portal',
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-gray-400">
            <span className="text-gray-600 mt-0.5">&bull;</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export const inventoryTopics: HelpTopicData[] = [
  {
    id: 'materials-tab',
    title: 'Materials Tab',
    description: 'Track project equipment and BOS items',
    category: 'Inventory & Materials',
    keywords: ['materials', 'inventory', 'equipment', 'bos', 'module', 'inverter', 'battery', 'track'],
    tryItLink: '/inventory',
    relatedTopics: ['purchase-orders', 'equipment-catalog'],
    content: MaterialsTab,
  },
  {
    id: 'purchase-orders',
    title: 'Purchase Orders',
    description: 'PO lifecycle from draft to delivered',
    category: 'Inventory & Materials',
    keywords: ['purchase', 'order', 'po', 'vendor', 'draft', 'submitted', 'shipped', 'delivered'],
    tryItLink: '/inventory',
    relatedTopics: ['materials-tab', 'warehouse'],
    content: PurchaseOrders,
  },
  {
    id: 'warehouse',
    title: 'Warehouse Stock',
    description: 'Checkout, check-in, and stock alerts',
    category: 'Inventory & Materials',
    keywords: ['warehouse', 'stock', 'checkout', 'checkin', 'reorder', 'inventory', 'adjust'],
    tryItLink: '/inventory',
    relatedTopics: ['materials-tab'],
    content: Warehouse,
  },
  {
    id: 'barcode-scanning',
    title: 'Barcode Scanning',
    description: 'Scan barcodes to look up and manage warehouse stock from mobile',
    category: 'Inventory & Materials',
    keywords: ['barcode', 'scan', 'qr', 'camera', 'mobile', 'warehouse', 'checkout', 'checkin', 'label', 'truck'],
    tryItLink: '/mobile/scan',
    relatedTopics: ['warehouse', 'materials-tab'],
    content: BarcodeScan,
  },
  {
    id: 'equipment-catalog',
    title: 'Equipment Catalog',
    description: 'Autocomplete from 2,517 items, auto-kW',
    category: 'Inventory & Materials',
    keywords: ['equipment', 'catalog', 'autocomplete', 'panel', 'module', 'inverter', 'kw', 'wattage'],
    relatedTopics: ['materials-tab', 'equipment-manager'],
    content: EquipmentCatalog,
  },
]
