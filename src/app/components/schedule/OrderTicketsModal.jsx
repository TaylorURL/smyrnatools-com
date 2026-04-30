import React, { useEffect, useMemo } from 'react'

const clean = (value) => (value == null ? '' : String(value).trim())

/**
 * Modal listing every ticket loaded for a single dispatch order, sourced from
 * the per-plant DetailOrderAnalysis files. Opens from the schedule tab's
 * row-level right-click menu so dispatchers can drill in without leaving the
 * schedule view.
 *
 * Tickets are pre-sorted chronologically by `loadedTime` upstream in the
 * service merge. Each row also shows which plant loaded the truck — useful
 * for orders that pulled trucks from a sibling plant (Baytown 403/404,
 * Conroe 408/409).
 */
function OrderTicketsModal({ accentColor = '#2563eb', detail, onClose, order, plantNameByCode }) {
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.()
        }
        window.addEventListener('keydown', onKey)
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = prev
        }
    }, [onClose])

    const tickets = useMemo(() => (Array.isArray(detail?.tickets) ? detail.tickets : []), [detail])
    const totalLoaded = detail?.loadedYardage || 0
    const orderTotal = parseFloat(order?.yardage) || 0
    const orderNumLabel = order?.orderNum ? `#${order.orderNum}` : ''
    const customerLabel = clean(order?.customer)
    const homePlantCode = order?.plantCode || ''
    const homePlantName = plantNameByCode?.[homePlantCode] || ''

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)', zIndex: 2147483000 }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="rounded-2xl flex flex-col w-full overflow-hidden"
                style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.35))',
                    maxHeight: '90vh',
                    maxWidth: 900
                }}
            >
                <div
                    className="flex items-start gap-3 px-5 py-3 border-b"
                    style={{ borderColor: 'var(--border-light)' }}
                >
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${accentColor}14`, color: accentColor }}
                    >
                        <i className="fas fa-ticket text-[14px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                            Tickets {orderNumLabel}
                        </div>
                        <div
                            className="text-[12px] mt-0.5 truncate"
                            style={{ color: 'var(--text-secondary)' }}
                            title={customerLabel}
                        >
                            {customerLabel || '—'}
                            {homePlantCode && (
                                <span className="ml-2" style={{ color: 'var(--text-tertiary)' }}>
                                    · home plant {homePlantCode}
                                    {homePlantName ? ` (${homePlantName})` : ''}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                            <div
                                className="text-[10.5px] font-bold uppercase tracking-wider"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                Loaded
                            </div>
                            <div
                                className="font-mono font-bold text-[14px]"
                                style={{
                                    color:
                                        orderTotal > 0 && totalLoaded >= orderTotal ? '#16a34a' : 'var(--text-primary)',
                                    fontVariantNumeric: 'tabular-nums'
                                }}
                            >
                                {Number.isInteger(totalLoaded) ? totalLoaded : totalLoaded.toFixed(2)}
                                <span className="text-[12px] ml-1" style={{ color: 'var(--text-tertiary)' }}>
                                    / {orderTotal || '—'} yd
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-md flex items-center justify-center bg-transparent border-0 cursor-pointer"
                            style={{ color: 'var(--text-secondary)' }}
                            aria-label="Close"
                            title="Close"
                        >
                            <i className="fas fa-xmark text-[14px]" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto">
                    {tickets.length === 0 ? (
                        <div
                            className="flex flex-col items-center justify-center py-12 px-6 gap-2 text-center"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            <i className="fas fa-truck-fast text-[28px]" />
                            <div className="text-[13px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                No tickets loaded yet
                            </div>
                            <div className="text-[11.5px]">
                                Trucks haven&apos;t started loading for this order, or the bridge hasn&apos;t synced new
                                detail data yet.
                            </div>
                        </div>
                    ) : (
                        <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {[
                                        { align: 'left', label: 'Plant' },
                                        { align: 'left', label: 'Order #' },
                                        { align: 'left', label: 'Ticket #' },
                                        { align: 'left', label: 'Truck #' },
                                        { align: 'left', label: 'Driver' },
                                        { align: 'left', label: 'Ticket time' },
                                        { align: 'left', label: 'Load time' },
                                        { align: 'right', label: 'Yards' }
                                    ].map((h) => (
                                        <th
                                            key={h.label}
                                            className="px-3 py-2 font-bold uppercase tracking-wider text-[10.5px] whitespace-nowrap"
                                            style={{
                                                background: 'var(--bg-tertiary)',
                                                borderBottom: '1px solid var(--border-light)',
                                                color: 'var(--text-secondary)',
                                                position: 'sticky',
                                                textAlign: h.align,
                                                top: 0,
                                                zIndex: 1
                                            }}
                                        >
                                            {h.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {tickets.map((t, idx) => {
                                    const plantCode = t.plantId
                                    const isHomePlant = plantCode === homePlantCode
                                    const plantName = plantNameByCode?.[plantCode] || ''
                                    return (
                                        <tr
                                            key={t.ticketId || `${plantCode}-${t.ticketNum || idx}-${idx}`}
                                            style={{ borderTop: '1px solid var(--border-light)' }}
                                        >
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span
                                                    className="font-mono font-semibold"
                                                    style={{ color: 'var(--text-primary)' }}
                                                >
                                                    {plantCode || '—'}
                                                </span>
                                                {plantName && (
                                                    <span
                                                        className="ml-2 text-[11px]"
                                                        style={{ color: 'var(--text-tertiary)' }}
                                                    >
                                                        {plantName}
                                                    </span>
                                                )}
                                                {!isHomePlant && plantCode && (
                                                    <span
                                                        className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider"
                                                        style={{
                                                            background: 'rgba(217, 119, 6, 0.15)',
                                                            color: '#b45309'
                                                        }}
                                                        title={`Loaded from ${plantCode} for an order whose home plant is ${homePlantCode}`}
                                                    >
                                                        <i className="fas fa-shuffle text-[9px]" />
                                                        Cross-plant
                                                    </span>
                                                )}
                                            </td>
                                            <td
                                                className="px-3 py-2 font-mono whitespace-nowrap"
                                                style={{ color: 'var(--text-primary)' }}
                                            >
                                                {order?.orderNum ? `#${order.orderNum}` : '—'}
                                            </td>
                                            <td
                                                className="px-3 py-2 font-mono whitespace-nowrap"
                                                style={{ color: 'var(--text-primary)' }}
                                            >
                                                {t.ticketNum || '—'}
                                            </td>
                                            <td
                                                className="px-3 py-2 font-mono whitespace-nowrap"
                                                style={{ color: 'var(--text-primary)' }}
                                            >
                                                {t.truckNum || '—'}
                                            </td>
                                            <td
                                                className="px-3 py-2 font-mono whitespace-nowrap"
                                                style={{ color: 'var(--text-secondary)' }}
                                            >
                                                {t.driverNum || '—'}
                                            </td>
                                            <td
                                                className="px-3 py-2 font-mono whitespace-nowrap"
                                                style={{
                                                    color: 'var(--text-primary)',
                                                    fontVariantNumeric: 'tabular-nums'
                                                }}
                                            >
                                                {t.ticketTime || '—'}
                                            </td>
                                            <td
                                                className="px-3 py-2 font-mono whitespace-nowrap"
                                                style={{
                                                    color: 'var(--text-primary)',
                                                    fontVariantNumeric: 'tabular-nums'
                                                }}
                                            >
                                                {t.loadedTime || '—'}
                                            </td>
                                            <td
                                                className="px-3 py-2 font-mono font-bold text-right whitespace-nowrap"
                                                style={{
                                                    color: 'var(--text-primary)',
                                                    fontVariantNumeric: 'tabular-nums'
                                                }}
                                            >
                                                {Number.isInteger(t.quantity) ? t.quantity : t.quantity.toFixed(2)}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}

export default OrderTicketsModal
