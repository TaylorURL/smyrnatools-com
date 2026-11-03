import React from 'react'

import Badge from '../../app/components/common/Badge'
import CountBubble from '../../app/components/common/CountBubble'
import StarRating from '../../app/components/common/StarRating'
import { getStatusTone } from '../../app/constants/statusPalette'

/** Text action along the card's footer; a count follows the label in the
 *  status colour it belongs to. */
function CardFooterAction({ count, countTone, icon, label, onActivate }) {
    return (
        <button
            type="button"
            onClick={(event) => {
                event.stopPropagation()
                onActivate?.()
            }}
            aria-label={label}
            className="inline-flex h-8 items-center gap-1.5 rounded-[3px] border-none bg-transparent px-2 text-[12px] text-text-secondary cursor-pointer transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        >
            <i className={`fas ${icon} text-[11px]`} aria-hidden="true" />
            <span>{label}</span>
            {count > 0 && (
                <span
                    className={`font-mono text-[11px] font-medium tabular-nums ${countTone === 'danger' ? 'text-status-danger' : 'text-text-primary'}`}
                >
                    {count > 99 ? '99+' : count}
                </span>
            )}
        </button>
    )
}

function AssignmentIconButton({ ariaLabel, count, icon, onActivate }) {
    return (
        <button
            type="button"
            onClick={(event) => {
                event.stopPropagation()
                onActivate?.()
            }}
            title={ariaLabel}
            aria-label={ariaLabel}
            className="relative inline-flex h-6 w-6 items-center justify-center rounded-[3px] border-none bg-transparent text-[10.5px] text-text-tertiary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
            <i className={`fas ${icon}`} />
            <CountBubble count={count} size="sm" tone="accent" className="absolute -right-1.5 -top-1.5" />
        </button>
    )
}

/**
 * The grid card every asset type renders through. What appears comes from the
 * config rather than from the type: the assignment bar, the verification pill
 * and the body fields are all present only where the config asks for them, so
 * a new asset type is a config entry and not a new card.
 */
function AssetGridCard({
    item,
    config,
    operator,
    tractor,
    plantName,
    isVerified,
    displayStatus,
    statusDays,
    onSelect,
    onShowCommentModal,
    onShowIssueModal,
    onShowHistoryModal,
    onShowOperatorCommentModal,
    onShowOperatorHistoryModal
}) {
    const number = item[config.primaryField] || '---'

    const subtitleName = config.hasOperatorAssignment
        ? operator?.name
        : config.hasTractorAssignment
          ? tractor?.truckNumber
              ? `#${tractor.truckNumber}`
              : null
          : null

    const fields = config.gridCardFields || []

    const handleSelect = () => onSelect?.(item.id)

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handleSelect()
        }
    }

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={handleSelect}
            onKeyDown={handleKeyDown}
            aria-label={`${config.singularLabel} ${number}`}
            className="group flex h-full flex-col rounded-card border border-border-light bg-bg-primary cursor-pointer transition-colors duration-150 hover:border-border-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-secondary"
        >
            <div className="px-4 pb-3 pt-4">
                <div className="flex items-baseline justify-between gap-3">
                    <div className="flex min-w-0 items-baseline gap-2">
                        <span className="truncate font-heading text-[22px] font-semibold leading-none tracking-tight text-text-primary tabular-nums">
                            {number}
                        </span>
                        <span className="shrink-0 text-[12px] text-text-tertiary">{config.singularLabel}</span>
                        {config.hasVerification && isVerified !== undefined && (
                            <i
                                className={`fas ${isVerified ? 'fa-circle-check text-status-active' : 'fa-circle-exclamation text-status-warning'} shrink-0 text-[11px]`}
                                title={isVerified ? 'Verified this week' : 'Not verified this week'}
                                aria-label={isVerified ? 'Verified' : 'Unverified'}
                            />
                        )}
                    </div>
                    <Badge tone={getStatusTone(displayStatus)} size="sm" uppercase={false}>
                        {`${displayStatus || '---'}${statusDays ? ` · ${statusDays}d` : ''}`}
                    </Badge>
                </div>
                {(config.hasOperatorAssignment || config.hasTractorAssignment) && (
                    <div className="mt-2.5 flex min-h-[24px] items-center gap-1">
                        <span
                            className={`min-w-0 flex-1 truncate text-[13px] ${subtitleName ? 'text-text-primary' : 'italic text-text-tertiary'}`}
                        >
                            {subtitleName || 'Not assigned'}
                        </span>
                        {config.hasOperatorAssignment && operator?.name && (
                            <>
                                <AssignmentIconButton
                                    ariaLabel="Operator comments"
                                    count={operator.commentsCount}
                                    icon="fa-comment"
                                    onActivate={() => onShowOperatorCommentModal?.(operator)}
                                />
                                <AssignmentIconButton
                                    ariaLabel="Operator history"
                                    icon="fa-history"
                                    onActivate={() => onShowOperatorHistoryModal?.(operator)}
                                />
                            </>
                        )}
                    </div>
                )}
            </div>

            <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border-light px-4 py-3">
                {fields.map((field) => {
                    const value = field.getValue
                        ? field.getValue(item, { operator, plantName, tractor })
                        : (item[field.key] ?? '---')
                    const isOverdue = field.isOverdue?.(item)
                    const warning = field.getWarning?.(item)
                    return (
                        <div key={field.label} className="flex min-w-0 flex-col gap-0.5">
                            <dt className="text-[11.5px] text-text-tertiary">{field.label}</dt>
                            <dd className="m-0 text-[13px] text-text-primary">
                                {field.type === 'stars' ? (
                                    <span className="inline-flex flex-wrap items-center gap-1.5">
                                        <StarRating value={value || 0} tone="warning" size="sm" />
                                        {warning && <span className="text-[11.5px] text-status-danger">{warning}</span>}
                                    </span>
                                ) : field.type === 'monospace' ? (
                                    <span className="font-mono text-[12px] tabular-nums text-text-secondary">
                                        {value}
                                    </span>
                                ) : (
                                    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
                                        <span className="tabular-nums">{value}</span>
                                        {isOverdue && <span className="text-[11.5px] text-status-danger">Overdue</span>}
                                        {warning && <span className="text-[11.5px] text-status-danger">{warning}</span>}
                                    </span>
                                )}
                            </dd>
                        </div>
                    )
                })}
            </dl>

            <div className="mt-auto flex items-center gap-1 border-t border-border-light px-2 py-1.5">
                <CardFooterAction
                    count={item.commentsCount}
                    countTone="accent"
                    icon="fa-comment"
                    label="Comments"
                    onActivate={onShowCommentModal}
                />
                <CardFooterAction
                    count={item.openIssuesCount}
                    countTone="danger"
                    icon="fa-wrench"
                    label="Issues"
                    onActivate={onShowIssueModal}
                />
                <CardFooterAction icon="fa-clock-rotate-left" label="History" onActivate={onShowHistoryModal} />
            </div>
        </div>
    )
}

export default AssetGridCard
