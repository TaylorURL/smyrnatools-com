/* eslint-disable react/forbid-dom-props */
import React from 'react'

/** Week navigator — prev / next chevrons + the active week label, plus
 *  a "Latest" jump-back button when the user has scrolled into older
 *  weeks. Visual chrome matches the period navigator on the Statistics
 *  controls so the two surfaces feel like one product.
 *
 *  "Older" advances index +1 (the array is sorted newest-first), "Newer"
 *  decrements. Disabled states pin the edges so the user can't drift
 *  out of range. */
export function WeekNavigator({ accentColor, count, label, onIndexChange, position }) {
    const canGoOlder = position < count - 1
    const canGoNewer = position > 0
    return (
        <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-[11.5px] text-text-tertiary">
                Showing week {position + 1} of {count}
            </div>
            <div className="inline-flex items-center gap-0.5 rounded-lg text-sm font-semibold px-1 py-0.5 bg-bg-tertiary border border-border-light">
                <button
                    type="button"
                    onClick={() => canGoOlder && onIndexChange(position + 1)}
                    disabled={!canGoOlder}
                    className="border-none bg-transparent cursor-pointer p-1.5 rounded text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Older week"
                    aria-label="Previous week"
                >
                    <i className="fas fa-chevron-left text-xs" />
                </button>
                <span className="px-2 text-xs font-semibold text-text-primary">{label}</span>
                <button
                    type="button"
                    onClick={() => canGoNewer && onIndexChange(position - 1)}
                    disabled={!canGoNewer}
                    className="border-none bg-transparent cursor-pointer p-1.5 rounded text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Newer week"
                    aria-label="Next week"
                >
                    <i className="fas fa-chevron-right text-xs" />
                </button>
                {position > 0 && (
                    <button
                        type="button"
                        onClick={() => onIndexChange(0)}
                        className="border-none bg-transparent cursor-pointer px-2 py-1 rounded text-xs font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        Latest
                    </button>
                )}
            </div>
        </div>
    )
}
