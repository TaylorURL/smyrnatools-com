import React from 'react'

import OperatorClockIndicator from '../../app/components/common/OperatorClockIndicator'
import StatusHistoryBar from '../../app/components/common/StatusHistoryBar'

/**
 * Status name → solid pill palette (background + white text).
 * Falls back to a neutral slate if the status isn't in the map.
 */
const STATUS_PILL_PALETTE = {
    Active: 'bg-status-active text-white',
    'Down In Yard': 'bg-status-danger text-white',
    'In Shop': 'bg-status-shop text-white',
    'No Hire': 'bg-status-danger text-white',
    'Pending Start': 'bg-status-shop text-white',
    'Ready For Pickup': 'bg-status-active text-white',
    Retired: 'bg-bg-tertiary text-text-secondary',
    Sold: 'bg-bg-tertiary text-text-secondary',
    Spare: 'bg-status-spare text-white',
    Stationary: 'bg-status-shop text-white',
    Terminated: 'bg-status-danger text-white',
    'Third Party Work': 'bg-status-spare text-white',
    Training: 'bg-status-warning text-white',
    'Waiting For Shop': 'bg-status-warning text-white'
}

const NEUTRAL_PILL = 'bg-bg-tertiary text-text-secondary'

const VERIFIED_BUTTON_CLASS = 'bg-status-active text-white hover:brightness-110'
const UNVERIFIED_BUTTON_CLASS = 'bg-status-warning text-white hover:brightness-110 cursor-pointer'

const ICON_BUTTON_CLASS =
    'relative inline-flex items-center justify-center w-[22px] h-[22px] rounded-md border-none bg-transparent text-[11px] text-text-tertiary cursor-pointer transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset'

const COUNT_BADGE_BASE =
    'absolute -top-0.5 -right-0.5 inline-flex min-w-[12px] h-3 items-center justify-center rounded-full px-0.5 text-[8px] font-bold leading-none text-white'

const CELL_BASE_CLASS = 'border-b border-border-light px-2.5 py-1.5 text-[12px] align-middle text-text-primary'
const CELL_BOLD_CLASS = `${CELL_BASE_CLASS} text-[12.5px] font-bold`

/**
 * Resolves the solid-fill pill class for a status string.
 * Centralizes the palette so every asset type renders identical pills.
 */
const getStatusPillClass = (status) => STATUS_PILL_PALETTE[status] || NEUTRAL_PILL

