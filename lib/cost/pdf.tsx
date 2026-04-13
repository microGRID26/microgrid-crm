// lib/cost/pdf.tsx — Project Cost Reconciliation & Basis PDF renderer
//
// Renders the per-project cost reconciliation as a single-page PDF that can
// be sent to tax equity partners and the IRS. Layout mirrors the proforma's
// Project Cost Reconciliation & Basis sheet:
//
//   • Header strip with brand color + project name + project ID
//   • Project summary block (system size, EPC, distributor, date)
//   • Itemized cost table grouped by section (Major Equipment, BOS, etc.)
//   • Basis breakdown summary block (PV / Battery / GPU + ITC eligible %)
//   • Support legend (Bank Transaction vs EPC-Attestation)
//   • Footer with billing contact + generation timestamp

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'

import type { CostBasisSummary, ProjectCostLineItem } from '@/lib/cost/calculator'
import type { Project } from '@/types/database'

// ── Types ───────────────────────────────────────────────────────────────────

export interface CostBasisPDFProps {
  project: Project
  lineItems: ProjectCostLineItem[]
  summary: CostBasisSummary
  generatedAt: Date
}

// ── Formatters ──────────────────────────────────────────────────────────────

// Defensive numeric coercion: Postgres NUMERIC columns come back from PostgREST
// as strings, not numbers. Calling .toFixed() / .toLocaleString() on a string
// throws inside @react-pdf's render tree walker and surfaces as the misleading
// "Cannot read properties of null (reading 'props')" error. Always coerce.
function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function fmtMoney(v: number | string | null | undefined): string {
  return `$${num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPct(v: number | string | null | undefined): string {
  return `${(num(v) * 100).toFixed(2)}%`
}

function fmtKw(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—'
  return `${num(v).toFixed(1)} kW DC`
}

function fmtMarkupX(v: number | string | null | undefined): string {
  return `${num(v).toFixed(2)}x`
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Styles ──────────────────────────────────────────────────────────────────

const BRAND_GREEN = '#1D9E75'
const INK = '#111827'
const MUTED = '#6b7280'
const DIVIDER = '#e5e7eb'
const LIGHT_BG = '#f9fafb'

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: INK,
    lineHeight: 1.4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: BRAND_GREEN,
  },
  headerLeft: {
    flexDirection: 'column',
  },
  brandTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_GREEN,
  },
  brandSubtitle: {
    fontSize: 8,
    color: MUTED,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  docLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: INK,
  },
  docDate: {
    fontSize: 9,
    color: MUTED,
    marginTop: 2,
  },
  // Project summary block
  projectBlock: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: LIGHT_BG,
    borderRadius: 4,
  },
  projectCol: {
    flex: 1,
    paddingRight: 12,
  },
  projectLabel: {
    fontSize: 7,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  projectValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: INK,
  },
  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND_GREEN,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Line item table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: DIVIDER,
  },
  tableHeaderCell: {
    fontSize: 7,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: DIVIDER,
  },
  tableRowEpcInternal: {
    backgroundColor: '#fffbeb',
  },
  tableRowItcExcluded: {
    backgroundColor: '#fef2f2',
  },
  cellItem: { flex: 4, fontSize: 8 },
  cellBucket: { flex: 1, fontSize: 7, color: MUTED, textAlign: 'left' as const },
  cellRaw: { flex: 1.2, fontSize: 8, textAlign: 'right' as const },
  cellMarkup: { flex: 0.8, fontSize: 7, color: MUTED, textAlign: 'right' as const },
  cellEpc: { flex: 1.4, fontSize: 8, textAlign: 'right' as const, fontFamily: 'Helvetica-Bold' },
  cellBattery: { flex: 1.2, fontSize: 7, textAlign: 'right' as const, color: '#0284c7' },
  cellPv: { flex: 1.2, fontSize: 7, textAlign: 'right' as const, color: '#16a34a' },
  cellEligibility: { flex: 0.8, fontSize: 7, textAlign: 'center' as const, color: MUTED },
  // Summary block
  summaryBlock: {
    marginTop: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: BRAND_GREEN,
    borderRadius: 4,
  },
  summaryTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_GREEN,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
  },
  summaryCol: {
    flex: 1,
    paddingRight: 8,
  },
  summaryLabel: {
    fontSize: 7,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: INK,
    marginBottom: 6,
  },
  summaryPct: {
    fontSize: 8,
    color: MUTED,
  },
  itcBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: DIVIDER,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itcLabel: {
    fontSize: 9,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itcValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_GREEN,
  },
  // Legend
  legend: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: MUTED,
  },
  legendItem: {
    flex: 1,
    marginRight: 8,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 7,
    color: MUTED,
    borderTopWidth: 1,
    borderTopColor: DIVIDER,
    paddingTop: 6,
    textAlign: 'center',
    lineHeight: 1.5,
  },
})

// ── React component ────────────────────────────────────────────────────────

export function CostBasisPDF({ project, lineItems, summary, generatedAt }: CostBasisPDFProps) {
  // Group line items by section for a sectioned table render
  const sections = Array.from(new Set(lineItems.map((li) => li.section)))

  return (
    <Document
      title={`Project Cost Reconciliation & Basis — ${project.name}`}
      author="MicroGRID Energy"
      subject={`Cost basis report for project ${project.id}`}
    >
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.brandTitle}>MicroGRID Energy</Text>
            <Text style={styles.brandSubtitle}>Project Cost Reconciliation & Basis</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docLabel}>BASIS REPORT</Text>
            <Text style={styles.docDate}>{fmtDate(generatedAt)}</Text>
          </View>
        </View>

        {/* Project summary */}
        <View style={styles.projectBlock}>
          <View style={styles.projectCol}>
            <Text style={styles.projectLabel}>Project</Text>
            <Text style={styles.projectValue}>{project.name}</Text>
            <Text style={[styles.projectLabel, { marginTop: 4 }]}>Project ID</Text>
            <Text style={styles.projectValue}>{project.id}</Text>
          </View>
          <View style={styles.projectCol}>
            <Text style={styles.projectLabel}>System Size</Text>
            <Text style={styles.projectValue}>{fmtKw(project.systemkw)}</Text>
            <Text style={[styles.projectLabel, { marginTop: 4 }]}>Battery Units</Text>
            <Text style={styles.projectValue}>
              {project.battery_qty ? `${project.battery_qty} units` : '—'}
            </Text>
          </View>
          <View style={styles.projectCol}>
            <Text style={styles.projectLabel}>Address</Text>
            <Text style={styles.projectValue}>{project.address ?? '—'}</Text>
            <Text style={[styles.projectLabel, { marginTop: 4 }]}>City / Utility</Text>
            <Text style={styles.projectValue}>
              {[project.city, project.utility].filter(Boolean).join(' · ') || '—'}
            </Text>
          </View>
          <View style={styles.projectCol}>
            <Text style={styles.projectLabel}>AHJ</Text>
            <Text style={styles.projectValue}>{project.ahj ?? '—'}</Text>
            <Text style={[styles.projectLabel, { marginTop: 4 }]}>Sale Date</Text>
            <Text style={styles.projectValue}>
              {project.sale_date ? fmtDate(new Date(project.sale_date)) : '—'}
            </Text>
          </View>
        </View>

        {/* Sectioned line item table */}
        {sections.map((section) => {
          const sectionItems = lineItems.filter((li) => li.section === section)
          return (
            <View key={section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{section}</Text>
              </View>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.cellItem]}>Item</Text>
                <Text style={[styles.tableHeaderCell, styles.cellBucket]}>Bucket</Text>
                <Text style={[styles.tableHeaderCell, styles.cellRaw]}>Raw</Text>
                <Text style={[styles.tableHeaderCell, styles.cellMarkup]}>K</Text>
                <Text style={[styles.tableHeaderCell, styles.cellEpc]}>EPC Price</Text>
                <Text style={[styles.tableHeaderCell, styles.cellBattery]}>Battery</Text>
                <Text style={[styles.tableHeaderCell, styles.cellPv]}>PV</Text>
                <Text style={[styles.tableHeaderCell, styles.cellEligibility]}>Basis</Text>
              </View>
              {sectionItems.map((li) => {
                const rowStyle = {
                  ...styles.tableRow,
                  ...(li.is_epc_internal ? styles.tableRowEpcInternal : {}),
                  ...(li.is_itc_excluded ? styles.tableRowItcExcluded : {}),
                }
                return (
                  <View key={li.id ?? li.item_name} style={rowStyle}>
                    <Text style={styles.cellItem}>{li.item_name}</Text>
                    <Text style={styles.cellBucket}>{li.system_bucket}</Text>
                    <Text style={styles.cellRaw}>{fmtMoney(li.raw_cost)}</Text>
                    <Text style={styles.cellMarkup}>{fmtMarkupX(li.markup_to_distro)}</Text>
                    <Text style={styles.cellEpc}>{fmtMoney(li.epc_price)}</Text>
                    <Text style={styles.cellBattery}>{fmtMoney(li.battery_cost)}</Text>
                    <Text style={styles.cellPv}>{fmtMoney(li.pv_cost)}</Text>
                    <Text style={styles.cellEligibility}>{li.basis_eligibility}</Text>
                  </View>
                )
              })}
            </View>
          )
        })}

        {/* Summary block — proforma I34:M39 equivalent */}
        <View style={styles.summaryBlock}>
          <Text style={styles.summaryTitle}>Basis Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>PV Basis</Text>
              <Text style={styles.summaryValue}>{fmtMoney(summary.pv_basis)}</Text>
              <Text style={styles.summaryPct}>{fmtPct(summary.pv_basis_pct)} of total</Text>
            </View>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Battery Basis</Text>
              <Text style={styles.summaryValue}>{fmtMoney(summary.battery_basis)}</Text>
              <Text style={styles.summaryPct}>{fmtPct(summary.battery_basis_pct)} of total</Text>
            </View>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>GPU Basis (excluded)</Text>
              <Text style={styles.summaryValue}>{fmtMoney(summary.gpu_basis)}</Text>
              <Text style={styles.summaryPct}>{fmtPct(summary.gpu_basis_pct)} of total</Text>
            </View>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Total Basis</Text>
              <Text style={styles.summaryValue}>{fmtMoney(summary.total_basis)}</Text>
              <Text style={styles.summaryPct}>{summary.line_item_count} line items</Text>
            </View>
          </View>
          <View style={styles.itcBlock}>
            <Text style={styles.itcLabel}>ITC-Eligible Basis (excludes GPU)</Text>
            <Text style={styles.itcValue}>
              {fmtMoney(summary.itc_eligible_basis)} · {fmtPct(summary.itc_eligible_pct)}
            </Text>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <Text style={styles.legendItem}>
            ▣ Yellow rows: EPC internal cost (attestation only)
          </Text>
          <Text style={styles.legendItem}>
            ▣ Red rows: ITC excluded (e.g. GPU)
          </Text>
          <Text style={styles.legendItem}>
            Markup column "K" is the additional factor: distro = raw × (1 + K)
          </Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          MicroGRID Energy · Project Cost Reconciliation & Basis · Confidential — for tax equity / IRS use only{'\n'}
          Generated {fmtDate(generatedAt)} from project cost line item data
        </Text>
      </Page>
    </Document>
  )
}

export async function renderCostBasisPDF(props: CostBasisPDFProps): Promise<Buffer> {
  return renderToBuffer(<CostBasisPDF {...props} />)
}
