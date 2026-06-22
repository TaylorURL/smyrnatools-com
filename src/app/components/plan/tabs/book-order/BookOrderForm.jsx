import React from 'react'

import {
    DEFAULT_LOAD_SIZE_YARDS,
    DEFAULT_TRUCK_SPACING_MIN,
    POUR_METHOD_OPTIONS
} from '../../../../../utils/BookOrderUtility'
import DateUtility from '../../../../../utils/DateUtility'
import {
    FIELD_LABEL_CLASS,
    FIELD_STYLE,
    formatMinutesAsClock,
    normalizeMilitaryTime
} from '../../../../constants/bookOrderConstants'
import AddressAutocomplete from '../../../common/AddressAutocomplete'

/** Booking-form column — date / yardage / time / pour method / spacing /
 *  address + the live estimate (or exceeds-shift warning). The dispatcher
 *  submits to surface recommendations in the right pane; reset wipes every
 *  field back to empty. */
export default function BookOrderForm({
    accentColor,
    address,
    dateError,
    handleDateChange,
    handleReset,
    handleSubmit,
    onAddressChange,
    onPourMethodChange,
    onSpacingMinChange,
    onStartTimeChange,
    onYardageChange,
    planDate,
    planDateIsSunday,
    planDateLabel,
    pourMethod,
    request,
    requiresSpacing,
    spacingMin,
    startTime,
    startTimeIsPast,
    startTimeMalformed,
    submitted,
    todayDate,
    yardage
}) {
    return (
        <section className="lg:col-span-4 rounded-lg flex flex-col bg-bg-primary border border-border-light">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border-light">
                <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0 bg-bg-tertiary"
                    style={{ color: 'var(--text-primary)' }}
                >
                    <i className="fas fa-clipboard-list text-[16px]" />
                </div>
                <div>
                    <div className="text-[14px] font-semibold text-text-primary">Find a Spot</div>
                    <div className="text-[12px] mt-0.5 text-text-tertiary">
                        Booking-assist tool — surfaces the best plant + time for an order. It does not place the
                        booking; the dispatcher still books manually.
                        {planDateLabel && (
                            <span className="block mt-1 text-text-secondary">Looking at {planDateLabel}</span>
                        )}
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="px-5 py-5 flex flex-col gap-4">
                <div>
                    <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                        Date
                    </label>
                    <input
                        type="date"
                        value={planDate || ''}
                        min={todayDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                        required
                        aria-invalid={dateError ? true : undefined}
                        className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none transition-colors duration-150 hover:border-border-dark focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_30%,transparent)] [color-scheme:light] dark:[color-scheme:dark]"
                        style={FIELD_STYLE}
                    />
                    {dateError && <p className="mt-1.5 text-[11px] text-text-primary">{dateError}</p>}
                    {!dateError && planDateIsSunday && (
                        <p className="mt-1.5 text-[11px] text-text-primary">
                            Plants are closed on Sundays — pick a weekday or Saturday.
                        </p>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            Yardage
                        </label>
                        <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.5"
                            value={yardage}
                            onChange={(e) => onYardageChange(e.target.value)}
                            placeholder="50"
                            required
                            className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none transition-colors duration-150 hover:border-border-dark focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_30%,transparent)]"
                            style={FIELD_STYLE}
                        />
                    </div>
                    <div>
                        <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            Time (24-hour)
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={startTime}
                            onChange={(e) => onStartTimeChange(e.target.value)}
                            onBlur={(e) => onStartTimeChange(normalizeMilitaryTime(e.target.value))}
                            placeholder="14:30"
                            pattern="^([01][0-9]|2[0-3]):[0-5][0-9]$"
                            maxLength={5}
                            required
                            aria-invalid={startTimeMalformed || startTimeIsPast || undefined}
                            className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none font-mono tabular-nums transition-colors duration-150 hover:border-border-dark focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_30%,transparent)]"
                            style={FIELD_STYLE}
                        />
                        {startTimeMalformed && (
                            <p className="mt-1.5 text-[11px] text-text-primary">
                                Use 24-hour HH:MM (e.g. 09:00, 14:30, 23:15).
                            </p>
                        )}
                        {!startTimeMalformed && startTimeIsPast && (
                            <p className="mt-1.5 text-[11px] text-text-primary">
                                Start time has already passed today — pick a later time or change the date.
                            </p>
                        )}
                    </div>
                </div>

                <div>
                    <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                        How are they pouring?
                    </label>
                    <div className="relative">
                        <select
                            value={pourMethod}
                            onChange={(e) => onPourMethodChange(e.target.value)}
                            className="w-full appearance-none rounded-lg px-3 py-2.5 pr-9 text-[14px] outline-none cursor-pointer transition-colors duration-150 hover:border-border-dark focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_30%,transparent)]"
                            style={FIELD_STYLE}
                        >
                            <option value="">Select a method (optional)</option>
                            {POUR_METHOD_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none text-text-tertiary" />
                    </div>
                    <p className="mt-1.5 text-[11px] text-text-tertiary">
                        Helps the system determine how many trucks this pour will need.
                    </p>
                </div>

                {requiresSpacing && (
                    <div>
                        <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            Truck Spacing (min)
                        </label>
                        <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            step="1"
                            value={spacingMin}
                            onChange={(e) => onSpacingMinChange(e.target.value)}
                            /* Anything under 10 min is unrealistic for real-world
                             * loading-bay throughput — snap to 6 on blur so the
                             * recommender never works off a fantasy spacing the
                             * dispatcher typed in a hurry. */
                            onBlur={() => {
                                const num = parseFloat(spacingMin)
                                if (Number.isFinite(num) && num > 0 && num < 10) onSpacingMinChange('6')
                            }}
                            placeholder={String(DEFAULT_TRUCK_SPACING_MIN)}
                            required
                            className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none transition-colors duration-150 hover:border-border-dark focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_30%,transparent)]"
                            style={FIELD_STYLE}
                        />
                        <p className="mt-1.5 text-[11px] text-text-tertiary">
                            Minutes between truck arrivals on a multi-load pour. Anything under 10 min snaps to 6 —
                            that&apos;s the tightest spacing a loading bay can sustain.
                        </p>
                    </div>
                )}

                <div>
                    <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                        Job Address
                    </label>
                    <AddressAutocomplete
                        value={address}
                        onChange={onAddressChange}
                        placeholder="Street, City, State ZIP"
                        required
                        fieldStyle={FIELD_STYLE}
                    />
                    <p className="mt-1.5 text-[11px] text-text-tertiary">
                        Start typing — pick a suggestion to verify the address. Drive time runs against the verified
                        location.
                    </p>
                </div>

                {request &&
                    (request.exceedsShiftLimit ? (
                        <div className="rounded-lg px-3 py-2.5 text-[12px] flex flex-col gap-1.5 bg-[rgba(220,_38,_38,_0.08)] border border-[rgba(220,_38,_38,_0.35)] text-text-primary">
                            <div className="flex items-center gap-1.5 font-semibold">
                                <i className="fas fa-triangle-exclamation text-[11px]" />
                                Pour exceeds the 14-hour shift limit
                            </div>
                            <div className="text-[11.5px] text-text-secondary">
                                At {request.spacingMin}-min spacing, this {request.yardage}-yd pour runs about{' '}
                                {(request.projectedShiftMin / 60).toFixed(1)}h from first load-out to back-at-yard —
                                over the 14h driver-shift cap.
                            </div>
                            <div className="text-[11px] text-text-secondary">
                                Drop the spacing below it or shrink the yardage so the pour fits a single 14h shift.
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-lg px-3 py-2.5 text-[12px] flex flex-col gap-1 bg-bg-secondary border border-border-light">
                            <div className="flex justify-between text-text-secondary">
                                <span>Estimated trucks</span>
                                <span className="font-semibold text-text-primary">{request.trucksNeeded}</span>
                            </div>
                            <div className="flex justify-between text-text-secondary">
                                <span>Pour window</span>
                                <span className="font-semibold tabular-nums text-text-primary">
                                    {formatMinutesAsClock(request.startMin)}–
                                    {formatMinutesAsClock(request.startMin + request.durationMin)}
                                </span>
                            </div>
                            <div className="text-[10.5px] mt-1 text-text-tertiary">
                                Assumes {DEFAULT_LOAD_SIZE_YARDS}-yd loads, {request.spacingMin}-min spacing.
                            </div>
                        </div>
                    ))}

                <div className="flex gap-2">
                    <button type="button"
                        type="submit"
                        disabled={!request || !!request.exceedsShiftLimit}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg text-[12px] font-semibold uppercase tracking-wider text-white px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] disabled:active:scale-100 transition-transform duration-150 ease-out motion-reduce:transition-none"
                        style={{ background: accentColor }}
                    >
                        <i className="fas fa-magnifying-glass-chart text-[12px]" />
                        Find Best Plant
                    </button>
                    {/* Hidden when every field is empty so the button doesn't add
                     * noise on a fresh form. */}
                    {(yardage || startTime || spacingMin || address || pourMethod || submitted) && (
                        <button type="button"
                            type="button"
                            onClick={handleReset}
                            className="inline-flex items-center gap-2 rounded-lg text-[12px] font-semibold uppercase tracking-wider px-3.5 py-2.5 bg-bg-secondary border border-border-light text-text-secondary active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                            title="Clear every field on the form"
                        >
                            <i className="fas fa-eraser text-[12px]" />
                            Clear
                        </button>
                    )}
                </div>
            </form>
        </section>
    )
}

// Re-export DateUtility-formatted date label so the orchestrator can use it
// without re-importing DateUtility just for this single call.
export const formatPlanDateLabel = (planDate) => DateUtility.formatDate(planDate)
