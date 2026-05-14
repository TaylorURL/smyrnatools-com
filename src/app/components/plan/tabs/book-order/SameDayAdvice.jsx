import React from 'react'

/** Same-day shortcut — Smyrna's standing rule is that any pour booked for
 *  today goes out at 15:00 regardless of plant analysis. We bypass the
 *  geocoder, plant ranking, and conflict resolution entirely so the
 *  dispatcher gets a single direct instruction instead of computed
 *  suggestions that don't apply. */
export default function SameDayAdvice({ accentColor }) {
    return (
        <div className="rounded-lg p-4 flex items-start gap-3 bg-[rgba(22,_163,_74,_0.08)] border border-[rgba(22,_163,_74,_0.35)]">
            <div
                className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0 text-white"
                style={{ background: accentColor }}
            >
                <i className="fas fa-clock text-[16px]" />
            </div>
            <div className="min-w-0">
                <div className="text-[15px] font-bold text-text-primary">Book this at 15:00</div>
                <div className="text-[12px] mt-0.5 text-text-secondary">
                    Same-day bookings run at 15:00 — no plant analysis needed.
                </div>
            </div>
        </div>
    )
}
