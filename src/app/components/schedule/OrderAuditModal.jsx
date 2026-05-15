/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useState } from 'react'

import { ScheduleSnapshotService } from '../../../services/ScheduleSnapshotService'
import { diffOrderAgainstSnapshot } from '../../../utils/ScheduleDiffUtility'

const formatTimestamp = (iso) => {
    if (!iso) return '—'
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString(undefined, {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        year: 'numeric'
    })
}

/**
 * Right-click → "Order Audit" popup. Looks up the 5:30 PM snapshot for the
 * order's schedule date and diffs every tracked field against the live
 * order. Surfaces moves, spacing changes, address swaps, plant
 * reassignments, etc. — or an "Added since snapshot" badge when the order
 * didn't exist at the 5:30 PM checkpoint.
 */
export default function OrderAuditModal({ accentColor = '#2563eb', onClose, order, planDate }) {
    const [snapshot, setSnapshot] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        ;(async () => {
            const result = await ScheduleSnapshotService.getSnapshot(planDate)
            if (!cancelled) {
                setSnapshot(result)
                setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [planDate])

    useEffect(() => {
        const onKey = (event) => {
            if (event.key === 'Escape') onClose?.()
        }
        window.addEventListener('keydown', onKey)
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = previous
        }
    }, [onClose])

    const diff = useMemo(() => {
        if (!order) return null
        return diffOrderAgainstSnapshot(snapshot, order)
    }, [snapshot, order])

    const orderNumLabel = order?.orderNum ? `#${order.orderNum}` : ''
    const customerLabel = order?.customer || ''
    const snapshotMissing = !loading && !snapshot

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            className="fixed inset-0 flex items-center justify-center p-4 bg-[rgba(0,0,0,0.55)] z-[2147483000]"
        >
            <div
                onClick={(event) => event.stopPropagation()}
                className="rounded-2xl flex flex-col w-full overflow-hidden bg-bg-primary border border-border-light"
                style={{
                    boxShadow: 'var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.35))',
                    maxHeight: '85vh',
                    maxWidth: 720
                }}
            >
                <div className="flex items-start gap-3 px-5 py-3 border-b border-border-light">
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${accentColor}14`, color: accentColor }}
                    >
                        <i className="fas fa-clock-rotate-left text-[14px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-bold leading-tight text-text-primary">
                            Order Audit {orderNumLabel}
                        </div>
                        <div className="text-[12px] mt-0.5 truncate text-text-secondary">
                            {customerLabel || '—'}
                            <span className="ml-2 text-text-tertiary">
                                · vs. 5:30 PM snapshot for {planDate || '—'}
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-md flex items-center justify-center bg-transparent border-0 cursor-pointer text-text-secondary"
                        aria-label="Close"
                        title="Close"
                    >
                        <i className="fas fa-xmark text-[14px]" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto px-5 py-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center text-text-tertiary">
                            <i className="fas fa-circle-notch fa-spin text-[20px] mb-2" />
                            <div className="text-[13px]">Loading snapshot…</div>
                        </div>
                    ) : snapshotMissing ? (
                        <div className="rounded-xl px-4 py-4 bg-amber-50 border border-amber-200 text-[13px] text-amber-800">
                            <div className="font-semibold mb-1">No snapshot for this day.</div>
                            Snapshots are captured at 5:30 PM Central the evening before. Sundays and empty days are
                            skipped — for those dates the audit has nothing to compare against.
                        </div>
                    ) : !diff ? (
                        <div className="rounded-xl px-4 py-4 bg-bg-secondary border border-border-light text-[13px] text-text-secondary">
                            Couldn&apos;t resolve this order for diffing.
                        </div>
                    ) : (
                        <DiffBody accentColor={accentColor} diff={diff} snapshot={snapshot} />
                    )}
                </div>
            </div>
        </div>
    )
}

function DiffBody({ accentColor, diff, snapshot }) {
    const kindLabel = {
        added: 'Added since 5:30 PM',
        changed: `${diff.changes.length} change${diff.changes.length === 1 ? '' : 's'} since 5:30 PM`,
        removed: 'Removed since 5:30 PM',
        unchanged: 'No changes since 5:30 PM'
    }[diff.kind]
    const kindClass = {
        added: 'bg-green-50 border-green-200 text-green-700',
        changed: 'bg-amber-50 border-amber-200 text-amber-800',
        removed: 'bg-red-50 border-red-200 text-red-700',
        unchanged: 'bg-bg-secondary border-border-light text-text-secondary'
    }[diff.kind]
    const kindIcon = {
        added: 'fa-circle-plus',
        changed: 'fa-shuffle',
        removed: 'fa-circle-minus',
        unchanged: 'fa-circle-check'
    }[diff.kind]

    return (
        <div className="flex flex-col gap-3">
            <div className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-3 ${kindClass}`}>
                <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold">
                    <i className={`fas ${kindIcon} text-[12px]`} />
                    {kindLabel}
                </span>
                {snapshot?.captured_at && (
                    <span className="text-[11px] text-text-tertiary">
                        Snapshot taken {formatTimestamp(snapshot.captured_at)}
                    </span>
                )}
            </div>

            {diff.kind === 'unchanged' && (
                <div className="text-[12.5px] text-text-secondary px-1">
                    Every tracked field on this order matches the 5:30 PM snapshot exactly.
                </div>
            )}

            {diff.kind === 'added' && (
                <div className="text-[12.5px] text-text-secondary px-1">
                    This order was not on the schedule at 5:30 PM yesterday — it&apos;s been added since.
                </div>
            )}

            {diff.kind === 'removed' && (
                <div className="text-[12.5px] text-text-secondary px-1">
                    This order was on the schedule at 5:30 PM but is no longer on the live schedule.
                </div>
            )}

            {diff.changes.length > 0 && (
                <div className="rounded-xl border overflow-hidden bg-bg-primary border-border-light">
                    <table className="w-full text-[12.5px] border-collapse">
                        <thead>
                            <tr className="bg-bg-tertiary">
                                <th className="text-left px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary">
                                    Field
                                </th>
                                <th className="text-left px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary">
                                    Was (5:30 PM)
                                </th>
                                <th className="text-left px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary">
                                    Now
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {diff.changes.map((change) => (
                                <tr key={change.field} className="border-t border-border-light">
                                    <td className="px-3 py-2 font-semibold text-text-primary whitespace-nowrap">
                                        {change.label}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-text-secondary line-through">
                                        {change.before || '—'}
                                    </td>
                                    <td className="px-3 py-2 font-mono font-semibold" style={{ color: accentColor }}>
                                        {change.after || '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
