import type { PlansetData } from '@/lib/planset-types'

/**
 * Utility Battery Mode Notification Letter
 * Sent to the utility (e.g., Oncor) to notify of battery installation and operating mode.
 * Rendered as 8.5x11 portrait (separate from 11x17 planset sheets).
 */
export function UtilityBatteryLetter({ data }: { data: PlansetData }) {
  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const totalKwh = data.totalStorageKwh

  return (
    <div className="utility-letter" style={{
      width: '8.5in',
      height: '11in',
      padding: '1in 1in 1in 1in',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '12pt',
      lineHeight: '1.6',
      color: '#000',
      background: '#fff',
      position: 'relative',
    }}>
      <p style={{ marginBottom: '24pt' }}>{dateStr.toUpperCase()}</p>

      <p style={{ marginBottom: '24pt' }}>
        {data.utility ? data.utility.toUpperCase() : 'UTILITY COMPANY'},
      </p>

      <p style={{ marginBottom: '16pt' }}>
        MICROGRID ENERGY IS INSTALLING A{' '}
        <strong>({data.batteryCount}) {data.batteryModel.toUpperCase()}{' '}
        ({data.batteryCapacity}.000kWh)</strong>{' '}
        BATTERY FOR{' '}
        <strong> {data.owner.toUpperCase()}</strong>{' '}
        AT <strong>{data.address.toUpperCase()}</strong>{data.city ? `, ${data.city.toUpperCase()}` : ''}{data.state ? `, ${data.state.toUpperCase()}` : ''}{data.zip ? `, ${data.zip}` : ''}.{' '}
        THE SYSTEM WILL BE USING THE FOLLOWING MODE:
      </p>

      <p style={{ marginBottom: '16pt' }}>
        (MODE BEING USED ONCE INSTALLED):{' '}
        <strong>({data.batteryCount}) {data.batteryModel.toUpperCase()}{' '}
        ({data.batteryCapacity}.000kWh)</strong>{' '}
        BATTERY FULL BACKUP MODE
      </p>

      <p style={{ marginBottom: 0 }}>
        (MODE DESCRIPTION): FULL BACKUP MODE ALLOWS FOR PARTIAL OR WHOLE HOME
        TRANSITION TO OFF-GRID DURING A GRID OUTAGE. ENABLING FULL BACKUP MODE
        MEANS THAT ALL YOUR{' '}
        <strong>({data.batteryCount}) {data.batteryModel.toUpperCase()}{' '}
        ({data.batteryCapacity}.000kWh)</strong>{' '}
        BATTERY STORAGE SYSTEM CAPACITY IS HELD IN RESERVE IN THE EVENT OF A
        POWER OUTAGE. WHEN THIS MODE IS SET, THE BATTERIES DO NOT CHARGE AND
        DISCHARGE WHEN THE GRID IS AVAILABLE. RESERVE CAPACITY IS NOT
        ADJUSTABLE IN FULL BACKUP MODE. THIS MODE IS FREQUENTLY USED IN AREAS
        THAT EXPERIENCE FREQUENT GRID OUTAGES WITHOUT A RELATED STORM EVENT.
      </p>
    </div>
  )
}
