/* eslint-disable react/forbid-dom-props */
import React, { useMemo, useState } from 'react'

/**
 * Floating avatar-chip row that shows every dispatcher currently viewing
 * the same `plan_date` on the Planner tab. Mounted absolutely in the
 * top-right of the Flow tab. Up to `MAX_VISIBLE` chips render with
 * initials; the rest collapse into a `+N` overflow chip. Hover any chip
 * for the full name, role, and editing state.
 *
 * Self is included with a "(You)" label so the dispatcher can confirm at
 * a glance that their presence is being broadcast.
 */

const MAX_VISIBLE = 6

function initials(name) {
    if (!name) return '??'
    const parts = String(name).trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '??'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Deterministic HSL color derived from the user id so each user keeps
 *  the same chip color across sessions and across clients. */
function colorForUser(id) {
    const str = String(id || '')
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0
    }
    const hue = Math.abs(hash) % 360
    return `hsl(${hue}, 65%, 42%)`
}

function PresenceChip({ user, size = 28, ringWhenEditing = true }) {
    const bg = colorForUser(user.userId)
    const ringClass = ringWhenEditing && user.editing ? 'ring-2 ring-red-500' : 'ring-1 ring-white/40'
    const dimensionStyle = { height: `${size}px`, minWidth: `${size}px`, width: `${size}px` }
    const fontStyle = { fontSize: `${Math.round(size * 0.4)}px` }
    return (
        <div
            className={`relative flex items-center justify-center rounded-full font-bold text-white shadow-md ${ringClass}`}
            style={{ background: bg, ...dimensionStyle, ...fontStyle }}
        >
            <span>{initials(user.name)}</span>
            {user.editing && (
                <span
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg-primary bg-red-500"
                    title="Editing"
                />
            )}
        </div>
    )
}

function PresenceTooltip({ user }) {
    return (
        <div className="absolute right-0 top-full z-10 mt-1.5 hidden whitespace-nowrap rounded-md border border-border-light bg-bg-primary px-2.5 py-1.5 text-[11.5px] shadow-lg group-hover:block">
            <div className="font-semibold text-text-primary">
                {user.name}
                {user.isSelf && <span className="ml-1 text-text-tertiary">(You)</span>}
            </div>
            {user.role && <div className="mt-0.5 text-text-secondary">{user.role}</div>}
            <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-text-tertiary">
                <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${user.editing ? 'bg-red-500' : 'bg-green-500'}`}
                />
                {user.editing ? 'Editing now' : 'Viewing'}
            </div>
        </div>
    )
}

export function PlanPresenceOverlay({ users }) {
    const [expanded, setExpanded] = useState(false)
    const visible = useMemo(() => {
        if (!Array.isArray(users) || users.length === 0) return []
        if (expanded) return users
        return users.slice(0, MAX_VISIBLE)
    }, [users, expanded])
    const hidden = (users?.length || 0) - visible.length

    if (!users || users.length === 0) return null

    return (
        <div
            className="absolute right-3 top-3 z-30 flex items-center gap-1.5 rounded-full border border-border-light bg-bg-primary/90 px-2 py-1.5 shadow-md backdrop-blur"
            role="status"
            aria-label={`${users.length} dispatcher${users.length === 1 ? '' : 's'} viewing this plan`}
        >
            <i className="fas fa-user-group text-[10.5px] text-text-tertiary" aria-hidden="true" />
            {visible.map((u) => (
                <div key={u.userId} className="group relative">
                    <PresenceChip user={u} />
                    <PresenceTooltip user={u} />
                </div>
            ))}
            {hidden > 0 && (
                <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-bg-tertiary px-1.5 text-[11px] font-semibold text-text-secondary hover:bg-bg-hover"
                    title={`Show ${hidden} more`}
                >
                    +{hidden}
                </button>
            )}
        </div>
    )
}

export default PlanPresenceOverlay
