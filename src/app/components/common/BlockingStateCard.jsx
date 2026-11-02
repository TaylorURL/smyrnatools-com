import React from 'react'
import ReactDOM from 'react-dom'

/**
 * The full-screen state the app shows when it can't let anyone through —
 * offline, access revoked, account not set up. It reads as one of the app's
 * dialogs (the same panel, title face and footer), with no close button:
 * the only ways out are the actions in `actions`, or the caller unmounting it.
 *
 * `backdrop` renders behind the card, inside the veil (the locked screen puts
 * its background video there); `media` renders above the title.
 */
export default function BlockingStateCard({
    actions,
    backdrop,
    children,
    media,
    title,
    titleId,
    zClassName = 'z-app-state'
}) {
    if (typeof document === 'undefined' || !document.body) return null
    return ReactDOM.createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`fixed inset-0 ${zClassName} flex items-center justify-center bg-[var(--scrim)] p-4 backdrop-blur-sm animate-fade-in motion-reduce:animate-none`}
        >
            {backdrop}
            <div className="relative z-raised flex w-full max-w-[420px] flex-col overflow-hidden rounded-modal border border-border-light bg-bg-primary shadow-modal animate-dialog-in motion-reduce:animate-none">
                <div className="px-6 pb-5 pt-6">
                    {media}
                    <h1
                        id={titleId}
                        className="m-0 font-heading text-[20px] font-semibold leading-tight tracking-tight text-text-primary"
                    >
                        {title}
                    </h1>
                    <p className="m-0 mt-2 text-[13px] leading-relaxed text-text-secondary">{children}</p>
                </div>
                {actions && (
                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-light bg-bg-secondary px-6 py-3.5">
                        {actions}
                    </div>
                )}
            </div>
        </div>,
        document.body
    )
}
