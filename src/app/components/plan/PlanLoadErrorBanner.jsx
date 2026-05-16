/* eslint-disable react/forbid-dom-props */
import React from 'react'

/**
 * Inline banner shown above the active Plan tab when the plan fetch
 * fails for a transient reason (auth blip, 5xx, network timeout).
 *
 * Until this banner existed, a failed fetch silently replaced local
 * assignments with the empty placeholder — and the moment the
 * dispatcher touched anything the autosave persisted that empty state
 * over the real saved plan. The fix in `usePlanData` now leaves
 * local state alone on a failed load and holds autosave disarmed;
 * this banner surfaces the failure so the user knows their session
 * is in a recoverable state and can hit Retry to try again.
 */
export function PlanLoadErrorBanner({ message, onRetry }) {
    return (
        <div
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b shrink-0 bg-[rgba(220,38,38,0.08)] border-border-light text-red-700 dark:text-red-300"
            role="alert"
        >
            <i className="fas fa-triangle-exclamation text-[11px]" />
            <span className="min-w-0 flex-1 truncate">
                Couldn&apos;t load this plan — your saved data is still on the server. Autosave is paused until the
                fetch succeeds so nothing gets overwritten.
                {message ? <span className="font-normal text-text-tertiary"> · {message}</span> : null}
            </span>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-300 dark:border-red-700 bg-bg-primary text-red-700 dark:text-red-300 cursor-pointer text-[11px] font-bold hover:bg-bg-secondary"
                >
                    <i className="fas fa-rotate text-[10px]" />
                    Retry
                </button>
            )}
        </div>
    )
}
