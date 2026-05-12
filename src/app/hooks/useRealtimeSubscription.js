import { useCallback, useEffect, useRef } from 'react'

import { Database } from '../../services/DatabaseService'

const activeChannels = new Map()
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
        enabled = true,
        debounceMs = 100
    } = config
    const debounceTimerRef = useRef(null)
    const pendingChangesRef = useRef([])
    const callbacksRef = useRef({ onChange, onDelete, onInsert, onUpdate })
    callbacksRef.current = { onChange, onDelete, onInsert, onUpdate }
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
                }
            })
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
            activeChannels.delete(channelName)
            Database.removeChannel(channel)
        }
    }, [table, event, filter, enabled, handleChange])
}
export default useRealtimeSubscription
