'use client'

const PERM_ROWS = [
  { feature: 'View projects', sales: 'R*', user: 'R', manager: 'R', finance: 'R', admin: 'R', super_admin: 'R' },
  { feature: 'Edit projects', sales: '—', user: 'W', manager: 'W', finance: 'W', admin: 'W', super_admin: 'W' },
  { feature: 'Create projects', sales: '—', user: 'W', manager: 'W', finance: 'W', admin: 'W', super_admin: 'W' },
  { feature: 'Cancel / Reactivate', sales: '—', user: '—', manager: '—', finance: '—', admin: 'W', super_admin: 'W' },
  { feature: 'Delete projects', sales: '—', user: '—', manager: '—', finance: '—', admin: '—', super_admin: 'D' },
  { feature: 'Set blockers', sales: '—', user: 'W', manager: 'W', finance: 'W', admin: 'W', super_admin: 'W' },
  { feature: 'Task management', sales: 'R', user: 'R', manager: 'RW', finance: 'RW', admin: 'RW', super_admin: 'RW' },
  { feature: 'Add notes', sales: 'W', user: 'W', manager: 'W', finance: 'W', admin: 'W', super_admin: 'W' },
  { feature: 'Bulk operations', sales: '—', user: 'W', manager: 'W', finance: 'W', admin: 'W', super_admin: 'W' },
  { feature: 'Change orders', sales: '—', user: 'RW', manager: 'RW', finance: 'RW', admin: 'RW', super_admin: 'RW' },
  { feature: 'Schedule jobs', sales: 'R*', user: 'RW', manager: 'RW', finance: 'RW', admin: 'RW', super_admin: 'RW' },
  { feature: 'Analytics', sales: '—', user: 'R', manager: 'R', finance: 'R', admin: 'R', super_admin: 'R' },
  { feature: 'Funding page', sales: '—', user: 'R', manager: 'R', finance: 'RW', admin: 'RW', super_admin: 'RW' },
  { feature: 'Financial fields', sales: '—', user: 'R', manager: 'R', finance: 'RW', admin: 'RW', super_admin: 'RW' },
  { feature: 'Service page', sales: '—', user: 'R', manager: 'R', finance: 'R', admin: 'R', super_admin: 'R' },
  { feature: 'Documents', sales: '—', user: 'R', manager: 'R', finance: 'R', admin: 'R', super_admin: 'R' },
  { feature: 'Legacy', sales: '—', user: 'R', manager: 'R', finance: 'R', admin: 'R', super_admin: 'R' },
  { feature: 'Admin portal', sales: '—', user: '—', manager: '—', finance: '—', admin: 'RW', super_admin: 'RW' },
  { feature: 'Delete AHJ / Utility', sales: '—', user: '—', manager: '—', finance: '—', admin: '—', super_admin: 'D' },
  { feature: 'Delete feedback', sales: '—', user: '—', manager: '—', finance: '—', admin: '—', super_admin: 'D' },
  { feature: 'Manage users', sales: '—', user: '—', manager: '—', finance: '—', admin: 'RW', super_admin: 'RW' },
  { feature: 'Assign Super Admin', sales: '—', user: '—', manager: '—', finance: '—', admin: '—', super_admin: 'W' },
  { feature: 'Audit trail', sales: '—', user: '—', manager: '—', finance: '—', admin: 'R', super_admin: 'R' },
]

const PERM_BADGE: Record<string, string> = {
  'R': 'bg-blue-900/50 text-blue-300 border-blue-800',
  'R*': 'bg-blue-900/50 text-blue-300 border-blue-800',
  'W': 'bg-green-900/50 text-green-300 border-green-800',
  'RW': 'bg-green-900/50 text-green-300 border-green-800',
  'D': 'bg-red-900/50 text-red-300 border-red-800',
  '\u2014': 'bg-gray-800/30 text-gray-600 border-gray-800',
}

export function PermissionMatrix() {
  const roles = ['sales', 'user', 'manager', 'finance', 'admin', 'super_admin'] as const
  const roleLabels: Record<string, string> = { sales: 'Sales', user: 'User', manager: 'Manager', finance: 'Finance', admin: 'Admin', super_admin: 'Super Admin' }
  return (
    <div>
      <h2 className="text-base font-semibold text-white mb-1">Permission Matrix</h2>
      <p className="text-xs text-gray-500 mb-4">Read-only reference. R = Read, W = Write, D = Delete, R* = Read (own projects only), — = No access</p>
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-800/50">
              <th className="text-xs text-gray-400 font-medium text-left px-4 py-2.5">Feature</th>
              {roles.map(r => (
                <th key={r} className="text-xs text-gray-400 font-medium text-center px-3 py-2.5">{roleLabels[r]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERM_ROWS.map(row => (
              <tr key={row.feature} className="border-t border-gray-800/50">
                <td className="text-xs text-gray-200 px-4 py-2">{row.feature}</td>
                {roles.map(r => {
                  const val = row[r]
                  return (
                    <td key={r} className="text-center px-3 py-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${PERM_BADGE[val] ?? PERM_BADGE['\u2014']}`}>{val}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-600 mt-3">Reflects actual RLS policies. Last updated March 2026.</p>
    </div>
  )
}
