import { useCallback, useRef } from 'react'

import { hasMeaningfulAssignments } from '../../utils/PlanDataUtility'
import { createEmptyAssignment, ensureUniqueIds } from '../../utils/PlanUtility'
import { PLAN_META_KEY } from '../constants/planConstants'
import { useRealtimeSubscription } from './useRealtimeSubscription'

/**
 * Subscribes to remote `plans` row updates for the current `planDate` and
 * applies ONLY the fields a collaborator actually changed.
 *
 * Why field-level: the schedule auto-sync (`useScheduleSync`) rewrites the
 * whole `plans` row on every client roughly every 30s as fresh `dispatch_data`
 * lands. Those saves leave `assignments` (routes) and `plant_production._meta`
 * (Saturday overrides / missing-operator counts) untouched — only the machine
 * schedule changes. The previous implementation applied incoming rows
 * wholesale, so every one of those routine schedule saves clobbered a
 * collaborator's in-progress routes and Saturday counts "for no reason."
 *
 * The `plans` table publishes with REPLICA IDENTITY FULL, so `payload.old`
 * carries the previous row. We diff new-vs-old per field and apply only what
 * genuinely changed:
 *   - `assignments` changed → apply (real route edit), unless it's an empty
 *     list arriving over live local routes (preserved, as before).
 *   - `_meta` changed → apply the human overrides, keeping the LOCAL
 *     machine-synced schedule (every client syncs that from `dispatch_data`
 *     itself, so we never need — or want — a peer's possibly-staler schedule).
 *   - `notes` changed → apply.
 * A schedule-only save changes none of these → we skip it entirely.
 *
 * `dirtyRef` (shared with the autosave loop) short-circuits the whole apply
 * while the local user has an unsaved edit in flight, so a peer's broadcast
 * can never revert what the dispatcher is mid-typing. Their pending save
 * flushes and the next event reconciles.
 *
 * `lastSyncedSnapshotRef` still suppresses our own write echoing back.
 */
export function usePlanRealtimeSync({
    assignments,
    dirtyRef,
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
    const dirtyRefRef = useRef(dirtyRef)
    dirtyRefRef.current = dirtyRef

    useRealtimeSubscription({
        enabled: !isLoading,
        onChange: useCallback(
            (payload) => {
                const record = payload.new
                if (!record || record.plan_date !== planDateRef.current) return

                // Never disturb the local user's unsaved, in-flight edits — their
                // pending autosave will flush and the next event reconciles.
                if (dirtyRefRef.current?.current) return

                const incomingHasAssignments = !!record.assignments?.length
                const incomingAssignments = incomingHasAssignments
                    ? ensureUniqueIds(record.assignments)
                    : [createEmptyAssignment()]
                const incomingNotes = record.notes || ''
                const incomingProduction = record.plant_production || {}

                // Our own write echoing back — skip (the autosave stamped this).
                const incomingSnapshot = JSON.stringify({
                    assignments: incomingAssignments,
                    notes: incomingNotes,
                    plantProduction: incomingProduction
                })
                if (incomingSnapshot === lastSyncedSnapshotRef.current) return

                // Field-level change detection against the previous row (REPLICA
                // IDENTITY FULL). When `old` is absent (INSERT, or an env without
                // full replica identity) every field is treated as changed so we
                // fall back to the prior whole-row apply.
                const prev = payload.old && typeof payload.old === 'object' ? payload.old : null
                const assignmentsChanged = prev
                    ? JSON.stringify(record.assignments ?? null) !== JSON.stringify(prev.assignments ?? null)
                    : true
                const notesChanged = prev ? incomingNotes !== (prev.notes || '') : true
                const incomingMeta = incomingProduction[PLAN_META_KEY] ?? null
                const metaChanged = prev
                    ? JSON.stringify(incomingMeta) !== JSON.stringify(prev.plant_production?.[PLAN_META_KEY] ?? null)
                    : true

                const localAssignments = assignmentsRef.current || []
                const localHasMeaningfulAssignments =
                    localAssignments.length > 1 || hasMeaningfulAssignments(localAssignments)
                // Never let an empty incoming list wipe live local routes.
                const applyAssignments =
                    assignmentsChanged && (incomingHasAssignments || !localHasMeaningfulAssignments)

                if (!applyAssignments && !notesChanged && !metaChanged) return

                // Resolve the exact state we're about to commit so the snapshot we
                // stamp matches it — keeping the LOCAL schedule, swapping in the
                // remote `_meta` only when it changed.
                const finalAssignments = applyAssignments ? incomingAssignments : localAssignments
                const finalNotes = notesChanged ? incomingNotes : notesRef.current
                const localProduction = plantProductionRef.current || {}
                let finalProduction = localProduction
                if (metaChanged) {
                    if (incomingMeta == null) {
                        const { [PLAN_META_KEY]: _removed, ...rest } = localProduction
                        finalProduction = rest
                    } else {
                        finalProduction = { ...localProduction, [PLAN_META_KEY]: incomingMeta }
                    }
                }

                // Stamp BEFORE setState so the autosave effect these trigger sees
                // "nothing changed" and doesn't re-save what we just received.
                lastSyncedSnapshotRef.current = JSON.stringify({
                    assignments: finalAssignments,
                    notes: finalNotes,
                    plantProduction: finalProduction
                })

                if (applyAssignments && JSON.stringify(finalAssignments) !== JSON.stringify(localAssignments)) {
                    setAssignments(finalAssignments)
                }
                if (notesChanged && finalNotes !== notesRef.current) {
                    setNotes(finalNotes)
                }
                if (metaChanged) {
                    setPlantProduction(finalProduction)
                }
                setSyncStatus('saved')
            },
            [dirtyRefRef, lastSyncedSnapshotRef, setAssignments, setNotes, setPlantProduction, setSyncStatus]
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
