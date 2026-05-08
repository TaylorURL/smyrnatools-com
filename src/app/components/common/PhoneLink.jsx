import React from 'react'

import { GrammarUtility } from '../../../utils/GrammarUtility'

const stripToDigits = (phone) => String(phone || '').replace(/\D/g, '')

/**
 * Tappable phone-number renderer. Wraps the value in a `tel:` anchor so a
 * click hands off to the OS's registered dialer — Avaya Workplace /
 * Equinox / one-X register as the `tel:` protocol handler on the desktop,
 * mobile browsers natively dial. Falls back to a plain `<span>` when the
 * input doesn't have enough digits to be a real number (extension-only
 * fragments, "—", etc.).
 *
 * `onClick` propagation is stopped so a row-level click handler on the
 * parent doesn't intercept the dial.
 *
 * @param {object} props
 * @param {string} props.phone     - Raw phone string (any format).
 * @param {string} [props.display] - Optional override for the visible label;
 *                                   defaults to `GrammarUtility.formatPhone`.
 * @param {string} [props.className]
 * @param {object} [props.style]
 * @param {string} [props.title]
 */
function PhoneLink({ className = '', display, phone, style, title }) {
    if (!phone) return null
    const digits = stripToDigits(phone)
    const label = display ?? GrammarUtility.formatPhone(phone)
    if (digits.length < 7) {
        return (
            <span className={className} style={style} title={title}>
                {label}
            </span>
        )
    }
    return (
        <a
            href={`tel:${digits}`}
            className={`hover:underline ${className}`.trim()}
            style={{ color: 'inherit', ...style }}
            title={title || label}
            onClick={(event) => event.stopPropagation()}
        >
            {label}
        </a>
    )
}

export default PhoneLink
