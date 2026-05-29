import { useCallback, useRef } from 'react'

import { hasMeaningfulAssignments } from '../../utils/PlanDataUtility'
import { createEmptyAssignment, ensureUniqueIds } from '../../utils/PlanUtility'
import { useRealtimeSubscription } from './useRealtimeSubscription'

/**
 * Subscribes to remote `plans` row updates for the current `planDate`
 * and applies them to local state with two-way echo suppression.
 *
 * `lastSyncedSnapshotRef` is shared with the autosave loop in
 * `usePlanData`: incoming payloads whose stringified snapshot matches
 * the ref are our own write echoing back and get skipped. We also
 * stamp the snapshot BEFORE applying remote state so the autosave
 * effect that fires from the resulting `setState` calls short-circuits
 * instead of immediately re-saving what we just received.
 *
 * A null / missing / empty `assignments` column on the incoming row is
 * treated as suspect when the local user has live routes — applying it
 * would wipe the planner's map for a second or two before the next
 * legitimate save corrected state. We skip those payloads and preserve
 * local state instead.
 */
export function usePlanRealtimeSync({
    assignments,
    isLoading,
    lastSyncedSnapshotRef,
    notes,
    onResync,
    planDate,
    plantProduction,
    setAssignments,
    setNotes,
    setPlantProduction,
    setSyncStatus
}) {
    const planDateRef = useRef(planDate)
    planDateRef.current = planDate
    const assignmentsRef = useRef(assignments)
    assignmentsRef.current = assignments
    const notesRef = useRef(notes)
    notesRef.current = notes
    const plantProductionRef = useRef(plantProduction)
    plantProductionRef.current = plantProduction
    const onResyncRef = useRef(onResync)
    onResyncRef.current = onResync

    useRealtimeSubscription({
        enabled: !isLoading,
        onChange: useCallback(
            (payload) => {
                const record = payload.new
                if (!record || record.plan_date !== planDateRef.current) return

                const localAssignments = assignmentsRef.current || []
                const localHasMeaningfulAssignments =
                    localAssignments.length > 1 || hasMeaningfulAssignments(localAssignments)
                const incomingHasAssignments = !!record.assignments?.length
                if (!incomingHasAssignments && localHasMeaningfulAssignments) {
                    console.warn(
                        '[usePlanData] Skipping realtime apply: incoming `assignments` was empty / null while local plan has live routes. Preserving local state.'
                    )
                    return
                }

                const incomingAssignments = incomingHasAssignments
                    ? ensureUniqueIds(record.assignments)
                    : [createEmptyAssignment()]
                const incomingNotes = record.notes || ''
                const incomingProduction = record.plant_production || {}
                const incomingSnapshot = JSON.stringify({
                    assignments: incomingAssignments,
                    notes: incomingNotes,
                    plantProduction: incomingProduction
                })

                if (incomingSnapshot === lastSyncedSnapshotRef.current) return

                lastSyncedSnapshotRef.current = incomingSnapshot
                if (JSON.stringify(incomingAssignments) !== JSON.stringify(assignmentsRef.current)) {
                    setAssignments(incomingAssignments)
                }
                if (incomingNotes !== notesRef.current) {
                    setNotes(incomingNotes)
                }
                if (JSON.stringify(incomingProduction) !== JSON.stringify(plantProductionRef.current)) {
                    setPlantProduction(incomingProduction)
                }
                setSyncStatus('saved')
            },
            [lastSyncedSnapshotRef, setAssignments, setNotes, setPlantProduction, setSyncStatus]
        ),
        onStatus: useCallback((status, info) => {
            /* A re-subscribe means the socket dropped and rejoined. Realtime
             * doesn't replay events missed during the gap, so pull the
             * authoritative plan to catch up. The first SUBSCRIBED (initial
             * mount) is skipped — usePlanData already loaded fresh data. */
            if (status === 'SUBSCRIBED' && info?.isResubscribe) onResyncRef.current?.()
        }, []),
        table: 'plans'
    })
}
