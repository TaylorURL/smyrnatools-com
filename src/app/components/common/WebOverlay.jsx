import React from 'react'
import ReactDOM from 'react-dom'

/** The host name of `url`, or the whole string when it doesn't parse. */
function hostOf(url) {
    try {
        return new URL(url).hostname || url
    } catch {
        return url
    }
}

/**
 * Full-screen overlay that embeds external content in a sandboxed iframe.
 * A plain bar across the top carries a close button, the site's name and the
 * full address.
 */
function WebOverlay({ url, onClose }) {
    if (typeof document === 'undefined' || !document.body) return null
    return ReactDOM.createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label="External content"
            className="fixed inset-0 z-system flex flex-col bg-bg-primary animate-fade-in motion-reduce:animate-none"
        >
            <div className="flex shrink-0 items-center gap-3 border-b border-border-light bg-bg-primary px-4 py-2.5">
                <button
                    type="button"
                    aria-label="Close external content"
                    className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-none bg-transparent text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
                    onClick={onClose}
                >
                    <i className="fas fa-times text-[14px]" aria-hidden="true" />
                </button>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-text-primary">{hostOf(url)}</div>
                    <div className="truncate text-[12px] text-text-tertiary">{url}</div>
                </div>
            </div>
            <iframe
                src={url}
                title="External Content"
                className="flex-1 border-none"
                sandbox="allow-scripts allow-popups allow-forms"
            />
        </div>,
        document.body
    )
}
export default WebOverlay
