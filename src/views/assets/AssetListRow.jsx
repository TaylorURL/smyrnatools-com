/* eslint-disable max-lines, react/forbid-dom-props */
import React from 'react'

import StatusHistoryBar from '../../app/components/common/StatusHistoryBar'

/**
 * Single table row for the asset list view, driven by column type configs.
 * Visual rhythm matches the schedule-tab table: 12px body, 6/10 cell padding,
 * 9.5px uppercase tracked-wider status pills, 22px borderless action icons.
 * Cell backgrounds inherit from the parent row so the parent's hover styles
 * (`hover:[&>td]:bg-bg-tertiary`) apply cleanly without inline overrides.
 */
export default function AssetListRow({
    className,
    config,
    duplicates,
    item,
    onComment,
    onHistory,
    onIssue,
    onOperatorComment,
    onOperatorHistory,
    onSelect,
    onSendMessage,
    onVerify,
    operators,
    plants,
    style,
    tractors
}) {
    const { columns } = config.listConfig

    const cellBase = {
        borderBottom: '1px solid var(--border-light)',
        color: 'var(--text-primary)',
        fontSize: '12px',
        padding: '6px 10px',
        verticalAlign: 'middle'
    }

    const cellBold = { ...cellBase, fontSize: '12.5px', fontWeight: 700 }

    /** Borderless 22×22 row icon — quiet inside the row, hover-darkens. */
    const actionBtnStyle = {
        alignItems: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: '4px',
        color: 'var(--text-tertiary)',
        cursor: 'pointer',
        display: 'inline-flex',
        fontSize: '11px',
        height: '22px',
        justifyContent: 'center',
        marginRight: '2px',
        position: 'relative',
        width: '22px'
    }

    /** Copies text to clipboard and briefly swaps the icon to a checkmark. */
    const handleCopy = (e, text) => {
        e.stopPropagation()
        navigator.clipboard.writeText(text)
        const icon = e.currentTarget.querySelector('i')
        icon.className = 'fas fa-check'
        icon.style.color = '#22c55e'
        setTimeout(() => {
            icon.className = 'fas fa-copy'
            icon.style.color = ''
        }, 1500)
    }

    const copyButton = (text, title = 'Copy') => (
        <button
            type="button"
            onClick={(e) => handleCopy(e, text)}
            title={title}
            className="inline-flex items-center bg-transparent border-none cursor-pointer text-[10px] p-0.5 text-text-tertiary"
        >
            <i className="fas fa-copy" />
        </button>
    )

    const renderCell = (col) => {
        const style = col.bold ? { ...cellBold, width: col.width } : { ...cellBase, width: col.width }

        // --- Status badge ---
        if (col.type === 'status') {
            const displayStatus = col.getDisplayStatus ? col.getDisplayStatus(item) : item.status
            const badgeClasses = config.statusBadgeClasses?.[displayStatus] || 'bg-bg-tertiary text-text-secondary'
            const dateToUse = item.statusChangedAt || item.createdAt
            const days = dateToUse
                ? Math.max(1, Math.floor((Date.now() - new Date(dateToUse).getTime()) / 86400000))
                : 1
            const daysSuffix = displayStatus && displayStatus !== 'Retired' ? ` · ${days}d` : ''
            return (
                <td key={col.key} style={style}>
                    <div className="flex flex-col gap-1">
                        <span
                            className={`inline-flex items-center self-start rounded text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${badgeClasses}`}
                        >
                            {displayStatus || '---'}
                            {daysSuffix}
                        </span>
                        <StatusHistoryBar
                            itemId={item.id}
                            itemType={config.historyType}
                            currentStatus={item.status}
                            createdAt={item.createdAt}
                        />
                    </div>
                </td>
            )
        }

        // --- Truck/equipment number with copy ---
        if (col.type === 'truckNumber') {
            const val = col.getValue ? col.getValue(item) : item[col.key]
            return (
                <td key={col.key} style={{ ...cellBold, fontFamily: 'ui-monospace, monospace', width: col.width }}>
                    {val ? (
                        <div className="flex items-center gap-1">
                            <span className="tabular-nums">{val}</span>
                            {copyButton(val, col.copyTitle || 'Copy')}
                        </div>
                    ) : (
                        '---'
                    )}
                </td>
            )
        }

        // --- Operator lookup with action buttons ---
        if (col.type === 'operator') {
            const operator = operators.find((op) => op.employeeId === item[col.lookupField || 'assignedOperator'])
            const assignedTrainees = operator?.isTrainer
                ? operators.filter((op) => op.assignedTrainer === operator.employeeId)
                : []
            return (
                <td key={col.key} style={style}>
                    {operator?.name ? (
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                                <span className="font-medium">{operator.name}</span>
                                {copyButton(operator.name, 'Copy operator name')}
                            </div>
                            {assignedTrainees.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1">
                                    {assignedTrainees.map((trainee) => (
                                        <span
                                            key={trainee.employeeId}
                                            className="inline-flex items-center gap-1 rounded bg-amber-50 text-amber-800 text-[9.5px] font-semibold px-1 py-0.5"
                                            title={`Trainee: ${trainee.name}`}
                                        >
                                            <i className="fas fa-user-graduate text-[8px]" />
                                            {trainee.name}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onOperatorComment?.(operator)
                                    }}
                                    title="Operator comments"
                                    className="relative inline-flex items-center gap-1 rounded text-[10px] px-1.5 py-0.5 cursor-pointer transition-colors hover:brightness-95 bg-bg-secondary border border-border-light text-text-secondary"
                                >
                                    <i className="fas fa-comment text-[8px]" />
                                    <span>Comments</span>
                                    {operator.commentsCount > 0 && (
                                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[12px] h-3 px-0.5 rounded-full bg-blue-500 text-white text-[8px] font-bold leading-none">
                                            {operator.commentsCount > 9 ? '9+' : operator.commentsCount}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onOperatorHistory?.(operator)
                                    }}
                                    title="Operator history"
                                    className="inline-flex items-center gap-1 rounded text-[10px] px-1.5 py-0.5 cursor-pointer transition-colors hover:brightness-95 bg-bg-secondary border border-border-light text-text-secondary"
                                >
                                    <i className="fas fa-history text-[8px]" />
                                    <span>History</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <span className="italic text-text-tertiary">—</span>
                    )}
                </td>
            )
        }

        // --- Star rating (cleanliness, condition) ---
        if (col.type === 'stars') {
            const rating = Math.round(item[col.ratingField || col.key] || 0)
            const showNAForRetired = col.naForRetired && item.status === 'Retired'
            return (
                <td key={col.key} style={style}>
                    {showNAForRetired ? (
                        <span className="text-text-tertiary">N/A</span>
                    ) : (
                        <div className="flex items-center gap-px">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <i
                                    key={i}
                                    className="fas fa-star text-[9px]"
                                    style={{ color: i < rating ? '#f59e0b' : 'var(--bg-tertiary)' }}
                                />
                            ))}
                            {col.dirtyWarning && rating > 0 && rating < 3 && (
                                <span className="bg-[#fee2e2] text-[#dc2626] rounded text-[9px] font-bold uppercase tracking-wider ml-1.5 px-1 py-0.5">
                                    Dirty
                                </span>
                            )}
                        </div>
                    )}
                </td>
            )
        }

        // --- Verified button ---
        if (col.type === 'verified') {
            const isVerified = col.getIsVerified ? col.getIsVerified(item) : item.isVerified?.()
            const verifyBtnClass = (v) => {
                const base =
                    'inline-flex items-center border-none rounded font-bold uppercase tracking-wider whitespace-nowrap text-[9.5px] gap-1 px-1.5 py-0.5'
                return v
                    ? `${base} bg-[#dcfce7] text-[#166534] cursor-default`
                    : `${base} bg-[#fef3c7] text-[#92400e] cursor-pointer hover:brightness-95`
            }
            return (
                <td key={col.key} style={style}>
                    {item.status === 'Retired' ? (
                        <span className="inline-flex items-center rounded text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-bg-tertiary text-text-tertiary">
                            N/A
                        </span>
                    ) : (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onVerify?.(item.id, config.getModalIdentifier(item))
                            }}
                            title={isVerified ? 'Verified' : 'Click to verify'}
                            className={verifyBtnClass(isVerified)}
                        >
                            <i
                                className={`fas ${isVerified ? 'fa-check-circle' : 'fa-exclamation-circle'} text-[8px]`}
                            />
                            <span>{isVerified ? 'Verified' : 'Verify'}</span>
                        </button>
                    )}
                </td>
            )
        }

        // --- Tractor lookup (Trailer view) ---
        if (col.type === 'tractor') {
            const tractor = item.assignedTractor ? tractors.find((t) => t.id === item.assignedTractor) : null
            return (
                <td key={col.key} style={style}>
                    {tractor?.truckNumber || '---'}
                </td>
            )
        }

        // --- VIN with copy button and duplicate warning ---
        if (col.type === 'vin') {
            const vinVal = col.getValue ? col.getValue(item) : item[col.key]
            const normalizedKey = col.normalize?.(item)
            const isDuplicate = normalizedKey && duplicates[col.duplicateKey]?.has(normalizedKey)
            return (
                <td
                    key={col.key}
                    style={{
                        ...style,
                        color: 'var(--text-secondary)',
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '11px'
                    }}
                >
                    {vinVal ? (
                        <div className="flex items-center gap-1">
                            <span className="tabular-nums">{vinVal}</span>
                            {copyButton(vinVal, 'Copy VIN')}
                            {isDuplicate && (
                                <span
                                    className="bg-amber-50 text-amber-800 rounded text-[9px] font-bold uppercase tracking-wider px-1 py-0.5"
                                    title="Duplicate VIN"
                                >
                                    <i className="fas fa-exclamation-triangle text-[8px]" />
                                </span>
                            )}
                        </div>
                    ) : (
                        '---'
                    )}
                </td>
            )
        }

        // --- Text with duplicate warning ---
        if (col.type === 'textWithWarning') {
            const val = col.getValue ? col.getValue(item) : item[col.key]
            const normalizedKey = col.normalize?.(item)
            const isDuplicate = normalizedKey && duplicates[col.duplicateKey]?.has(normalizedKey)
            return (
                <td key={col.key} style={style}>
                    {val || '---'}
                    {isDuplicate && (
                        <span
                            className="bg-amber-50 text-amber-800 rounded text-[9px] font-bold uppercase tracking-wider ml-1.5 px-1 py-0.5"
                            title={col.warningTitle}
                        >
                            <i className="fas fa-exclamation-triangle text-[8px]" />
                        </span>
                    )}
                </td>
            )
        }

        // --- Number with conditional warning ---
        if (col.type === 'number') {
            const val = col.getValue ? col.getValue(item) : item[col.key]
            const hasWarning = col.getWarning?.(item)
            return (
                <td key={col.key} style={style}>
                    {val != null ? (
                        <span className="inline-flex items-center gap-1.5">
                            <span className="tabular-nums font-mono">{val}</span>
                            {hasWarning && (
                                <span
                                    className={
                                        col.warningClassName ||
                                        'bg-red-50 text-red-800 rounded text-[9px] font-bold uppercase tracking-wider px-1 py-0.5'
                                    }
                                    title={col.warningTitle}
                                >
                                    <i className="fas fa-exclamation-triangle text-[8px]" />
                                </span>
                            )}
                        </span>
                    ) : (
                        '---'
                    )}
                </td>
            )
        }

        // --- Actions column (comments, issues, history) ---
        if (col.type === 'actions') {
            const identifier = config.getModalIdentifier(item)
            return (
                <td key={col.key} style={style}>
                    <div className="flex items-center gap-0.5">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onComment(item.id, identifier)
                            }}
                            style={actionBtnStyle}
                            title="View comments"
                        >
                            <i className="fas fa-comments" />
                            {item.commentsCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[12px] h-3 px-0.5 rounded-full bg-blue-500 text-white text-[8px] font-bold leading-none">
                                    {item.commentsCount > 9 ? '9+' : item.commentsCount}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onIssue(item.id, identifier)
                            }}
                            style={actionBtnStyle}
                            title="View issues"
                        >
                            <i className="fas fa-tools" />
                            {item.openIssuesCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[12px] h-3 px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold leading-none">
                                    {item.openIssuesCount > 9 ? '9+' : item.openIssuesCount}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onHistory(item)
                            }}
                            style={actionBtnStyle}
                            title="View history"
                        >
                            <i className="fas fa-history" />
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onSendMessage?.(item, identifier)
                            }}
                            style={actionBtnStyle}
                            title="Send as message"
                        >
                            <i className="fas fa-paper-plane" />
                        </button>
                    </div>
                </td>
            )
        }

        // --- Plant name lookup ---
        if (col.type === 'plant') {
            const plant = plants.find((p) => p.code === item[col.key || 'assignedPlant'])
            return (
                <td key={col.key || 'plant'} style={style}>
                    {plant?.name || item[col.key || 'assignedPlant'] || '---'}
                </td>
            )
        }

        // --- Default: plain text ---
        const val = col.getValue ? col.getValue(item) : item[col.key]
        return (
            <td key={col.key} style={style}>
                {val || '---'}
            </td>
        )
    }

    return (
        <tr className={className} onClick={() => onSelect(item.id)} style={{ cursor: 'pointer', ...style }}>
            {columns.map(renderCell)}
        </tr>
    )
}
