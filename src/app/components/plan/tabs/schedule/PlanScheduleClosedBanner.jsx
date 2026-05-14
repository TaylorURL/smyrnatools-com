/* eslint-disable react/forbid-dom-props */
import React from 'react'

/**
 * Sunday "plants closed" / Saturday "half crew" banner — explains why
 * truck-coverage math reads as 0 (Sunday) or half-staffed (Saturday) on
 * those days. Renders nothing when neither flag is set.
 */
export default function PlanScheduleClosedBanner({ isSaturday, plantsClosed }) {
    if (!plantsClosed && !isSaturday) return null
    return (
        <div
            className="rounded-lg px-4 py-3 flex items-start gap-3"
            style={{
                background: plantsClosed ? 'rgba(220, 38, 38, 0.08)' : 'rgba(217, 119, 6, 0.08)',
                border: `1px solid ${plantsClosed ? 'rgba(220, 38, 38, 0.35)' : 'rgba(217, 119, 6, 0.35)'}`
            }}
        >
            <i
                className={`fas ${plantsClosed ? 'fa-ban' : 'fa-calendar-day'} mt-0.5`}
                style={{ color: plantsClosed ? '#dc2626' : '#d97706', fontSize: 14 }}
            />
            <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-text-primary">
                    {plantsClosed ? 'Sunday — plants closed' : 'Saturday — half crew'}
                </div>
                <div className="text-[12px] text-text-secondary">
                    {plantsClosed
                        ? 'All plants are assumed closed today. Truck-coverage math treats every plant pool as 0.'
                        : 'Saturday crews run at half staffing. Every plant’s active mixer count is halved (rounded down) for the coverage math.'}
                </div>
            </div>
        </div>
    )
}
