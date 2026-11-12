import React from 'react'

import { formatCentralDate } from '../../../../utils/PlanUtility'
import { isStaleNote, NOTE_EXPIRY_MONTHS, noteExpiresAt } from '../../../../utils/StaleNoteUtility'
import Badge from '../../common/Badge'
import StaleNoteFlag from '../../common/StaleNoteFlag'

/**
 * The one status a comment or issue carries, decided when it was written:
 * kept permanently, or counting down to the nightly expiry. Past thirty days
 * the countdown gives way to the "May be out of date" flag, which is the more
 * useful thing to know by then. A resolved issue is history, so it is never
 * doubted and never expires, and shows nothing unless it was kept.
 */
export default function NoteStatusChip({ createdAt, permanent, resolved = false }) {
    if (permanent) {
        return (
            <Badge tone="accent" size="xs" icon="thumbtack" title="Kept permanently, so it is never auto-deleted">
                Permanent
            </Badge>
        )
    }
    if (resolved) return null
    if (isStaleNote(createdAt)) return <StaleNoteFlag />
    const expiresAt = noteExpiresAt(createdAt)
    if (!expiresAt) return null
    return (
        <Badge
            tone="neutral"
            size="xs"
            icon="hourglass-half"
            title={`Deleted automatically ${NOTE_EXPIRY_MONTHS} months after it was written`}
        >
            Deletes {formatCentralDate(expiresAt, { day: 'numeric', month: 'short' })}
        </Badge>
    )
}
