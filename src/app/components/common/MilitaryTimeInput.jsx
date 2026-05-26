import React, { useEffect, useState } from 'react'

const MAX_HOURS = 23
const MAX_MINUTES = 59
const MAX_DIGITS = 4
const MAX_LENGTH = 5

/**
 * 24-hour military time input — always renders HH:MM regardless of the
 * user's OS locale (native `<input type="time">` falls back to AM/PM on
 * US English systems). Auto-inserts the colon as the user types, enforces
 * 00-23 / 00-59, and autocompletes partial input on blur:
 *   "5"    → "05:00"
 *   "23"   → "23:00"
 *   "930"  → "09:30"
 *   "1234" → "12:34"
 * Empty is allowed so the field can be cleared by backspacing.
 *
 * `compact` shrinks the padding for tight layouts (used by the planner
 * map's time scrubber). `extraClass` lets a caller layer additional
 * Tailwind utilities without losing the base styling. `surface` toggles
 * between `bg-bg-primary` (when sitting inside a card) and `bg-bg-secondary`
 * (when sitting inside a modal) so the control reads against either surface.
 */
export function MilitaryTimeInput({
    ariaLabel = 'Time (24-hour)',
    compact = false,
    extraClass = '',
    onChange,
    surface = 'primary',
    value
}) {
    const [displayValue, setDisplayValue] = useState(value || '')
    useEffect(() => {
        setDisplayValue(value || '')
    }, [value])

    const formatDigits = (digits) => {
        if (digits.length <= 2) return digits
        return `${digits.slice(0, 2)}:${digits.slice(2, MAX_DIGITS)}`
    }

    const isValidHhMm = (text) => {
        if (!/^\d{2}:\d{2}$/.test(text)) return false
        const [hh, mm] = text.split(':').map((n) => parseInt(n, 10))
        return hh >= 0 && hh <= MAX_HOURS && mm >= 0 && mm <= MAX_MINUTES
    }

    /** Best-effort interpretation of a partial input on blur. Returns a
     *  valid `HH:MM` string when the digits can be reasonably resolved, an
     *  empty string when the input was empty, or null when no sensible
     *  parse is possible (caller should revert). */
    const autocompleteFromDigits = (raw) => {
        if (!raw) return ''
        const digits = String(raw).replace(/\D/g, '')
        if (!digits) return ''
        let hh
        let mm
        if (digits.length === 1) {
            hh = `0${digits}`
            mm = '00'
        } else if (digits.length === 2) {
            hh = digits
            mm = '00'
        } else if (digits.length === 3) {
            // "930" → 9:30 (single-digit hour + 2-digit minute).
            hh = `0${digits[0]}`
            mm = digits.slice(1)
        } else {
            hh = digits.slice(0, 2)
            mm = digits.slice(2, MAX_DIGITS)
        }
        const hNum = parseInt(hh, 10)
        const mNum = parseInt(mm, 10)
        if (!Number.isFinite(hNum) || !Number.isFinite(mNum)) return null
        if (hNum < 0 || hNum > MAX_HOURS || mNum < 0 || mNum > MAX_MINUTES) return null
        return `${String(hNum).padStart(2, '0')}:${String(mNum).padStart(2, '0')}`
    }

    const handleChange = (rawValue) => {
        const digitsOnly = String(rawValue).replace(/\D/g, '').slice(0, MAX_DIGITS)
        const formatted = formatDigits(digitsOnly)
        setDisplayValue(formatted)
        if (formatted === '') {
            onChange('')
            return
        }
        if (isValidHhMm(formatted)) onChange(formatted)
    }

    const handleBlur = () => {
        if (!displayValue) {
            onChange('')
            return
        }
        if (isValidHhMm(displayValue)) return
        const completed = autocompleteFromDigits(displayValue)
        if (completed === '') {
            setDisplayValue('')
            onChange('')
            return
        }
        if (completed == null) {
            setDisplayValue(value || '')
            return
        }
        setDisplayValue(completed)
        onChange(completed)
    }

    const surfaceClass = surface === 'secondary' ? 'bg-bg-secondary' : 'bg-bg-primary'
    const baseClass =
        `rounded-md text-sm border font-mono tabular-nums ${surfaceClass} border-border-light text-text-primary outline-none ` +
        'transition-colors duration-150 hover:border-border-medium placeholder:text-text-tertiary ' +
        'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 ' +
        'disabled:opacity-50 disabled:cursor-not-allowed'
    const sizing = compact ? 'px-2 py-1.5 text-[12px]' : 'px-3 py-2'

    return (
        <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{2}:[0-9]{2}"
            placeholder="HH:MM"
            value={displayValue}
            maxLength={MAX_LENGTH}
            onChange={(event) => handleChange(event.target.value)}
            onBlur={handleBlur}
            onFocus={(event) => event.target.select()}
            autoComplete="off"
            aria-label={ariaLabel}
            className={`${baseClass} ${sizing} ${extraClass}`}
        />
    )
}
