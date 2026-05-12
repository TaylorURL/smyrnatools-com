/* eslint-disable react/forbid-dom-props */
import React from 'react'

/**
 * Alert banner surfaced on the PM view when the user has reports from
 * prior weeks that were never submitted. Offers a single "Submit now"
 * CTA that jumps into the oldest overdue item.
 */
function OverdueBanner({ count, title, dueLabel, onSubmit }) {
    if (!count || count <= 0) return null
    const headline =
        count === 1
            ? 'You have 1 overdue report from a prior week'
            : `You have ${count} overdue reports from prior weeks`
    // Tinted backgrounds use color-mix so the banner adapts to dark mode
    // without us having to ship a separate dark-mode gradient.
    return (
        <div
            className="flex items-center gap-3.5 rounded-lg px-4 py-3 border"
            style={{
                background:
                    'linear-gradient(90deg, color-mix(in srgb, #dc2626 14%, transparent), color-mix(in srgb, #f59e0b 14%, transparent))',
                borderColor: 'color-mix(in srgb, #dc2626 35%, transparent)'
            }}
        >
            <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-white bg-red-600">
                <i className="fas fa-triangle-exclamation text-[13px]" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="font-bold text-[13px] text-red-700">{headline}</div>
                {title && (
                    <div className="text-xs mt-0.5 truncate text-red-600">
                        {title}
                        {dueLabel ? ` · was due ${dueLabel}` : ''}
                    </div>
                )}
            </div>
            {onSubmit && (
                <button
                    type="button"
                    onClick={onSubmit}
                    className="font-bold text-xs px-3.5 py-2 rounded-lg shrink-0 inline-flex items-center gap-1.5 border-none cursor-pointer hover:opacity-90 text-white bg-red-600"
                >
                    <i className="fas fa-paper-plane text-[10px]" /> Submit now
                </button>
            )}
        </div>
    )
}

export default OverdueBanner
