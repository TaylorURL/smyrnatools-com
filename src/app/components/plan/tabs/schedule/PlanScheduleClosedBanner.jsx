import React from 'react'

/**
 * Sunday "plants closed" / Saturday "half crew" banner — explains why
 * truck-coverage math reads as 0 (Sunday) or half-staffed (Saturday) on
 * those days. Renders nothing when neither flag is set.
 */
export default function PlanScheduleClosedBanner({ isSaturday, plantsClosed }) {
    if (!plantsClosed && !isSaturday) return null
    const isClosed = !!plantsClosed
    return (
        <div
            className={`rounded-card px-4 py-3 flex items-start gap-3 border-l-4 animate-fade-slide-in ${
                isClosed
                    ? 'bg-status-danger/10 border-l-status-danger border-border-light'
                    : 'bg-status-warning/10 border-l-status-warning border-border-light'
            }`}
            role="status"
        >
            <i
                className={`fas mt-0.5 text-sm ${
                    isClosed ? 'fa-ban text-status-danger' : 'fa-calendar-day text-status-warning'
                }`}
                aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-text-primary">
                    {isClosed ? 'Sunday — plants closed' : 'Saturday — half crew'}
                </div>
                <div className="text-[12px] text-text-secondary leading-relaxed">
                    {isClosed
                        ? 'All plants are assumed closed today. Truck-coverage math treats every plant pool as 0.'
                        : 'Saturday crews run at half staffing. Every plant’s active mixer count is halved (rounded down) for the coverage math.'}
                </div>
            </div>
        </div>
    )
}
