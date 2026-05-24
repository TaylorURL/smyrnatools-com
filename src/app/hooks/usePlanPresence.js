import { useEffect, useMemo, useRef, useState } from 'react'

import { Database } from '../../services/DatabaseService'
import { UserService } from '../../services/UserService'

/**
 * Planner-scoped realtime presence. Joins a Supabase Realtime Presence
 * channel keyed by `plan-presence:${planDate}` so every dispatcher viewing
 * the same plan date sees a live roster of who else is on the same screen.
 * Purely ephemeral — no `users_presence` writes, no DB churn; the channel
 * itself is the source of truth and join/leave events propagate in under
 * a second.
 *
 * Tracked payload per connection: `{ userId, name, role, editing }`. The
 * `editing` flag mirrors `usePlanData`'s `syncStatus` so the chip can ring
 * red while a teammate is actively pushing a save through the bus.
 *
 * @param {string} planDate    Currently-displayed `YYYY-MM-DD`.
 * @param {Object} args
 * @param {string} args.userId           Logged-in user id (from `usePlanData`).
 * @param {boolean} args.isEditing       True while the local user's autosave is in flight.
 * @returns {{ users: Array<{ userId, name, role, editing, isSelf, presenceKey, joinedAt }> }}
 */
export function usePlanPresence(planDate, { isEditing = false, userId = null } = {}) {
    const [users, setUsers] = useState([])
    const [selfMeta, setSelfMeta] = useState(null)
    const channelRef = useRef(null)
    /** Latest tracked payload — replayed via `.track()` whenever `editing`
     *  flips so other clients see the live ring state. */
    const lastPayloadRef = useRef(null)

    /* Pull display name + primary role for the local user ONCE per
     * session. Other clients receive their own metadata via the channel's
     * track payload, so no extra fetch is needed for them. */
    useEffect(() => {
        if (!userId) {
            setSelfMeta(null)
            return undefined
        }
        let cancelled = false
        ;(async () => {
            try {
                const [name, roles] = await Promise.all([
                    UserService.getUserDisplayName(userId).catch(() => 'You'),
                    UserService.getUserRoles(userId).catch(() => [])
                ])
                if (cancelled) return
                const primaryRole = Array.isArray(roles)
                    ? roles.find((r) => r && (r.name || typeof r === 'string')) || null
                    : null
                const roleName = typeof primaryRole === 'string' ? primaryRole : primaryRole?.name || ''
                setSelfMeta({ name: name || 'You', role: roleName })
            } catch (err) {
                if (!cancelled) {
                    console.error('Failed to load planner presence self meta:', err)
                    setSelfMeta({ name: 'You', role: '' })
                }
            }
        })()
        return () => {
            cancelled = true
        }
    }, [userId])

    /* Subscribe to the planDate-scoped channel. Re-subscribes when the
     * user switches dates so each plan_date has its own roster — no
     * stale chips leaking across days. */
    useEffect(() => {
        if (!planDate || !userId || !selfMeta) return undefined

        const channelName = `plan-presence:${planDate}`
        const channel = Database.channel(channelName, {
            config: {
                presence: { key: userId }
            }
        })
        channelRef.current = channel

        const flattenState = () => {
            const state = channel.presenceState() || {}
            /* `state` is `{ presenceKey: [presence, presence, ...] }` —
             * one inner row per active connection. We dedupe by `userId`
             * so a user with multiple tabs open shows once, taking the
             * most-recently-joined entry as the source for `editing`. */
            const byUser = new Map()
            Object.entries(state).forEach(([key, presences]) => {
                (presences || []).forEach((p) => {
                    const id = p?.userId
                    if (!id) return
                    const joinedAt = p?.joinedAt || ''
                    const existing = byUser.get(id)
                    if (!existing || joinedAt > existing.joinedAt) {
                        byUser.set(id, {
                            editing: !!p.editing,
                            isSelf: id === userId,
                            joinedAt,
                            name: p.name || 'Unknown',
                            presenceKey: key,
                            role: p.role || '',
                            userId: id
                        })
                    }
                })
            })
            const list = Array.from(byUser.values()).sort((a, b) => {
                if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1
                return String(a.name).localeCompare(String(b.name))
            })
            setUsers(list)
        }

        channel
            .on('presence', { event: 'sync' }, flattenState)
            .on('presence', { event: 'join' }, flattenState)
            .on('presence', { event: 'leave' }, flattenState)
            .subscribe(async (status) => {
                if (status !== 'SUBSCRIBED') return
                const payload = {
                    editing: !!isEditing,
                    joinedAt: new Date().toISOString(),
                    name: selfMeta.name,
                    role: selfMeta.role,
                    userId
                }
                lastPayloadRef.current = payload
                try {
                    await channel.track(payload)
                } catch (err) {
                    console.error('Failed to track planner presence:', err)
                }
            })

        return () => {
            try {
                channel.untrack().catch(() => {})
                Database.removeChannel(channel)
            } catch (err) {
                console.error('Failed to remove planner presence channel:', err)
            }
            channelRef.current = null
            lastPayloadRef.current = null
            setUsers([])
        }
        /* eslint-disable-next-line react-hooks/exhaustive-deps */
    }, [planDate, userId, selfMeta?.name, selfMeta?.role])

    /* Re-track when the editing flag changes so other clients see the
     * ring flip in roughly heartbeat-time without us having to re-join
     * the channel. */
    useEffect(() => {
        const channel = channelRef.current
        const last = lastPayloadRef.current
        if (!channel || !last) return
        if (last.editing === !!isEditing) return
        const next = { ...last, editing: !!isEditing }
        lastPayloadRef.current = next
        channel.track(next).catch((err) => console.error('Failed to retrack editing state:', err))
    }, [isEditing])

    return useMemo(() => ({ users }), [users])
}

export default usePlanPresence
