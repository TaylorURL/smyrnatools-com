/* eslint-disable react/forbid-dom-props */
import React from 'react'

/**
 * Compact alert banner for prior-week unsubmitted reports. Uses the
 * project's standard `--status-danger` token + `color-mix` tint so
 * dark / light / gray modes all read correctly without a per-theme
 * gradient. Single CTA jumps the user into the oldest overdue item.
 */
function OverdueBanner({ count, title, dueLabel, onSubmit }) {
    if (!count || count <= 0) return null
    const headline =
        count === 1
            ? '1 overdue report from a prior week'
            : `${count} overdue reports from prior weeks`
    return (
        <div
            className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 border"
            style={{
                background: 'color-mix(in srgb, var(--status-danger) 8%, transparent)',
                borderColor: 'color-mix(in srgb, var(--status-danger) 32%, transparent)'
            }}
        >
            <i
                className="fas fa-triangle-exclamation text-[14px] shrink-0"
                style={{ color: 'var(--status-danger)' }}
                aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
                <div className="font-semibold text-[12.5px] text-text-primary leading-tight">{headline}</div>
                {title && (
                    <div className="text-[11px] mt-0.5 truncate text-text-secondary">
                        {title}
                        {dueLabel ? ` · was due ${dueLabel}` : ''}
                    </div>
                )}
            </div>
            {onSubmit && (
                <button type="button"
                    onClick={onSubmit}
                    className="font-semibold text-[12px] px-3 py-1.5 rounded-md shrink-0 inline-flex items-center gap-1.5 border-none cursor-pointer text-white active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                    style={{ background: 'var(--status-danger)' }}
                >
                    <i className="fas fa-paper-plane text-[10px]" /> Submit oldest
                </button>
            )}
        </div>
    )
}

export default OverdueBanner
