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
    return (
        <div
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 border"
            style={{
                background: 'linear-gradient(90deg, #fee2e2, #ffe4e6)',
                borderColor: '#fca5a5'
            }}
        >
            <i className="fas fa-exclamation-triangle text-red-600 text-lg shrink-0" />
            <div className="flex-1 min-w-0">
                <div className="font-bold text-[13px] text-red-800">{headline}</div>
                {title && (
                    <div className="text-xs text-red-800/85 mt-0.5 truncate">
                        {title}
                        {dueLabel ? ` · was due ${dueLabel}` : ''}
                    </div>
                )}
            </div>
            {onSubmit && (
                <button
                    type="button"
                    onClick={onSubmit}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg shrink-0 inline-flex items-center gap-1.5"
                >
                    <i className="fas fa-paper-plane text-[10px]" /> Submit now
                </button>
            )}
        </div>
    )
}

export default OverdueBanner
