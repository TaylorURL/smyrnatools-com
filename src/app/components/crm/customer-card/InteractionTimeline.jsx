import React from 'react'

import Badge from '../../common/Badge'

const INTERACTION_TYPE_ICON = {
    call: 'fa-phone',
    email: 'fa-envelope',
    meeting: 'fa-handshake',
    note: 'fa-note-sticky',
    site_visit: 'fa-location-dot',
    text: 'fa-message'
}

/** Tone map for role_lens badges. */
const LENS_TONE = { dispatch: 'success', general: 'neutral', plant: 'warning', sales: 'info' }

/** Per-account interaction timeline, newest-first.
 *  Renders a leading type icon, a colored role-lens label, author + date, and the comment body.
 *  @param {{ id: string, interaction_type: string, role_lens: string, comment: string|null,
 *            created_by_name: string|null, occurred_at: string }[]} interactions */
export function InteractionTimeline({ interactions = [] }) {
    if (!interactions.length) {
        return <p className="px-2.5 py-3 text-[12px] text-text-tertiary">No interactions logged yet.</p>
    }

    return (
        <ul className="flex flex-col">
            {interactions.map((interaction) => (
                <li key={interaction.id} className="flex gap-2.5 border-b border-border-light/60 px-2.5 py-1.5">
                    <i
                        className={`fas ${INTERACTION_TYPE_ICON[interaction.interaction_type] ?? 'fa-note-sticky'} mt-0.5 text-text-tertiary`}
                        aria-hidden="true"
                    />
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex items-center gap-2 text-[12px]">
                            <Badge tone={LENS_TONE[interaction.role_lens] ?? 'neutral'} size="xs">
                                {interaction.role_lens}
                            </Badge>
                            <span className="font-semibold text-text-primary">
                                {interaction.created_by_name ?? 'Unknown'}
                            </span>
                            <time className="text-text-tertiary">
                                {new Date(interaction.occurred_at).toLocaleDateString()}
                            </time>
                        </div>
                        {interaction.comment && (
                            <p className="break-words text-[12px] text-text-secondary">{interaction.comment}</p>
                        )}
                    </div>
                </li>
            ))}
        </ul>
    )
}
