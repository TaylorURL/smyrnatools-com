/* eslint-disable react/forbid-dom-props */
import React from 'react'

import {
    CALL_OUTCOME_COLORS,
    CALL_OUTCOME_LABELS,
    dormancyTone,
    formatRelativeDays,
    wasRecentlyCalled
} from '../../../../../utils/CallListUtility'

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
            className="w-full text-left flex items-center gap-2.5 px-3 py-2 cursor-pointer border-none transition-colors border-b border-border-light"
            style={{
                background: isSelected ? `${accentColor}1a` : 'transparent',
                borderLeft: `2px solid ${isSelected ? accentColor : 'transparent'}`,
                opacity: isOnCooldown && !isSelected ? 0.65 : 1
            }}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[13px] truncate text-text-primary">
                        {row.customer_name || row.customer_num}
                    </span>
                    {row.call_count_last_30 > 0 && (
                        <span
                            className="text-[9px] font-bold rounded-full px-1.5 py-0.5 flex-shrink-0 inline-flex items-center gap-1 text-text-primary"
                            style={{ background: `${accentColor}29`, boxShadow: `inset 0 0 0 1px ${accentColor}55` }}
                            title={`${row.call_count_last_30} calls in last 30 days`}
                        >
                            <i className="fas fa-phone-volume text-[8px]" />
                            {row.call_count_last_30}
                        </span>
                    )}
                </div>
                <div className="text-[10.5px] flex items-center gap-2 mt-1 min-w-0 text-text-secondary">
                    <span className="truncate">{row.contact_name || '— no contact —'}</span>
                    {outcomeLabel && calledAgoLabel && (
                        <span
                            className="flex-shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                            style={{
                                background: `${outcomeColor}29`,
                                boxShadow: `inset 0 0 0 1px ${outcomeColor}55`,
                                color: outcomeColor
                            }}
                            title={`${outcomeLabel} · ${calledAgoLabel}`}
                        >
                            <i className="fas fa-phone text-[8px]" />
                            {outcomeLabel} · {calledAgoLabel}
                        </span>
                    )}
                </div>
            </div>
            <div className="text-right flex-shrink-0 flex flex-col items-end gap-0.5">
                <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-bold leading-none font-heading"
                    style={{ background: `${tone}1f`, boxShadow: `inset 0 0 0 1px ${tone}55`, color: tone }}
                >
                    {row.days_since_last_pour}d
                </span>
                <span className="text-[9.5px] text-text-tertiary">{row.pour_days_last_year} pours/yr</span>
            </div>
        </button>
    )
}
