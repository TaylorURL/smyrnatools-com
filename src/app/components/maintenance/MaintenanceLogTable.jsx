import React from 'react'

import { formatLogDate, getProgressInfo, STATUS_CONFIG } from '../../../utils/MaintenanceLogUtility'

const TABLE_HEADERS = ['Equipment', 'Plant', 'Last Service', 'Service Progress', 'Status', '']
const COL_WIDTHS = ['', '80px', '120px', '25%', '110px', '50px']

function StatusBadge({ status, isDark }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ok
    return (
        <span
            className="inline-flex items-center gap-1 rounded text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5"
            style={{ background: isDark ? cfg.darkBg : cfg.bg, color: isDark ? cfg.darkColor : cfg.color }}
        >
            <i className={`fas ${cfg.icon} text-[9px]`} />
            {cfg.badge}
        </span>
    )
}

function ProgressBar({ item, isDark }) {
    const info = getProgressInfo(item)
    const cfg = STATUS_CONFIG[info.status] || STATUS_CONFIG.ok
    return (
        <div>
            <div
                className="text-[10.5px] font-semibold mb-1 font-mono tabular-nums"
                style={{ color: info.status === 'ok' ? 'var(--text-secondary)' : isDark ? cfg.darkColor : cfg.color }}
            >
                {info.label}
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-bg-tertiary">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ background: cfg.barColor, width: `${info.pct * 100}%` }}
                />
            </div>
        </div>
    )
}

function EmptyState({ hasEquipment }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-text-tertiary">
            <i className="fas fa-clipboard-list text-2xl mb-2" />
            <p className="text-[13px] font-semibold m-0 text-text-primary">No equipment found</p>
            <p className="text-[11px] mt-1 m-0">
                {hasEquipment
                    ? 'Try adjusting your filters'
                    : 'Add a part, unit, or component to start tracking maintenance'}
            </p>
        </div>
    )
}

/** Equipment table for the maintenance log view. */
export function MaintenanceLogTable({
    sorted,
    hasEquipment,
    sortKey,
    sortDir,
    onHeaderClick,
    onRowClick,
    onLogService,
    isDark,
    accentColor
}) {
    if (sorted.length === 0) {
        return (
            <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
                <EmptyState hasEquipment={hasEquipment} />
            </div>
        )
    }

    return (
        <div className="rounded overflow-x-auto bg-bg-primary border border-border-light">
            <table className="w-full border-collapse" style={{ minWidth: '700px' }}>
                <thead>
                    <tr className="bg-bg-secondary">
                        {TABLE_HEADERS.map((h, i) => (
                            <th
                                key={h || i}
                                className="text-left text-[9.5px] font-semibold uppercase tracking-wider py-2 px-3 cursor-pointer select-none transition-colors hover:bg-bg-tertiary border-b border-border-light text-text-secondary"
                                style={{ width: COL_WIDTHS[i] || 'auto' }}
                                onClick={() => h && onHeaderClick(h)}
                            >
                                <span className="inline-flex items-center gap-1">
                                    {h}
                                    {sortKey === h && (
                                        <i
                                            className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'} text-[9px]`}
                                            style={{ color: accentColor }}
                                        />
                                    )}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((item, idx) => (
                        <tr
                            key={item.id}
                            className="cursor-pointer transition-colors hover:bg-bg-tertiary"
                            style={{
                                background:
                                    item.service_status === 'overdue'
                                        ? isDark
                                            ? 'rgba(239,68,68,0.04)'
                                            : 'rgba(220,53,69,0.03)'
                                        : 'transparent',
                                borderBottom: idx < sorted.length - 1 ? '1px solid var(--border-light)' : 'none'
                            }}
                            onClick={() => onRowClick(item)}
                        >
                            <td className="py-2 px-3">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary"
                                        style={{ color: accentColor }}
                                    >
                                        <i className={`fas ${item.category_icon || 'fa-cog'} text-[11px]`} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[12px] font-semibold truncate text-text-primary">
                                            {item.name}
                                        </div>
                                        <div className="text-[10.5px] truncate text-text-secondary">
                                            {item.category_name}
                                            {item.manufacturer ? ` · ${item.manufacturer}` : ''}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="py-2 px-3 text-[12px] font-mono tabular-nums text-text-primary">
                                {item.plant_code}
                            </td>
                            <td className="py-2 px-3 text-[12px] font-mono tabular-nums text-text-secondary">
                                {formatLogDate(item.last_service_date)}
                            </td>
                            <td className="py-2 px-3">
                                <ProgressBar item={item} isDark={isDark} />
                            </td>
                            <td className="py-2 px-3">
                                <StatusBadge status={item.service_status} isDark={isDark} />
                            </td>
                            <td className="py-2 px-3">
                                <button
                                    type="button"
                                    className="flex items-center justify-center w-6 h-6 rounded border-none cursor-pointer transition-colors hover:brightness-95"
                                    style={{
                                        background:
                                            item.service_status === 'overdue'
                                                ? isDark
                                                    ? STATUS_CONFIG.overdue.darkBg
                                                    : STATUS_CONFIG.overdue.bg
                                                : 'var(--bg-tertiary)',
                                        color:
                                            item.service_status === 'overdue'
                                                ? isDark
                                                    ? STATUS_CONFIG.overdue.darkColor
                                                    : STATUS_CONFIG.overdue.color
                                                : 'var(--text-secondary)'
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onLogService(item)
                                    }}
                                    title="Log service"
                                >
                                    <i className="fas fa-wrench text-[10px]" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
