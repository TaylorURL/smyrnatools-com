import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'

import { MaintenanceLogService } from '../../../services/MaintenanceLogService'
import { formatLogDate, getProgressInfo, STATUS_CONFIG } from '../../../utils/MaintenanceLogUtility'
import Badge from '../common/Badge'
import { SkeletonBar } from './MaintenanceLogSkeleton'

/** Maps a maintenance-log service-status string to the unified Badge tone. */
const STATUS_TO_TONE = {
    due_soon: 'warning',
    never_serviced: 'neutral',
    ok: 'success',
    overdue: 'danger'
}

/** Slide-out detail panel for a single piece of equipment. */
export function MaintenanceEquipmentDetail({
    equipment,
    onClose,
    onLogService,
    onEdit,
    onDelete,
    isDark,
    accentColor
}) {
    const [history, setHistory] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(true)
    const [deleting, setDeleting] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)

    useEffect(() => {
        if (!equipment) return
        setLoadingHistory(true)
        setConfirmDelete(false)
        MaintenanceLogService.fetchServiceHistory(equipment.id)
            .then(setHistory)
            .catch(() => setHistory([]))
            .finally(() => setLoadingHistory(false))
    }, [equipment])

    if (!equipment) return null

    const info = getProgressInfo(equipment)
    const cfg = STATUS_CONFIG[equipment.service_status] || STATUS_CONFIG.ok

    const handleDelete = async () => {
        setDeleting(true)
        try {
            await MaintenanceLogService.deleteEquipment(equipment.id)
            onDelete()
        } catch {
            setDeleting(false)
            setConfirmDelete(false)
        }
    }

    if (typeof document === 'undefined' || !document.body) return null

    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 flex justify-end h-screen bg-[rgba(15,_23,_42,_0.65)] z-[110] animate-[fadeIn_200ms_ease-out_both] motion-reduce:animate-none"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-lg h-full overflow-y-auto flex flex-col bg-bg-primary border-l border-border-light"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 px-3 py-2 shrink-0 bg-bg-primary border-b border-border-light">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div
                                className="flex h-7 w-7 items-center justify-center rounded shrink-0 bg-bg-tertiary"
                                style={{ color: accentColor }}
                            >
                                <i className={`fas ${equipment.category_icon || 'fa-cog'} text-[12px]`} />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[9.5px] font-semibold uppercase tracking-wider text-text-secondary">
                                    Equipment
                                </div>
                                <div className="text-[12.5px] font-semibold truncate text-text-primary">
                                    {equipment.name}
                                </div>
                                <div className="text-[10.5px] truncate text-text-tertiary">
                                    {equipment.category_name} · Plant {equipment.plant_code}
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-6 w-6 items-center justify-center rounded transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:bg-bg-tertiary border-none cursor-pointer shrink-0 text-text-secondary active:scale-[0.92]"
                            aria-label="Close"
                        >
                            <i className="fas fa-times text-[11px]" />
                        </button>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <StatusBadge status={equipment.service_status} isDark={isDark} />
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onLogService(equipment)
                            }}
                            className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider text-white px-2.5 py-1 border-none cursor-pointer active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                            style={{ background: accentColor }}
                        >
                            <i className="fas fa-wrench text-[10px]" />
                            Log Service
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onEdit(equipment)
                            }}
                            className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1 border-none cursor-pointer transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:brightness-95 bg-bg-secondary border border-border-light text-text-secondary active:scale-[0.97]"
                        >
                            <i className="fas fa-pen text-[10px]" />
                            Edit
                        </button>
                        <div className="ml-auto">
                            {confirmDelete ? (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        disabled={deleting}
                                        onClick={handleDelete}
                                        className="inline-flex items-center gap-1.5 rounded-md bg-status-danger px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-white shadow-sm transition-all duration-150 ease-out hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-danger focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary motion-reduce:transition-none"
                                    >
                                        <i
                                            className={`fas ${deleting ? 'fa-spinner animate-dv-spin' : 'fa-check'} text-[10px]`}
                                            aria-hidden="true"
                                        />
                                        {deleting ? 'Deleting\u2026' : 'Confirm'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDelete(false)}
                                        className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1 border-none cursor-pointer bg-bg-secondary border border-border-light text-text-secondary active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirmDelete(true)}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-status-danger/30 bg-status-danger/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-status-danger transition-all duration-150 ease-out hover:bg-status-danger/20 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-danger focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary motion-reduce:transition-none"
                                >
                                    <i className="fas fa-trash-alt text-[10px]" aria-hidden="true" />
                                    Delete
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Details */}
                <div className="px-4 py-3 flex-1 overflow-y-auto flex flex-col gap-3">
                    {/* Equipment Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                        {[
                            { label: 'Manufacturer', value: equipment.manufacturer },
                            { label: 'Model', value: equipment.model },
                            { label: 'Serial Number', mono: true, value: equipment.serial_number },
                            {
                                label: 'Service Interval',
                                mono: true,
                                value: equipment.service_interval_days
                                    ? `${equipment.service_interval_days} days`
                                    : null
                            },
                            {
                                label: 'Install Date',
                                mono: true,
                                value: equipment.install_date ? formatLogDate(equipment.install_date) : null
                            },
                            { label: 'Location', value: equipment.location_note }
                        ]
                            .filter((row) => row.value)
                            .map(({ label, mono, value }) => (
                                <div key={label}>
                                    <div className="text-[9.5px] font-semibold uppercase tracking-wider mb-0.5 text-text-tertiary">
                                        {label}
                                    </div>
                                    <div
                                        className={`text-[12px] font-semibold ${mono ? 'font-mono tabular-nums' : ''} text-text-primary`}
                                    >
                                        {value}
                                    </div>
                                </div>
                            ))}
                    </div>

                    {/* Service Progress */}
                    <div className="rounded p-3 bg-bg-primary border border-border-light">
                        <div className="text-[9.5px] font-semibold uppercase tracking-wider mb-2 text-text-secondary">
                            Service Progress
                        </div>
                        <div
                            className="text-[12px] font-semibold mb-2 font-mono tabular-nums"
                            style={{
                                color:
                                    info.status === 'ok' ? 'var(--text-secondary)' : isDark ? cfg.darkColor : cfg.color
                            }}
                        >
                            {info.label}
                        </div>
                        <div className="h-2 rounded-full overflow-hidden bg-bg-tertiary">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ background: cfg.barColor, width: `${info.pct * 100}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-1.5 text-[10.5px] font-mono tabular-nums text-text-tertiary">
                            <span>Last: {formatLogDate(equipment.last_service_date)}</span>
                            <span>Next: {formatLogDate(equipment.next_service_date)}</span>
                        </div>
                    </div>

                    {/* Service History */}
                    <div>
                        <div className="text-[9.5px] font-semibold uppercase tracking-wider mb-1.5 text-text-secondary">
                            Service History
                        </div>
                        {loadingHistory ? (
                            <div className="flex flex-col gap-1.5">
                                {Array.from({ length: 3 }, (_, i) => (
                                    <div key={i} className="rounded p-2.5 bg-bg-primary border border-border-light">
                                        <SkeletonBar className="h-3 w-32 mb-1" />
                                        <SkeletonBar className="h-2.5 w-48" />
                                    </div>
                                ))}
                            </div>
                        ) : history.length === 0 ? (
                            <p className="text-[11px] italic py-3 text-center m-0 text-text-tertiary">
                                No service history recorded
                            </p>
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                {history.map((entry) => (
                                    <div
                                        key={entry.id}
                                        className="rounded p-2.5 bg-bg-primary border border-border-light"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[12px] font-semibold font-mono tabular-nums text-text-primary">
                                                {formatLogDate(entry.service_date)}
                                            </span>
                                            {entry.maintenance_log_service_types?.name && (
                                                <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-bg-tertiary text-text-secondary">
                                                    {entry.maintenance_log_service_types.name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[10.5px] text-text-tertiary">
                                            {entry.performed_by_name}
                                            {entry.hours_spent ? ` · ${entry.hours_spent}h` : ''}
                                        </div>
                                        {entry.notes && (
                                            <p className="text-[11px] mt-1.5 leading-snug m-0 text-text-secondary">
                                                {entry.notes}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}

/** Small inline status badge used in the detail panel header. */
// eslint-disable-next-line unused-imports/no-unused-vars -- `isDark` retained for signature compatibility; Badge handles theming.
function StatusBadge({ status, isDark }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ok
    return (
        <Badge tone={STATUS_TO_TONE[status] || 'neutral'} size="xs" weight="bold" icon={cfg.icon.replace(/^fa-/, '')}>
            {cfg.badge}
        </Badge>
    )
}
