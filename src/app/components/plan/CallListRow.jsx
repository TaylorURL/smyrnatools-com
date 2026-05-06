import React from 'react'

import {
    CALL_OUTCOME_COLORS,
    CALL_OUTCOME_LABELS,
    dormancyTone,
    formatRelativeDays,
    wasRecentlyCalled
} from '../../../utils/CallListUtility'

/** Single row in the dormant-customer list. Highlights when selected and
 *  shows a color-coded days-dormant badge plus the customer's last call
 *  outcome at a glance. Click selects; mutation lives in the detail panel. */
export default function CallListRow({ accentColor, isSelected, onSelect, row }) {
    const tone = dormancyTone(row.days_since_last_pour)
    const outcomeLabel = row.last_call_outcome ? CALL_OUTCOME_LABELS[row.last_call_outcome] : null
    const outcomeColor = row.last_call_outcome ? CALL_OUTCOME_COLORS[row.last_call_outcome] : null
    const calledAgoLabel = row.last_call_at ? formatRelativeDays(row.last_call_at) : null
    const isOnCooldown = wasRecentlyCalled(row.last_call_at)
    return (
        <button
            type="button"
            onClick={onSelect}
            className="w-full text-left flex items-center gap-2 px-3 py-2 cursor-pointer border-none transition-opacity"
            style={{
                background: isSelected ? `${accentColor}14` : 'transparent',
                borderLeft: `3px solid ${isSelected ? accentColor : 'transparent'}`,
                borderBottom: '1px solid var(--border-light)',
                opacity: isOnCooldown && !isSelected ? 0.6 : 1
            }}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[13px] truncate" style={{ color: 'var(--text-primary)' }}>
                        {row.customer_name || row.customer_num}
                    </span>
                    {row.call_count_last_30 > 0 && (
                        <span
                            className="text-[9px] font-bold rounded-full px-1.5 py-0.5 flex-shrink-0"
                            style={{ background: `${accentColor}22`, color: 'var(--text-primary)' }}
                            title={`${row.call_count_last_30} calls in last 30 days`}
                        >
                            {row.call_count_last_30}
                        </span>
                    )}
                </div>
                <div
                    className="text-[10.5px] flex items-center gap-2 mt-0.5 min-w-0"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    <span className="truncate">{row.contact_name || '— no contact —'}</span>
                    {outcomeLabel && calledAgoLabel && (
                        <span
                            className="font-semibold flex-shrink-0 inline-flex items-center gap-1"
                            style={{ color: outcomeColor }}
                            title={`${outcomeLabel} · ${calledAgoLabel}`}
                        >
                            <i className="fas fa-phone text-[8px]" />
                            {outcomeLabel} · {calledAgoLabel}
                        </span>
                    )}
                </div>
            </div>
            <div className="text-right flex-shrink-0">
                <div
                    className="font-bold text-[13px] leading-none"
                    style={{ color: tone, fontFamily: 'var(--font-heading)' }}
                >
                    {row.days_since_last_pour}d
                </div>
                <div className="text-[9.5px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {row.pour_days_last_year} pours/yr
                </div>
            </div>
        </button>
    )
}
