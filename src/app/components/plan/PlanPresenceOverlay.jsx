import React, { useMemo, useState } from 'react'

import { useUserAccents } from '../../hooks/useUserAccent'
import UserAvatar from '../common/UserAvatar'

/**
 * Floating avatar-chip row that shows every dispatcher currently viewing
 * the same `plan_date` on the Planner tab. Mounted absolutely in the
 * top-right of the Flow tab. Up to `MAX_VISIBLE` chips render with
 * initials; the rest collapse into a `+N` overflow chip. Hover any chip
 * for the full name, role, and editing state.
 *
 * Self is included with a "(You)" label so the dispatcher can confirm at
 * a glance that their presence is being broadcast. Each chip uses that
 * dispatcher's own accent colour so they're identifiable at a glance.
 */

const MAX_VISIBLE = 6

function PresenceChip({ accentColor, ringWhenEditing = true, size = 28, user }) {
    const ringClass = ringWhenEditing && user.editing ? 'ring-2 ring-status-danger' : 'ring-2 ring-bg-primary'
    return (
        <UserAvatar accentColor={accentColor} className={`shadow-sm ${ringClass}`} name={user.name} size={size}>
            {user.editing && (
                <span
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg-primary bg-status-danger animate-pulse motion-reduce:animate-none"
                    title="Editing"
                />
            )}
        </UserAvatar>
    )
}

function PresenceTooltip({ user }) {
    return (
        <div className="absolute right-0 top-full z-10 mt-1.5 hidden whitespace-nowrap rounded-md border border-border-light bg-bg-primary px-2.5 py-1.5 text-[11.5px] shadow-modal animate-fade-in-fast group-hover:block">
            <div className="font-semibold text-text-primary">
                {user.name}
                {user.isSelf && <span className="ml-1 text-text-tertiary">(You)</span>}
            </div>
            {user.role && <div className="mt-0.5 text-text-secondary">{user.role}</div>}
            <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-text-tertiary">
                <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                        user.editing ? 'bg-status-danger' : 'bg-status-active'
                    }`}
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
    const userIds = useMemo(() => (users || []).map((u) => u.userId), [users])
    const accentByUserId = useUserAccents(userIds)

    if (!users || users.length === 0) return null

    return (
        <div
            className="absolute right-3 top-3 z-30 flex items-center gap-1.5 rounded-full border border-border-light bg-bg-primary/90 px-2 py-1.5 shadow-card backdrop-blur transition-shadow duration-200"
            role="status"
            aria-label={`${users.length} dispatcher${users.length === 1 ? '' : 's'} viewing this plan`}
        >
            <i className="fas fa-user-group text-[10.5px] text-text-tertiary" aria-hidden="true" />
            {visible.map((u) => (
                <div key={u.userId} className="group relative">
                    <PresenceChip user={u} accentColor={accentByUserId[u.userId]} />
                    <PresenceTooltip user={u} />
                </div>
            ))}
            {hidden > 0 && (
                <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    title={`Show ${hidden} more`}
                    aria-label={`Show ${hidden} more dispatchers`}
                    className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-bg-tertiary px-1.5 text-[11px] font-semibold text-text-secondary transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:bg-bg-hover hover:text-text-primary active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
                >
                    +{hidden}
                </button>
            )}
        </div>
    )
}

export default PlanPresenceOverlay
