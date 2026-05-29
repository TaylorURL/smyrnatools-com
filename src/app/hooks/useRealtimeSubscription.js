import { useCallback, useEffect, useRef, useState } from 'react'

import { Database } from '../../services/DatabaseService'

const activeChannels = new Map()
/** Backoff before forcing a fresh channel after a CHANNEL_ERROR / TIMED_OUT /
 *  CLOSED status. The realtime socket auto-rejoins on reconnect, but a
 *  terminally closed channel never recovers on its own — recreate it so the
 *  subscriber keeps receiving changes instead of going silently stale. */
const REALTIME_RESUBSCRIBE_BACKOFF_MS = 2000
/**
 * database realtime subscription hook with debounced change processing.
 * Handles INSERT, UPDATE, DELETE events with per-event-type callbacks.
 */
export function useRealtimeSubscription(config) {
    const {
        table,
        event = '*',
        filter = null,
        onInsert,
        onUpdate,
        onDelete,
        onChange,
        onStatus,
        enabled = true,
        debounceMs = 100
    } = config
    const debounceTimerRef = useRef(null)
    const pendingChangesRef = useRef([])
    const callbacksRef = useRef({ onChange, onDelete, onInsert, onUpdate })
    callbacksRef.current = { onChange, onDelete, onInsert, onUpdate }
    const statusRef = useRef(onStatus)
    statusRef.current = onStatus
    /** Distinguishes the first successful subscribe (initial mount — the
     *  consumer already loaded fresh data itself) from a later re-subscribe
     *  after a drop (the consumer MUST refetch because realtime never replays
     *  events missed while the socket was down). A ref so it survives the
     *  effect re-running on resubscribe. */
    const hasSubscribedRef = useRef(false)
    const retryTimerRef = useRef(null)
    /** Bumped to tear down a dead channel and create a fresh one. */
    const [resubscribeNonce, setResubscribeNonce] = useState(0)
    const processChanges = useCallback(() => {
        if (pendingChangesRef.current.length === 0) return
        const changes = [...pendingChangesRef.current]
        pendingChangesRef.current = []
        const {
            onChange: _onChange,
            onInsert: _onInsert,
            onUpdate: _onUpdate,
            onDelete: _onDelete
        } = callbacksRef.current
        changes.forEach((payload) => {
            const { eventType, new: newRecord, old: oldRecord } = payload
            if (_onChange) {
                _onChange(payload)
            }
            switch (eventType) {
                case 'INSERT':
                    if (_onInsert) _onInsert(newRecord, payload)
                    break
                case 'UPDATE':
                    if (_onUpdate) _onUpdate(newRecord, oldRecord, payload)
                    break
                case 'DELETE':
                    if (_onDelete) _onDelete(oldRecord, payload)
                    break
                default:
                    break
            }
        })
    }, [])
    const handleChange = useCallback(
        (payload) => {
            pendingChangesRef.current.push(payload)
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
            debounceTimerRef.current = setTimeout(() => {
                processChanges()
            }, debounceMs)
        },
        [processChanges, debounceMs]
    )
    useEffect(() => {
        if (!enabled || !table) return
        const channelName = `realtime-${table}-${filter || 'all'}-${Date.now()}`
        const subscriptionConfig = {
            event,
            schema: 'public',
            table
        }
        if (filter) {
            subscriptionConfig.filter = filter
        }
        const channel = Database.channel(channelName)
            .on('postgres_changes', subscriptionConfig, handleChange)
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    activeChannels.set(channelName, channel)
                    const isResubscribe = hasSubscribedRef.current
                    hasSubscribedRef.current = true
                    statusRef.current?.(status, { isResubscribe })
                    return
                }
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    statusRef.current?.(status, { isResubscribe: false })
                    // Coalesce repeated error statuses into a single recreate so
                    // we don't spin up channels in a tight loop.
                    if (!retryTimerRef.current) {
                        retryTimerRef.current = setTimeout(() => {
                            retryTimerRef.current = null
                            setResubscribeNonce((n) => n + 1)
                        }, REALTIME_RESUBSCRIBE_BACKOFF_MS)
                    }
                }
            })
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current)
                retryTimerRef.current = null
            }
            activeChannels.delete(channelName)
            Database.removeChannel(channel)
        }
    }, [table, event, filter, enabled, handleChange, resubscribeNonce])
}
export default useRealtimeSubscription
