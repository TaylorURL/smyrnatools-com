import React from 'react'

import AssetStatsUtility from '../../../utils/AssetStatsUtility'
import DateUtility from '../../../utils/DateUtility'
import { CLEANLINESS_RATING_LABELS } from '../../constants/tractorDetailConstants'
import StarRating from '../common/StarRating'
import DetailViewSection from '../sections/DetailViewSection'

// Canonical chevron-bearing select treatment for the tractor maintenance card.
// Mirrors the surrounding `form-control` size while using a `currentColor`
// chevron so the affordance follows `text-text-primary` across themes.
const SELECT_CLS =
    "w-full appearance-none cursor-pointer rounded border border-border-light bg-bg-secondary text-text-primary text-[0.8125rem] px-2.5 py-[0.4375rem] pr-9 bg-no-repeat bg-[right_0.75rem_center] bg-[length:1rem_1rem] transition-colors duration-150 hover:border-border-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:border-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed [color-scheme:light] dark:[color-scheme:dark] bg-[url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20fill='none'%20viewBox='0%200%2024%2024'%20stroke='currentColor'%3E%3Cpath%20stroke-linecap='round'%20stroke-linejoin='round'%20stroke-width='2'%20d='M19%209l-7%207-7-7'%3E%3C/path%3E%3C/svg%3E\")]"

/** Formats a Date instance into YYYY-MM-DD for the `<input type="date">` value. */
function formatIsoDate(date) {
    if (!date) return ''
    return date instanceof Date ? date.toISOString().split('T')[0] : date
}

/** Renders the 1-5 cleanliness star picker, including the textual label readout. */
function CleanlinessRating({ canEditTractor, cleanlinessRating, setCleanlinessRating }) {
    return (
        <div className="form-group">
            <label>Cleanliness Rating</label>
            <div className="flex flex-col gap-2">
                <StarRating
                    value={cleanlinessRating}
                    onChange={canEditTractor ? setCleanlinessRating : undefined}
                    size="lg"
                    tone="warning"
                />
                {cleanlinessRating > 0 && (
                    <span className="text-[13px] font-semibold text-text-primary">
                        {CLEANLINESS_RATING_LABELS[cleanlinessRating]}
                    </span>
                )}
            </div>
        </div>
    )
}

/**
 * "Maintenance" tab on the tractor detail view: last service date,
 * hours, blower flag, and cleanliness rating.
 */
function TractorMaintenanceSection({
    canEditTractor,
    cleanlinessRating,
    hasBlower,
    hours,
    lastServiceDate,
    setCleanlinessRating,
    setHasBlower,
    setHours,
    setLastServiceDate
}) {
    return (
        <DetailViewSection.Section id="maintenance" title="Maintenance" icon="fas fa-wrench">
            <DetailViewSection.Card title="Service Information" icon="fas fa-calendar-alt">
                <div className="form-group">
                    <label>Last Service Date</label>
                    <input
                        type="date"
                        value={lastServiceDate ? formatIsoDate(lastServiceDate) : ''}
                        onChange={(e) =>
                            setLastServiceDate(e.target.value ? DateUtility.parseLocalDate(e.target.value) : null)
                        }
                        className="form-control [color-scheme:light] dark:[color-scheme:dark]"
                        readOnly={!canEditTractor}
                    />
                    {lastServiceDate && AssetStatsUtility.isServiceOverdue(lastServiceDate) && (
                        <div className="warning-text">Service overdue</div>
                    )}
                    <div className="text-text-secondary text-[11px] leading-snug mt-1">
                        Service will show as overdue if it has been more than 6 months since last serviced. Service is
                        determined by hours on the asset - check hours of service.
                    </div>
                </div>
                <div className="form-group">
                    <label>Hours</label>
                    <input
                        type="number"
                        value={hours}
                        onChange={(e) => setHours(e.target.value)}
                        className="form-control"
                        readOnly={!canEditTractor}
                        min="0"
                        step="any"
                        placeholder="Enter hours"
                    />
                </div>
                <div className="form-group">
                    <label>Has Blower</label>
                    <select
                        value={hasBlower ? 'Yes' : 'No'}
                        onChange={(e) => setHasBlower(e.target.value === 'Yes')}
                        disabled={!canEditTractor}
                        className={SELECT_CLS}
                    >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                    </select>
                </div>
            </DetailViewSection.Card>
            <DetailViewSection.Card title="Cleanliness Rating" icon="fas fa-broom">
                <CleanlinessRating
                    canEditTractor={canEditTractor}
                    cleanlinessRating={cleanlinessRating}
                    setCleanlinessRating={setCleanlinessRating}
                />
            </DetailViewSection.Card>
        </DetailViewSection.Section>
    )
}

export default TractorMaintenanceSection
