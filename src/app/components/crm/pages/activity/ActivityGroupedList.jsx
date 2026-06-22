/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { CALL_OUTCOME_COLORS, CALL_OUTCOME_LABELS } from '../../../../../utils/CrmRosterUtility'
import DateUtility from '../../../../../utils/DateUtility'
import Badge from '../../../common/Badge'
import UserAvatar from '../../../common/UserAvatar'
import { formatRelativeShort, GROUP_LABELS, ICON_BY_OUTCOME, initialsOf } from './activityShared'

/* ─── Date-grouped timeline ────────────────────────────────────── */

export function ActivityGroupedList({ groups, onSelectCustomer }) {
    const visibleGroups = GROUP_LABELS.filter(({ key }) => groups[key] && groups[key].length > 0)
    if (visibleGroups.length === 0) return null
    return (
        <div className="flex flex-col gap-2.5">
            {visibleGroups.map(({ key, label }) => (
                <ActivityGroupSection
                    key={key}
                    entries={groups[key]}
                    label={label}
                    onSelectCustomer={onSelectCustomer}
                />
            ))}
        </div>
    )
}

function ActivityGroupSection({ entries, label, onSelectCustomer }) {
    return (
        <section className="rounded-md overflow-hidden bg-bg-primary border border-border-light">
            <header className="px-3 py-1.5 flex items-baseline justify-between bg-bg-secondary border-b border-border-light">
                <span className="text-[10.5px] font-bold uppercase tracking-[.08em] text-text-secondary">{label}</span>
                <span className="text-[10.5px] text-text-tertiary tabular-nums">
                    {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
                </span>
            </header>
            <ol className="flex flex-col">
                {entries.map((entry, idx) => (
                    <li key={entry.id} className={idx === entries.length - 1 ? '' : 'border-b border-border-light'}>
                        <ActivityRow entry={entry} onSelectCustomer={onSelectCustomer} />
                    </li>
                ))}
            </ol>
        </section>
    )
}

function ActivityRow({ entry, onSelectCustomer }) {
    const tone = CALL_OUTCOME_COLORS[entry.outcome] || '#64748b'
    const icon = ICON_BY_OUTCOME[entry.outcome] || 'fa-phone'
    return (
        <button type="button"
            onClick={() => onSelectCustomer && onSelectCustomer(entry.customer_num)}
            disabled={!entry.customer_num || !onSelectCustomer}
            className="w-full text-left px-3 py-2.5 flex items-start gap-3 cursor-pointer disabled:cursor-default border-none bg-transparent hover:bg-bg-secondary active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none disabled:active:scale-100"
            style={{ borderLeft: `3px solid ${tone}` }}
        >
            <span
                className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md"
                style={{ background: `${tone}22`, color: tone }}
                title={CALL_OUTCOME_LABELS[entry.outcome] || entry.outcome}
                aria-hidden="true"
            >
                <i className={`fas ${icon} text-[12px]`} />
            </span>
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold text-[13px] text-text-primary truncate">
                        {entry.customer_name || `Customer ${entry.customer_num}`}
                    </span>
                    <span className="text-[10.5px] text-text-tertiary tabular-nums">#{entry.customer_num}</span>
                    {entry.contact_name && (
                        <span className="text-[10.5px] text-text-tertiary truncate">· {entry.contact_name}</span>
                    )}
                </div>
                {entry.comment && (
                    <div className="text-[12px] mt-1 whitespace-pre-wrap text-text-secondary line-clamp-3">
                        {entry.comment}
                    </div>
                )}
                {entry.created_by_name && (
                    <Badge
                        tone="neutral"
                        size="md"
                        weight="semibold"
                        uppercase={false}
                        className="mt-1.5"
                        title={`Logged by ${entry.created_by_name}`}
                        icon={
                            <UserAvatar
                                userId={entry.created_by}
                                initials={initialsOf(entry.created_by_name)}
                                size={14}
                                rounded="full"
                                className="text-[8px]"
                            />
                        }
                    >
                        {entry.created_by_name}
                    </Badge>
                )}
            </div>
            <span
                className="shrink-0 text-[10.5px] text-text-tertiary tabular-nums"
                title={DateUtility.formatDateTime(entry.created_at)}
            >
                {formatRelativeShort(entry.created_at)}
            </span>
        </button>
    )
}
