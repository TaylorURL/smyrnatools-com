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
                background: 'linear-gradient(90deg, #fee2e240, #fef3c740)',
                borderColor: '#fca5a5'
            }}
        >
            <div
                className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                style={{ background: '#dc2626', color: '#fff' }}
            >
                <i className="fas fa-triangle-exclamation text-[13px]" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="font-bold text-[13px]" style={{ color: '#991b1b' }}>
                    {headline}
                </div>
                {title && (
                    <div className="text-xs mt-0.5 truncate" style={{ color: '#b91c1c' }}>
                        {title}
                        {dueLabel ? ` · was due ${dueLabel}` : ''}
                    </div>
                )}
            </div>
            {onSubmit && (
                <button
                    type="button"
                    onClick={onSubmit}
                    className="font-bold text-xs px-3.5 py-2 rounded-lg shrink-0 inline-flex items-center gap-1.5 border-none cursor-pointer hover:opacity-90"
                    style={{ background: '#dc2626', color: '#fff' }}
                >
                    <i className="fas fa-paper-plane text-[10px]" /> Submit now
                </button>
            )}
        </div>
    )
}

export default OverdueBanner
