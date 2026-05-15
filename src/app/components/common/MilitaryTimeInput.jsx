import React, { useEffect, useState } from 'react'

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
 * Tailwind utilities without losing the base styling.
 */
export function MilitaryTimeInput({ ariaLabel = 'Time (24-hour)', compact = false, extraClass = '', onChange, value }) {
    const [displayValue, setDisplayValue] = useState(value || '')
    useEffect(() => {
        setDisplayValue(value || '')
    }, [value])

    const formatDigits = (digits) => {
        if (digits.length <= 2) return digits
        return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`
    }

    const isValidHhMm = (text) => {
        if (!/^\d{2}:\d{2}$/.test(text)) return false
        const [hh, mm] = text.split(':').map((n) => parseInt(n, 10))
        return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59
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
            mm = digits.slice(2, 4)
        }
        const hNum = parseInt(hh, 10)
        const mNum = parseInt(mm, 10)
        if (!Number.isFinite(hNum) || !Number.isFinite(mNum)) return null
        if (hNum < 0 || hNum > 23 || mNum < 0 || mNum > 59) return null
        return `${String(hNum).padStart(2, '0')}:${String(mNum).padStart(2, '0')}`
    }

    const handleChange = (rawValue) => {
        const digitsOnly = String(rawValue).replace(/\D/g, '').slice(0, 4)
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

    const baseClass =
        'rounded-lg text-sm border font-mono tabular-nums bg-bg-primary border-border-medium text-text-primary'
    const sizing = compact ? 'px-2 py-1.5 text-[12px]' : 'px-3 py-2'
    return (
        <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{2}:[0-9]{2}"
            placeholder="HH:MM"
            value={displayValue}
            maxLength={5}
            onChange={(event) => handleChange(event.target.value)}
            onBlur={handleBlur}
            onFocus={(event) => event.target.select()}
            autoComplete="off"
            aria-label={ariaLabel}
            className={`${baseClass} ${sizing} ${extraClass}`}
        />
    )
}
