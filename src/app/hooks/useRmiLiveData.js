import { useCallback, useEffect, useMemo, useState } from 'react'

import { OperatorService } from '../../services/OperatorService'

const MIXER = 'Mixer Operator'
const TRACTOR = 'Tractor Operator'

/**
 * Live-operator state + accuracy checks for the Ready Mix Instructor
 * submit form. Loads region-scoped operators on mount (re-runs when the
 * region scope changes) and exposes per-category accuracy flags so the
 * "Pull" buttons know when the snapshot already matches reality.
 */
export function useRmiLiveData({ isInRegion, regionPlantCodes, snapshotData }) {
    const [liveOperators, setLiveOperators] = useState([])
    const [isLoading, setIsLoading] = useState(false)

    const loadLiveData = useCallback(async () => {
        setIsLoading(true)
        try {
            const scope = regionPlantCodes.size > 0 ? regionPlantCodes : null
            const ops = await OperatorService.fetchOperators(scope)
            // Defensive — fetchOperators filters when given a scope, but
            // enforce again here so a future change in OperatorService
            // can't quietly widen the scope. Skip the post-filter when we
            // have no resolved region (otherwise everything would be
            // dropped — preserving the pre-region-resolution behaviour).
            setLiveOperators(scope ? (ops || []).filter(isInRegion) : ops || [])
        } catch (error) {
            console.error('Failed to load operators:', error)
            alert('Failed to load live data')
        } finally {
            setIsLoading(false)
        }
    }, [regionPlantCodes, isInRegion])

    useEffect(() => {
        loadLiveData()
    }, [loadLiveData])

    const mixerTrainers = snapshotData.mixer_trainers || []
    const tractorTrainers = snapshotData.tractor_trainers || []
    const mixerPending = snapshotData.mixer_pending || []
    const tractorPending = snapshotData.tractor_pending || []
    const mixerTraining = snapshotData.mixer_training || []
    const tractorTraining = snapshotData.tractor_training || []

    const buildAccuracyCheck = (snapshot, livePredicate) => {
        if (!liveOperators.length || snapshot.length === 0) return false
        const liveMatches = liveOperators.filter(livePredicate)
        if (snapshot.length !== liveMatches.length) return false
        const snapshotIds = new Set(snapshot.map((s) => s.id))
        return liveMatches.every((op) => snapshotIds.has(op.employeeId))
    }

    const isMixerTrainersAccurate = useMemo(
        () =>
            buildAccuracyCheck(
                mixerTrainers,
                (op) => op.isTrainer && op.status !== 'Terminated' && op.position === MIXER
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [liveOperators, mixerTrainers]
    )
    const isTractorTrainersAccurate = useMemo(
        () =>
            buildAccuracyCheck(
                tractorTrainers,
                (op) => op.isTrainer && op.status !== 'Terminated' && op.position === TRACTOR
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [liveOperators, tractorTrainers]
    )
    const isMixerPendingAccurate = useMemo(
        () =>
            buildAccuracyCheck(
                mixerPending,
                (op) =>
                    op.status === 'Pending Start' &&
                    op.pendingStartDate &&
                    op.pendingStartDate.trim() !== '' &&
                    op.position === MIXER
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [liveOperators, mixerPending]
    )
    const isTractorPendingAccurate = useMemo(
        () =>
            buildAccuracyCheck(
                tractorPending,
                (op) =>
                    op.status === 'Pending Start' &&
                    op.pendingStartDate &&
                    op.pendingStartDate.trim() !== '' &&
                    op.position === TRACTOR
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [liveOperators, tractorPending]
    )
    const isMixerTrainingAccurate = useMemo(
        () => buildAccuracyCheck(mixerTraining, (op) => op.status === 'Training' && op.position === MIXER),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [liveOperators, mixerTraining]
    )
    const isTractorTrainingAccurate = useMemo(
        () => buildAccuracyCheck(tractorTraining, (op) => op.status === 'Training' && op.position === TRACTOR),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [liveOperators, tractorTraining]
    )

    return {
        accuracy: {
            mixerPending: isMixerPendingAccurate,
            mixerTrainers: isMixerTrainersAccurate,
            mixerTraining: isMixerTrainingAccurate,
            tractorPending: isTractorPendingAccurate,
            tractorTrainers: isTractorTrainersAccurate,
            tractorTraining: isTractorTrainingAccurate
        },
        isLoading,
        liveOperators,
        loadLiveData
    }
}
