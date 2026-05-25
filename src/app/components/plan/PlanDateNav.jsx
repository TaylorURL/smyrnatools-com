/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import useFixedDropdownPosition from '../../hooks/useFixedDropdownPosition'
import { getTodayDate, getTomorrowDate, offsetDateSkipSunday, skipSundayDate } from '../../../utils/PlanUtility'

/** Display variant for the realtime tab — date is locked to today and
 *  rendered as a read-only pill. Switching to realtime always anchors the
 *  page to "right now," so a date selector would be misleading. */
function RealtimeDatePill({ accentColor, isDark, planDate }) {
    return (
        <div
            className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold px-2.5 py-1"
            style={{ backgroundColor: `${accentColor}${isDark ? '30' : '15'}`, color: accentColor }}
            title="Realtime is locked to today"
        >
            <i className="fas fa-circle-dot text-[10px]" />
            <span>
                Today ·{' '}
                {new Date(planDate + 'T00:00:00').toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    weekday: 'short'
                })}
            </span>
        </div>
    )
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const padTwo = (n) => String(n).padStart(2, '0')
const isoFromParts = (y, m1Based, d) => `${y}-${padTwo(m1Based)}-${padTwo(d)}`
const monthLabel = (y, m1Based) =>
    new Date(y, m1Based - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

/** Build the [leading blanks, ...days] cell list for a calendar month. */
const buildCalendarCells = (year, month1Based) => {
    const first = new Date(year, month1Based - 1, 1)
    const startWeekday = first.getDay()
    const daysInMonth = new Date(year, month1Based, 0).getDate()
    const cells = []
    for (let i = 0; i < startWeekday; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({
            day: d,
            iso: isoFromParts(year, month1Based, d),
            weekday: new Date(year, month1Based - 1, d).getDay()
        })
    }
    return cells
}

/** Themed mini-calendar popover. Uses CSS variables for every color so it
 *  reads in both light and dark mode without any accent reliance. Sundays
 *  are dimmed and disabled (plants closed); the Today / Tomorrow shortcuts
 *  route through `skipSundayDate` so the user can never land on one.
 *  Positioned via inline `position: fixed` coords from the parent so it
 *  can be portaled to `document.body` and escape any ancestor `overflow`
 *  clipping (the Plan header has `overflow-x: auto` which implicitly
 *  clips Y too — without the portal the calendar reads as cut off by the
 *  content area below the header). */
function MiniCalendar({ menuRef, onClose, onSelect, planDate, pos }) {
    const todayIso = getTodayDate()
    const initial = useMemo(() => {
        const src = planDate || todayIso
        const [y, m] = src.split('-').map(Number)
        return { month: m, year: y }
    }, [planDate, todayIso])
    const [view, setView] = useState(initial)
    useEffect(() => {
        setView(initial)
    }, [initial])

    const cells = useMemo(() => buildCalendarCells(view.year, view.month), [view])

    const stepMonth = (delta) => {
        setView((prev) => {
            let m = prev.month + delta
            let y = prev.year
            if (m < 1) {
                m = 12
                y -= 1
            }
            if (m > 12) {
                m = 1
                y += 1
            }
            return { month: m, year: y }
        })
    }

    const pickDate = (iso) => {
        onSelect(iso)
        onClose()
    }

    return (
        <div
            ref={menuRef}
            className="fixed z-50 rounded-lg p-2 bg-bg-primary border border-border-light"
            style={{ boxShadow: 'var(--shadow-lg)', left: pos.left, minWidth: 240, top: pos.top }}
            role="dialog"
            aria-label="Pick a date"
        >
            <div className="flex items-center justify-between mb-1.5 px-1">
                <button
                    type="button"
                    onClick={() => stepMonth(-1)}
                    className="border-none bg-transparent cursor-pointer p-1 rounded inline-flex items-center justify-center text-text-secondary"
                    title="Previous month"
                    aria-label="Previous month"
                >
                    <i className="fas fa-chevron-left text-[11px]" />
                </button>
                <span className="text-[12.5px] font-semibold text-text-primary">
                    {monthLabel(view.year, view.month)}
                </span>
                <button
                    type="button"
                    onClick={() => stepMonth(1)}
                    className="border-none bg-transparent cursor-pointer p-1 rounded inline-flex items-center justify-center text-text-secondary"
                    title="Next month"
                    aria-label="Next month"
                >
                    <i className="fas fa-chevron-right text-[11px]" />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5">
                {WEEKDAY_LABELS.map((d, i) => (
                    <span
                        key={`wd-${i}`}
                        className="text-[9.5px] font-bold uppercase text-center py-1 text-text-tertiary"
                    >
                        {d}
                    </span>
                ))}
                {cells.map((cell, idx) => {
                    if (!cell) return <span key={`b-${idx}`} />
                    const isToday = cell.iso === todayIso
                    const isSelected = cell.iso === planDate
                    const isSunday = cell.weekday === 0
                    return (
                        <button
                            key={cell.iso}
                            type="button"
                            onClick={() => !isSunday && pickDate(cell.iso)}
                            disabled={isSunday}
                            className="text-[12px] py-1.5 rounded border-none transition-colors"
                            style={{
                                background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                                boxShadow: isToday && !isSelected ? 'inset 0 0 0 1px var(--border-medium)' : 'none',
                                color: isSunday ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                cursor: isSunday ? 'not-allowed' : 'pointer',
                                fontWeight: isSelected || isToday ? 700 : 500,
                                opacity: isSunday ? 0.4 : 1
                            }}
                            title={isSunday ? 'Plants closed Sunday' : undefined}
                        >
                            {cell.day}
                        </button>
                    )
                })}
            </div>
            <div className="flex justify-between gap-1 mt-2 pt-1.5 border-t border-border-light">
                <button
                    type="button"
                    onClick={() => pickDate(skipSundayDate(getTodayDate(), 1))}
                    className="text-[10.5px] font-semibold px-2 py-1 rounded border-none cursor-pointer bg-bg-secondary border border-border-light text-text-primary"
                >
                    Today
                </button>
                <button
                    type="button"
                    onClick={() => pickDate(skipSundayDate(getTomorrowDate(), 1))}
                    className="text-[10.5px] font-semibold px-2 py-1 rounded border-none cursor-pointer bg-bg-secondary border border-border-light text-text-primary"
                >
                    Tomorrow
                </button>
            </div>
        </div>
    )
}

/** Compact prev / picker / next cluster used on every non-realtime tab.
 *  Uses neutral CSS-variable tones so it stays legible in dark mode (the
 *  previous accent-tinted styling washed out against the dark surface).
 *  When `disabled`, all controls render with reduced opacity, no hover
 *  affordance, and clicks are swallowed so the surrounding tab can own
 *  the date scope (e.g. Statistics' built-in range + custom-tab picker). */
function DateStepper({ disabled = false, disabledReason, onChange, planDate }) {
    const [open, setOpen] = useState(false)
    const triggerRef = useRef(null)
    const menuRef = useRef(null)
    const pos = useFixedDropdownPosition(triggerRef, open, 'left')

    useEffect(() => {
        if (!open) return undefined
        // Dismiss on outside click — check BOTH the trigger and the
        // portaled menu since the menu sits outside the stepper's DOM
        // subtree. Without the menu check, every click inside the
        // calendar would close it.
        const onMouseDown = (e) => {
            if (triggerRef.current?.contains(e.target)) return
            if (menuRef.current?.contains(e.target)) return
            setOpen(false)
        }
        const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onMouseDown)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onMouseDown)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    // Force-close any lingering popover the moment the stepper goes
    // disabled — prevents the calendar from sitting open on a tab swap.
    useEffect(() => {
        if (disabled && open) setOpen(false)
    }, [disabled, open])

    const buttonCursor = disabled ? 'not-allowed' : 'pointer'
    const wrapperTitle = disabled ? disabledReason : undefined

    return (
        <div
            className="relative inline-flex items-center gap-0.5 rounded-lg text-sm font-semibold px-1.5 py-1 bg-bg-secondary border border-border-light text-text-primary"
            style={{ cursor: disabled ? 'not-allowed' : 'default', opacity: disabled ? 0.55 : 1 }}
            title={wrapperTitle}
            aria-disabled={disabled}
        >
            <button
                type="button"
                onClick={() => !disabled && onChange(offsetDateSkipSunday(planDate, -1))}
                disabled={disabled}
                className="border-none bg-transparent p-1 rounded inline-flex items-center justify-center text-text-secondary"
                style={{ cursor: buttonCursor }}
                title={disabled ? disabledReason : 'Previous day'}
                aria-label="Previous day"
            >
                <i className="fas fa-chevron-left text-xs" />
            </button>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => !disabled && setOpen((v) => !v)}
                disabled={disabled}
                className="border-none bg-transparent px-2 py-0.5 rounded font-semibold text-sm inline-flex items-center gap-1.5 text-text-primary"
                style={{ cursor: buttonCursor }}
                title={disabled ? disabledReason : 'Click to pick a date'}
                aria-haspopup={disabled ? undefined : 'dialog'}
                aria-expanded={!disabled && open}
            >
                {new Date(planDate + 'T00:00:00').toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    weekday: 'short'
                })}
                <i className="fas fa-caret-down text-[10px] text-text-tertiary" />
            </button>
            <button
                type="button"
                onClick={() => !disabled && onChange(offsetDateSkipSunday(planDate, 1))}
                disabled={disabled}
                className="border-none bg-transparent p-1 rounded inline-flex items-center justify-center text-text-secondary"
                style={{ cursor: buttonCursor }}
                title={disabled ? disabledReason : 'Next day'}
                aria-label="Next day"
            >
                <i className="fas fa-chevron-right text-xs" />
            </button>
            {open &&
                !disabled &&
                pos &&
                createPortal(
                    <MiniCalendar
                        menuRef={menuRef}
                        onClose={() => setOpen(false)}
                        onSelect={onChange}
                        planDate={planDate}
                        pos={pos}
                    />,
                    document.body
                )}
        </div>
    )
}