/**
 * Single table row for the asset list view, driven by column type configs.
 * Visual rhythm matches the schedule-tab table: 12px body, 6/10 cell padding,
 * 9.5px uppercase tracked-wider status pills, 22px borderless action icons.
 *
 * Uses semantic status tokens (`bg-status-*`) for pills + verify buttons —
 * the per-asset palette stays consistent across all 5 asset types and
 * respects all three themes (light/dark/gray).
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

    /** Copies text to clipboard with a 1.5s checkmark confirmation. */
    const handleCopy = (event, text) => {
        event.stopPropagation()
        navigator.clipboard.writeText(text)
        const icon = event.currentTarget.querySelector('i')
        if (!icon) return
        const original = icon.className
        icon.className = 'fas fa-check text-status-active'
        setTimeout(() => {
            icon.className = original
        }, 1500)
    }

    const copyButton = (text, title = 'Copy') => (
        <button
            type="button"
            onClick={(event) => handleCopy(event, text)}
            title={title}
            aria-label={title}
            className="inline-flex items-center bg-transparent border-none cursor-pointer text-[10px] p-0.5 text-text-tertiary transition-colors duration-150 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
        >
            <i className="fas fa-copy" />
        </button>
    )

    const widthStyle = (width) => (width ? { width } : undefined)

    const renderCell = (col) => {
        const cellClass = col.bold ? CELL_BOLD_CLASS : CELL_BASE_CLASS

        if (col.type === 'status') {
            const displayStatus = col.getDisplayStatus ? col.getDisplayStatus(item) : item.status
            const dateToUse = item.statusChangedAt || item.createdAt
            const days = dateToUse
                ? Math.max(1, Math.floor((Date.now() - new Date(dateToUse).getTime()) / 86400000))
                : 1
            const daysSuffix = displayStatus && displayStatus !== 'Retired' ? ` · ${days}d` : ''
            return (
                <td key={col.key} className={cellClass} style={widthStyle(col.width)}>
                    <div className="flex flex-col gap-1">
                        <span
                            className={`inline-flex items-center self-start rounded-md px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${getStatusPillClass(displayStatus)}`}
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

        if (col.type === 'truckNumber') {
            const val = col.getValue ? col.getValue(item) : item[col.key]
            return (
                <td key={col.key} className={`${CELL_BOLD_CLASS} font-mono`} style={widthStyle(col.width)}>
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

        if (col.type === 'operator') {
            const operator = operators.find((op) => op.employeeId === item[col.lookupField || 'assignedOperator'])
            const assignedTrainees = operator?.isTrainer
                ? operators.filter((op) => op.assignedTrainer === operator.employeeId)
                : []
            return (
                <td key={col.key} className={cellClass} style={widthStyle(col.width)}>
                    {operator?.name ? (
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                                <OperatorClockIndicator badge={operator.smyrnaId || operator.employeeId} />
                                <span className="font-medium">{operator.name}</span>
                                {copyButton(operator.name, 'Copy operator name')}
                            </div>
                            {assignedTrainees.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1">
                                    {assignedTrainees.map((trainee) => (
                                        <span
                                            key={trainee.employeeId}
                                            className="inline-flex items-center gap-1 rounded-md bg-status-warning/10 text-status-warning text-[9.5px] font-semibold px-1 py-0.5"
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
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        onOperatorComment?.(operator)
                                    }}
                                    title="Operator comments"
                                    aria-label="Operator comments"
                                    className="relative inline-flex items-center gap-1 rounded-md text-[10px] px-1.5 py-0.5 cursor-pointer bg-bg-secondary border border-border-light text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                >
                                    <i className="fas fa-comment text-[8px]" />
                                    <span>Comments</span>
                                    {operator.commentsCount > 0 && (
                                        <span className={`${COUNT_BADGE_BASE} bg-accent`}>
                                            {operator.commentsCount > 9 ? '9+' : operator.commentsCount}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        onOperatorHistory?.(operator)
                                    }}
                                    title="Operator history"
                                    aria-label="Operator history"
                                    className="inline-flex items-center gap-1 rounded-md text-[10px] px-1.5 py-0.5 cursor-pointer bg-bg-secondary border border-border-light text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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

        if (col.type === 'stars') {
            const rating = Math.round(item[col.ratingField || col.key] || 0)
            const showNAForRetired = col.naForRetired && item.status === 'Retired'
            return (
                <td key={col.key} className={cellClass} style={widthStyle(col.width)}>
                    {showNAForRetired ? (
                        <span className="text-text-tertiary">N/A</span>
                    ) : (
                        <div className="flex items-center gap-px">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <i
                                    key={i}
                                    className={`fas fa-star text-[9px] ${i < rating ? 'text-status-warning' : 'text-border-light'}`}
                                />
                            ))}
                            {col.dirtyWarning && rating > 0 && rating < 3 && (
                                <span className="ml-1.5 inline-flex items-center rounded-md bg-status-danger/10 text-status-danger text-[9px] font-bold uppercase tracking-wider px-1 py-0.5">
                                    Dirty
                                </span>
                            )}
                        </div>
                    )}
                </td>
            )
        }

        if (col.type === 'verified') {
            const isVerified = col.getIsVerified ? col.getIsVerified(item) : item.isVerified?.()
            const palette = isVerified ? VERIFIED_BUTTON_CLASS : UNVERIFIED_BUTTON_CLASS
            return (
                <td key={col.key} className={cellClass} style={widthStyle(col.width)}>
                    {item.status === 'Retired' ? (
                        <span className="inline-flex items-center rounded-md bg-bg-tertiary text-text-tertiary text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5">
                            N/A
                        </span>
                    ) : (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation()
                                onVerify?.(item.id, config.getModalIdentifier(item))
                            }}
                            title={isVerified ? 'Verified' : 'Click to verify'}
                            aria-label={isVerified ? 'Verified' : 'Verify'}
                            className={`inline-flex items-center gap-1 rounded-md border-none text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${palette} ${isVerified ? 'cursor-default' : ''}`}
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

        if (col.type === 'tractor') {
            const tractor = item.assignedTractor ? tractors.find((t) => t.id === item.assignedTractor) : null
            return (
                <td key={col.key} className={cellClass} style={widthStyle(col.width)}>
                    {tractor?.truckNumber || '---'}
                </td>
            )
        }

        if (col.type === 'vin') {
            const vinVal = col.getValue ? col.getValue(item) : item[col.key]
            const normalizedKey = col.normalize?.(item)
            const isDuplicate = normalizedKey && duplicates[col.duplicateKey]?.has(normalizedKey)
            return (
                <td
                    key={col.key}
                    className={`${cellClass} font-mono text-[11px] text-text-secondary`}
                    style={widthStyle(col.width)}
                >
                    {vinVal ? (
                        <div className="flex items-center gap-1">
                            <span className="tabular-nums">{vinVal}</span>
                            {copyButton(vinVal, 'Copy VIN')}
                            {isDuplicate && (
                                <span
                                    className="inline-flex items-center rounded-md bg-status-warning/10 text-status-warning text-[9px] font-bold uppercase tracking-wider px-1 py-0.5"
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

        if (col.type === 'textWithWarning') {
            const val = col.getValue ? col.getValue(item) : item[col.key]
            const normalizedKey = col.normalize?.(item)
            const isDuplicate = normalizedKey && duplicates[col.duplicateKey]?.has(normalizedKey)
            return (
                <td key={col.key} className={cellClass} style={widthStyle(col.width)}>
                    {val || '---'}
                    {isDuplicate && (
                        <span
                            className="ml-1.5 inline-flex items-center rounded-md bg-status-warning/10 text-status-warning text-[9px] font-bold uppercase tracking-wider px-1 py-0.5"
                            title={col.warningTitle}
                        >
                            <i className="fas fa-exclamation-triangle text-[8px]" />
                        </span>
                    )}
                </td>
            )
        }

        if (col.type === 'number') {
            const val = col.getValue ? col.getValue(item) : item[col.key]
            const hasWarning = col.getWarning?.(item)
            return (
                <td key={col.key} className={cellClass} style={widthStyle(col.width)}>
                    {val != null ? (
                        <span className="inline-flex items-center gap-1.5">
                            <span className="tabular-nums font-mono">{val}</span>
                            {hasWarning && (
                                <span
                                    className="inline-flex items-center rounded-md bg-status-danger/10 text-status-danger text-[9px] font-bold uppercase tracking-wider px-1 py-0.5"
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

        if (col.type === 'actions') {
            const identifier = config.getModalIdentifier(item)
            return (
                <td key={col.key} className={cellClass} style={widthStyle(col.width)}>
                    <div className="flex items-center gap-0.5">
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation()
                                onComment(item.id, identifier)
                            }}
                            className={ICON_BUTTON_CLASS}
                            title="View comments"
                            aria-label="View comments"
                        >
                            <i className="fas fa-comments" />
                            {item.commentsCount > 0 && (
                                <span className={`${COUNT_BADGE_BASE} bg-accent`}>
                                    {item.commentsCount > 9 ? '9+' : item.commentsCount}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation()
                                onIssue(item.id, identifier)
                            }}
                            className={ICON_BUTTON_CLASS}
                            title="View issues"
                            aria-label="View issues"
                        >
                            <i className="fas fa-tools" />
                            {item.openIssuesCount > 0 && (
                                <span className={`${COUNT_BADGE_BASE} bg-status-danger`}>
                                    {item.openIssuesCount > 9 ? '9+' : item.openIssuesCount}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation()
                                onHistory(item)
                            }}
                            className={ICON_BUTTON_CLASS}
                            title="View history"
                            aria-label="View history"
                        >
                            <i className="fas fa-history" />
                        </button>
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation()
                                onSendMessage?.(item, identifier)
                            }}
                            className={ICON_BUTTON_CLASS}
                            title="Send as message"
                            aria-label="Send as message"
                        >
                            <i className="fas fa-paper-plane" />
                        </button>
                    </div>
                </td>
            )
        }

        if (col.type === 'plant') {
            const plant = plants.find((p) => p.code === item[col.key || 'assignedPlant'])
            return (
                <td key={col.key || 'plant'} className={cellClass} style={widthStyle(col.width)}>
                    {plant?.name || item[col.key || 'assignedPlant'] || '---'}
                </td>
            )
        }

        const val = col.getValue ? col.getValue(item) : item[col.key]
        return (
            <td key={col.key} className={cellClass} style={widthStyle(col.width)}>
                {val || '---'}
            </td>
        )
    }

    return (
        <tr
            className={`cursor-pointer transition-colors duration-150 ${className || ''}`}
            onClick={() => onSelect(item.id)}
            style={style}
        >
            {columns.map(renderCell)}
        </tr>
    )
}
