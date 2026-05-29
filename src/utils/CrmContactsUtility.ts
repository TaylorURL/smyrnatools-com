/** Merges auto-populated dispatch phone numbers with manually-curated
 *  `customer_contacts` rows so the CRM detail surface always has a
 *  single, ordered list to render. Dispatch numbers are seeded
 *  client-side from the roster row's `phone` field (parsed via the same
 *  `parsePhoneNumbers` util the cards use); user edits live in
 *  `customer_contacts` keyed by the normalized digit string.
 *
 *  The shape returned by `mergeCustomerContacts` is what every contact-
 *  editing surface consumes — list cards, the detail phone editor, and
 *  the call-logging dropdown that needs the chosen number.
 */

import { formatCrmPhone, parsePhoneNumbers } from './CrmRosterUtility'

/** Persisted manual override row from `customer_contacts`. */
export interface CustomerContactRow {
    contact_name: string | null
    created_at: string
    id: string
    is_hidden: boolean
    is_primary: boolean
    label: string | null
    notes: string | null
    phone_digits: string
    phone_display: string
    source: 'manual' | 'dispatch'
    updated_at: string
}

export interface MergedContact {
    contactName: string | null
    display: string
    href: string
    /** True when the user explicitly hid this dispatch-derived number. */
    isHidden: boolean
    isPrimary: boolean
    label: string | null
    notes: string | null
    /** Normalized digits — stable key for React + the API. */
    phoneDigits: string
    phoneDisplay: string
    /** `dispatch` = seeded from latest dispatch order phone field;
     *  `manual` = added or edited by a user. */
    source: 'manual' | 'dispatch'
}

/** Merge the parsed dispatch numbers with the manual contacts table.
 *  Manual overrides win on label / contact_name / primary / hidden.
 *  Manual-only entries (not present in dispatch) are appended.
 *  Hidden entries are excluded from the returned list.
 *
 *  Ordering: primary first, then unhidden dispatch entries in their
 *  original order, then unhidden manual additions newest-first. */
export const mergeCustomerContacts = (
    dispatchPhoneRaw: string | null | undefined,
    contacts: CustomerContactRow[] | null | undefined
): MergedContact[] => {
    const overrides = new Map<string, CustomerContactRow>()
    for (const row of contacts || []) {
        if (row?.phone_digits) overrides.set(row.phone_digits, row)
    }

    const parsed = parsePhoneNumbers(dispatchPhoneRaw)
    const merged: MergedContact[] = []
    const consumed = new Set<string>()

    for (const entry of parsed) {
        const override = overrides.get(entry.key)
        if (override) consumed.add(override.phone_digits)
        if (override?.is_hidden) continue
        merged.push({
            contactName: override?.contact_name ?? null,
            display: override?.phone_display
                ? formatCrmPhone(override.phone_display) || override.phone_display
                : entry.display,
            href: entry.href,
            isHidden: false,
            isPrimary: override?.is_primary ?? false,
            label: override?.label ?? entry.label ?? null,
            notes: override?.notes ?? null,
            phoneDigits: entry.key,
            phoneDisplay: override?.phone_display ?? entry.raw,
            source: 'dispatch'
        })
    }

    const manualAdditions = (contacts || [])
        .filter((row) => !consumed.has(row.phone_digits) && !row.is_hidden && row.source === 'manual')
        .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))

    for (const row of manualAdditions) {
        merged.push({
            contactName: row.contact_name,
            display: formatCrmPhone(row.phone_display) || row.phone_display,
            href: row.phone_digits,
            isHidden: false,
            isPrimary: row.is_primary,
            label: row.label,
            notes: row.notes,
            phoneDigits: row.phone_digits,
            phoneDisplay: row.phone_display,
            source: 'manual'
        })
    }

    merged.sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
        return 0
    })

    return merged
}

/** Digit-key for any free-text phone string the user types into the
 *  "Add number" form. Matches the server's `normalizePhoneDigits` so the
 *  upsert lands on the same row as a parsed dispatch entry when the
 *  digits agree. */
export const normalizeContactDigits = (input: string | null | undefined): string => {
    if (!input) return ''
    const digits = String(input).replace(/\D+/g, '')
    if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
    return digits
}
