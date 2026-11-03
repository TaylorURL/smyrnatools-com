import React from 'react'

import { STALE_NOTE_DAYS } from '../../../utils/StaleNoteUtility'
import Badge from './Badge'

/** The marker on a comment or open issue older than `STALE_NOTE_DAYS`: it is
 *  probably no longer accurate, so readers should check it before acting on it. */
export default function StaleNoteFlag() {
    return (
        <Badge
            tone="warning"
            size="xs"
            icon="clock-rotate-left"
            title={`Over ${STALE_NOTE_DAYS} days old, so it may no longer be accurate`}
        >
            May be out of date
        </Badge>
    )
}
