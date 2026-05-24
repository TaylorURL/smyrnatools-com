/**
 * Status-driven styling helpers for the operator list row. Class map drives the
 * pastel pill background; the solid-fill map mirrors the darker hex used in
 * AssetListRow so the visual vocabulary stays consistent across asset lists.
 */

const STATUS_PILL_CLASSES = {
    Active: 'bg-[#dcfce7] text-text-primary',
    'Light Duty': 'bg-[#fef3c7] text-text-primary',
    'No Hire': 'bg-[#fee2e2] text-text-primary',
    'Pending Start': 'bg-[#dbeafe] text-text-primary',
    Terminated: 'bg-[#fecaca] text-text-primary',
    Training: 'bg-[#e0e7ff] text-text-primary'
}

const STATUS_SOLID_HEX = {
    Active: '#166534',
    'Light Duty': '#92400e',
    'No Hire': '#b91c1c',
    'Pending Start': '#1e40af',
    Terminated: '#991b1b',
    Training: '#4338ca'
}

export const statusBadgeClass = (status) => {
    const colors = STATUS_PILL_CLASSES[status] || 'bg-bg-tertiary text-text-secondary'
    return `inline-flex items-center rounded text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${colors}`
}

/** Solid-fill colour per status — used inline to force white text on a
 *  saturated background, beating the Tailwind utility classes. */
export const statusBadgeInlineStyle = (status) => {
    const bg = STATUS_SOLID_HEX[status]
    return bg ? { background: bg } : undefined
}
