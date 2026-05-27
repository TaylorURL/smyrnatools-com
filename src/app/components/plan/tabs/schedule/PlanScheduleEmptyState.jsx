import React from 'react'

/** Empty state shown when no orders have been ingested for this date.
 *  Dispatch data lands automatically via the upstream import pipeline —
 *  no manual HTML upload step from the user any more. */
export default function PlanScheduleEmptyState() {
    return (
        <div className="rounded-card p-10 text-center bg-bg-primary border border-border-light shadow-sm animate-fade-in">
            <i className="fas fa-calendar-xmark text-3xl mb-3 text-text-tertiary opacity-70" aria-hidden="true" />
            <div className="font-heading text-base font-semibold mb-1 text-text-primary">No schedule yet</div>
            <div className="text-[12.5px] max-w-[480px] mx-auto text-text-secondary leading-relaxed">
                No dispatch orders have landed for this date yet. Customer, start time, product, yardage, and truck
                count populate automatically once the day&apos;s orders are ingested upstream.
            </div>
        </div>
    )
}
