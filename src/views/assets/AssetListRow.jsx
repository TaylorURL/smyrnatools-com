import React from 'react'

import Badge from '../../app/components/common/Badge'
import CountBubble from '../../app/components/common/CountBubble'
import StarRating from '../../app/components/common/StarRating'
import StatusHistoryBar from '../../app/components/common/StatusHistoryBar'

/**
 * Status name → Badge tone. Drives the solid-fill status pill across every
 * asset type so the palette is one mapping, not five duplicated CSS strings.
 */
const STATUS_TO_TONE = {
    Active: 'success',
    'Down In Yard': 'danger',
    'In Shop': 'info',
    'No Hire': 'danger',
    'Pending Start': 'info',
    'Ready For Pickup': 'success',
    Retired: 'neutral',
    Sold: 'neutral',
    Spare: 'neutral',
    Stationary: 'info',
    Terminated: 'danger',
    'Third Party Work': 'neutral',
    Training: 'warning',
    'Waiting For Shop': 'warning'
}

const ICON_BUTTON_CLASS =
    'relative inline-flex items-center justify-center w-7 h-7 rounded-md border-none bg-transparent text-[11px] text-text-tertiary cursor-pointer transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset'

/** Operator comment/history controls, sitting on the name's own line so a
 *  row is one line tall unless the operator has trainees to list. */
const OPERATOR_ACTION_CLASS =
    'relative inline-flex items-center justify-center w-6 h-6 rounded-md border-none bg-transparent text-[10.5px] text-text-tertiary cursor-pointer transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset'

const CELL_BASE_CLASS = 'px-3 py-2.5 text-[13px] align-middle text-text-primary'
const CELL_BOLD_CLASS = `${CELL_BASE_CLASS} font-semibold`

const getStatusToneForStatus = (status) => STATUS_TO_TONE[status] || 'neutral'

/**
 * One row of the asset list. The cells come from the asset config's column
 * list, each carrying a `type` this file knows how to render, so adding a
 * column to a type is a config change rather than a change here.
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

    /** Copies text and flips the button's icon to a tick for a moment. The
     *  swap is written straight onto the icon's className rather than held in
     *  state, so confirming one row's copy does not re-render the table. */
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
                        <Badge
                            tone={getStatusToneForStatus(displayStatus)}
                            size="sm"
                            shape="rounded-md"
                            className="self-start"
                        >
                            {`${displayStatus || '---'}${daysSuffix}`}
                        </Badge>
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
                                <span className="whitespace-nowrap font-medium">{operator.name}</span>
                                {copyButton(operator.name, 'Copy operator name')}
                                <span className="ml-1 inline-flex items-center gap-0.5 border-l border-border-light pl-1">
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            onOperatorComment?.(operator)
                                        }}
                                        className={OPERATOR_ACTION_CLASS}
                                        title="Operator comments"
                                        aria-label="Operator comments"
                                    >
                                        <i className="fas fa-comment" aria-hidden="true" />
                                        <CountBubble
                                            count={operator.commentsCount}
                                            size="sm"
                                            tone="accent"
                                            className="absolute -right-1.5 -top-1.5"
                                        />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            onOperatorHistory?.(operator)
                                        }}
                                        className={OPERATOR_ACTION_CLASS}
                                        title="Operator history"
                                        aria-label="Operator history"
                                    >
                                        <i className="fas fa-history" aria-hidden="true" />
                                    </button>
                                </span>
                            </div>
                            {assignedTrainees.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1">
                                    {assignedTrainees.map((trainee) => (
                                        <Badge
                                            key={trainee.employeeId}
                                            tone="warning"
                                            variant="soft"
                                            size="sm"
                                            shape="rounded-md"
                                            weight="semibold"
                                            uppercase={false}
                                            icon="user-graduate"
                                            title={`Trainee: ${trainee.name}`}
                                        >
                                            {trainee.name}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <span className="italic text-text-tertiary">Unassigned</span>
                    )}
                </td>
            )
        }

        if (col.type === 'stars') {
            const rating = item[col.ratingField || col.key] || 0
            const showNAForRetired = col.naForRetired && item.status === 'Retired'
            return (
                <td key={col.key} className={cellClass} style={widthStyle(col.width)}>
                    {showNAForRetired ? (
                        <span className="text-text-tertiary">N/A</span>
                    ) : (
                        <div className="flex items-center">
                            <StarRating value={rating} tone="warning" size="xs" />
                            {col.dirtyWarning && rating > 0 && rating < 3 && (
                                <Badge tone="danger" variant="soft" size="xs" shape="rounded-md" className="ml-1.5">
                                    Dirty
                                </Badge>
                            )}
                        </div>
                    )}
                </td>
            )
        }

        if (col.type === 'verified') {
            const isVerified = col.getIsVerified ? col.getIsVerified(item) : item.isVerified?.()
            return (
                <td key={col.key} className={cellClass} style={widthStyle(col.width)}>
                    {item.status === 'Retired' ? (
                        <Badge tone="neutral" variant="soft" size="sm" shape="rounded-md">
                            N/A
                        </Badge>
                    ) : (
                        <Badge
                            as="button"
                            tone={isVerified ? 'success' : 'warning'}
                            size="sm"
                            shape="rounded-md"
                            icon={isVerified ? 'check-circle' : 'exclamation-circle'}
                            onClick={(event) => {
                                event.stopPropagation()
                                onVerify?.(item.id, config.getModalIdentifier(item))
                            }}
                            title={isVerified ? 'Verified' : 'Click to verify'}
                            aria-label={isVerified ? 'Verified' : 'Verify'}
                            className={`hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${isVerified ? '!cursor-default' : ''}`}
                        >
                            {isVerified ? 'Verified' : 'Verify'}
                        </Badge>
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
                                <Badge
                                    tone="warning"
                                    variant="soft"
                                    size="xs"
                                    shape="rounded-md"
                                    icon="exclamation-triangle"
                                    title="Duplicate VIN"
                                    aria-label="Duplicate VIN"
                                />
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
                        <Badge
                            tone="warning"
                            variant="soft"
                            size="xs"
                            shape="rounded-md"
                            icon="exclamation-triangle"
                            title={col.warningTitle}
                            aria-label={col.warningTitle}
                            className="ml-1.5"
                        />
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
                                <Badge
                                    tone="danger"
                                    variant="soft"
                                    size="xs"
                                    shape="rounded-md"
                                    icon="exclamation-triangle"
                                    title={col.warningTitle}
                                    aria-label={col.warningTitle}
                                />
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
                            <CountBubble
                                count={item.commentsCount}
                                size="sm"
                                tone="accent"
                                className="absolute -right-1 -top-1"
                            />
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
                            <CountBubble
                                count={item.openIssuesCount}
                                size="sm"
                                tone="danger"
                                className="absolute -right-1 -top-1"
                            />
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
