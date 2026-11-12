import React from 'react'

import { NOTE_EXPIRY_MONTHS } from '../../../../utils/StaleNoteUtility'
import Badge from '../../common/Badge'

/**
 * The line under a resolved comment or issue saying when it was resolved and,
 * when the nightly job did it rather than a person, that it timed out: it was
 * left active for `NOTE_EXPIRY_MONTHS` months without being kept permanently.
 * `when` is the already formatted resolve date.
 */
export default function ResolvedNoteLine({ autoResolved = false, when }) {
    if (!autoResolved) {
        return <p className="m-0 text-[12px] text-text-secondary">Resolved {when}</p>
    }
    return (
        <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-text-secondary">
            <Badge
                tone="neutral"
                size="xs"
                icon="hourglass-end"
                title={`Marked resolved automatically because it was ${NOTE_EXPIRY_MONTHS} months old and not kept permanently`}
            >
                Timed out
            </Badge>
            <span>
                Auto-resolved {when} after {NOTE_EXPIRY_MONTHS} months
            </span>
        </p>
    )
}
