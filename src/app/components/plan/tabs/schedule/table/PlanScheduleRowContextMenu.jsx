/* eslint-disable react/forbid-dom-props */
import React from 'react'
import { createPortal } from 'react-dom'

/** Floating right-click menu rendered into `document.body` so it can't be
 *  clipped by the schedule's scroll container. The outside-click / Escape
 *  dismiss logic lives in `usePlanScheduleRowContextMenu`; this component
 *  only paints the menu and forwards button clicks. */
export default function PlanScheduleRowContextMenu({ onOpenAudit, onViewOrder, onViewTickets, rowMenu }) {
    if (!rowMenu) return null
    return createPortal(
        <div
            // The menu lives inside a portal at fixed coords so it
            // can't be clipped by the schedule's scroll container,
            // and clicking outside the menu (the global click
            // listener registered above) dismisses it.
            // stopPropagation on the menu itself keeps clicks
            // INSIDE from dismissing.
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
            className="rounded-md py-1 min-w-[180px] bg-bg-primary border border-border-light fixed z-[9999]"
            style={{
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
                left: Math.min(rowMenu.x, window.innerWidth - 200),
                top: Math.min(rowMenu.y, window.innerHeight - 80)
            }}
        >
            <button
                type="button"
                onClick={onViewOrder}
                className="w-full text-left px-3 py-2 text-[12.5px] font-semibold flex items-center gap-2 bg-transparent border-0 cursor-pointer hover:bg-[color:var(--bg-tertiary)] text-text-primary"
            >
                <i className="fas fa-clipboard-list text-[12px] text-text-tertiary" />
                View order
            </button>
            <button
                type="button"
                onClick={onViewTickets}
                className="w-full text-left px-3 py-2 text-[12.5px] font-semibold flex items-center gap-2 bg-transparent border-0 cursor-pointer hover:bg-[color:var(--bg-tertiary)] text-text-primary"
            >
                <i className="fas fa-ticket text-[12px] text-text-tertiary" />
                View tickets
            </button>
            {onOpenAudit && (
                <button
                    type="button"
                    onClick={onOpenAudit}
                    className="w-full text-left px-3 py-2 text-[12.5px] font-semibold flex items-center gap-2 bg-transparent border-0 cursor-pointer hover:bg-[color:var(--bg-tertiary)] text-text-primary"
                >
                    <i className="fas fa-clock-rotate-left text-[12px] text-text-tertiary" />
                    Order audit
                </button>
            )}
        </div>,
        document.body
    )
}
