import { useEffect, useMemo, useRef, useState } from 'react'

import { Database } from '../../services/DatabaseService'
import { UserService } from '../../services/UserService'

/**
 * Per-customer realtime presence for the CRM detail view. Joins a
 * Supabase Realtime Presence channel keyed by
 * `call-list-customer:${customerNum}` so every dispatcher viewing the
 * same customer detail sees a live roster of who else is on it.
 *
 * Designed for one specific problem: stopping the team from
 * double-calling the same customer. When two dispatchers open the same
 * customer's detail page, both see a warning chip with the other's
 * name within the channel's join window (~300ms in practice). When one
 * leaves the detail (navigates away, closes the tab, signs out), the
 * channel's `leave` event fires and the chip disappears on the other
 * client.
 *
 * Modelled on `usePlanPresence` — ephemeral channel, no DB writes, no
 * heartbeats. The channel itself is the source of truth; leaving
 * cleans up automatically.
 *
 * @param {string} customerNum  Customer number currently in detail view.
 * @param {Object} args
 * @param {string|null} args.userId  Logged-in user id. Hook is a no-op while null.
 * @returns {{ users: Array<{ userId, name, role, isSelf, joinedAt }> }}
 */
export function useCrmCustomerPresence(customerNum, { userId = null } = {}) {
    const [users, setUsers] = useState([])
    const [selfMeta, setSelfMeta] = useState(null)
    const channelRef = useRef(null)

    /* Resolve the local user's display name + primary role once per
     * session. Other clients get their own metadata through the channel,
     * so no extra fetches are needed for them. */
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
                    console.error('Failed to load call-list presence self meta:', err)
                    setSelfMeta({ name: 'You', role: '' })
                }
            }
        })()
        return () => {
            cancelled = true
        }
    }, [userId])

    /* Subscribe to the customer-scoped channel. Re-subscribes when the
     * dispatcher opens a different customer so each customer has its
     * own roster — no stale chips leaking between customers. */
    useEffect(() => {
        if (!customerNum || !userId || !selfMeta) return undefined

        const channelName = `call-list-customer:${customerNum}`
        const channel = Database.channel(channelName, {
            config: {
                presence: { key: userId }
            }
        })
        channelRef.current = channel

        const flattenState = () => {
            const state = channel.presenceState() || {}
            /* `state` is `{ presenceKey: [presence, ...] }`. Dedupe by
             * `userId` so a single user with multiple tabs counts once;
             * keep the most-recently-joined entry as the canonical row. */
            const byUser = new Map()
            Object.entries(state).forEach(([, presences]) => {
                const list = presences || []
                list.forEach((p) => {
                    const id = p?.userId
                    if (!id) return
                    const joinedAt = p?.joinedAt || ''
                    const existing = byUser.get(id)
                    if (!existing || joinedAt > existing.joinedAt) {
                        byUser.set(id, {
                            isSelf: id === userId,
                            joinedAt,
                            name: p.name || 'Unknown',
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
                try {
                    await channel.track({
                        joinedAt: new Date().toISOString(),
                        name: selfMeta.name,
                        role: selfMeta.role,
                        userId
                    })
                } catch (err) {
                    console.error('Failed to track call-list presence:', err)
                }
            })

        return () => {
            try {
                channel.untrack().catch(() => {})
                Database.removeChannel(channel)
            } catch (err) {
                console.error('Failed to remove call-list presence channel:', err)
            }
            channelRef.current = null
            setUsers([])
        }
        /* eslint-disable-next-line react-hooks/exhaustive-deps */
    }, [customerNum, userId, selfMeta?.name, selfMeta?.role])

    return useMemo(() => ({ users }), [users])
}

export default useCrmCustomerPresence