/** "Tomorrow" shortcut button — highlights when planDate matches tomorrow
 *  (Sunday-skipped to Monday) so it acts like a tab/toggle, not just a
 *  one-shot action. Disabled state mirrors the stepper above. */
function TomorrowButton({ accentColor, disabled = false, disabledReason, isDark, onChange, planDate }) {
    const tomorrowTarget = skipSundayDate(getTomorrowDate(), 1)
    const isTomorrow = planDate === tomorrowTarget
    return (
        <button
            onClick={() => !disabled && onChange(tomorrowTarget)}
            disabled={disabled}
            title={disabled ? disabledReason : undefined}
            className="border-none rounded-lg text-xs font-semibold px-2.5 py-1.5"
            style={{
                background: isTomorrow ? `${accentColor}${isDark ? '30' : '15'}` : 'var(--bg-tertiary)',
                color: isTomorrow ? accentColor : 'var(--text-secondary)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.55 : 1
            }}
        >
            Tomorrow
        </button>
    )
}

/**
 * Date controls in the Plan header. Realtime tab gets a read-only pill;
 * every other tab gets a prev/picker/next stepper plus a "Tomorrow"
 * shortcut. All paths route through `skipSundayDate` so the user can
 * never land on a closed-plant Sunday. Pass `disabled` (with an optional
 * `disabledReason` tooltip) when a tab owns its own date scope and the
 * Plan-wide date should sit inert — currently used by the Statistics tab.
 */
export function PlanDateNav({ accentColor, disabled = false, disabledReason, isDark, isRealtime, onChange, planDate }) {
    if (isRealtime) {
        return <RealtimeDatePill accentColor={accentColor} isDark={isDark} planDate={planDate} />
    }
    return (
        <>
            <DateStepper disabled={disabled} disabledReason={disabledReason} onChange={onChange} planDate={planDate} />
            <TomorrowButton
                accentColor={accentColor}
                disabled={disabled}
                disabledReason={disabledReason}
                isDark={isDark}
                onChange={onChange}
                planDate={planDate}
            />
        </>
    )
}
