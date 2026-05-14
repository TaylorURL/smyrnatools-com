import React from 'react'

/** Empty state shown when the Daily Order Listing HTML has never been
 *  imported for this date — explains what's missing and what to do next. */
export default function PlanScheduleEmptyState() {
    return (
        <div className="rounded-xl p-10 text-center bg-bg-primary border border-border-medium">
            <i className="fas fa-calendar-xmark text-3xl mb-3 opacity-60 text-text-tertiary" />
            <div className="text-[15px] font-bold mb-1 text-text-primary font-heading">No schedule yet</div>
            <div className="text-[12.5px] max-w-[480px] mx-auto text-text-secondary">
                Import the Daily Order Listing HTML to populate every plant&apos;s orders. Customer, start time,
                product, yardage, and truck count will all land here.
            </div>
        </div>
    )
}
