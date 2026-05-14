import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import PlantDropdownModal from '../../../../app/components/common/PlantDropdownModal'
import RmiAddPendingModal from '../../../../app/components/reports/granular/RmiAddPendingModal'
import RmiAddTrainerModal from '../../../../app/components/reports/granular/RmiAddTrainerModal'
import { ActionChip } from '../../../../app/components/reports/granular/RmiAtoms'
import {
    HiringGoalsSection,
    PendingSection,
    TerminatedSection,
    TrainersSection,
    TrainingSection
} from '../../../../app/components/reports/granular/RmiSections'
import { POSITIONS } from '../../../../app/constants/rmiReportConstants'
import { useRmiLiveData } from '../../../../app/hooks/useRmiLiveData'
import { useRmiRegionScope } from '../../../../app/hooks/useRmiRegionScope'
import { OperatorService } from '../../../../services/OperatorService'

/* ── Submit-mode plugin ─────────────────────────────────────────────────── */

export function ReadyMixInstructorSubmitPlugin({ form, plants, readOnly, setForm, userId, userPlantCode, weekIso }) {
    const [showAddTrainerModal, setShowAddTrainerModal] = useState(false)
    const [showAddPendingModal, setShowAddPendingModal] = useState(false)
    const [showPlantModal, setShowPlantModal] = useState(false)
    const [plantModalTarget, setPlantModalTarget] = useState(null)
    const [newTrainer, setNewTrainer] = useState({ plant: '', position: POSITIONS.MIXER, trainerId: '' })
    const [newPending, setNewPending] = useState({
        name: '',
        plant: '',
        position: POSITIONS.MIXER,
        startDate: '',
        trainer: ''
    })

    const snapshotData = useMemo(() => form?.snapshot_data || {}, [form])
    const mixerTrainers = useMemo(() => snapshotData.mixer_trainers || [], [snapshotData])
    const tractorTrainers = useMemo(() => snapshotData.tractor_trainers || [], [snapshotData])
    const mixerPending = useMemo(() => snapshotData.mixer_pending || [], [snapshotData])
    const tractorPending = useMemo(() => snapshotData.tractor_pending || [], [snapshotData])
    const mixerTraining = useMemo(() => snapshotData.mixer_training || [], [snapshotData])
    const tractorTraining = useMemo(() => snapshotData.tractor_training || [], [snapshotData])
    const hiringGoals = form?.hiring_goals || {}

    const { isInRegion, regionPlantCodes, regionalPlants, resolvedRegionCodes } = useRmiRegionScope({
        plants,
        useCurrentUser: true,
        userId,
        userPlantCode
    })

    /** One-time cleanup for legacy snapshots: when the resolved region first
     *  becomes known, strip any rows / hiring-goal entries that belong to
     *  plants outside that region. Skipped in read-only / review contexts so
     *  we don't silently mutate forms the user can't save. */
    const sanitizedRef = useRef(false)
    useEffect(() => {
        if (readOnly) return
        if (sanitizedRef.current) return
        if (!resolvedRegionCodes || resolvedRegionCodes.size === 0) return
        const inRegion = (code) =>
            resolvedRegionCodes.has(
                String(code || '')
                    .trim()
                    .toUpperCase()
            )
        sanitizedRef.current = true
        setForm((prev) => {
            if (!prev) return prev
            const snapshot = prev.snapshot_data || {}
            const filterRows = (rows) => (Array.isArray(rows) ? rows.filter((r) => inRegion(r?.plant)) : rows)
            const nextSnapshot = {
                ...snapshot,
                mixer_pending: filterRows(snapshot.mixer_pending),
                mixer_trainers: filterRows(snapshot.mixer_trainers),
                mixer_training: filterRows(snapshot.mixer_training),
                terminated_operators: filterRows(snapshot.terminated_operators),
                tractor_pending: filterRows(snapshot.tractor_pending),
                tractor_trainers: filterRows(snapshot.tractor_trainers),
                tractor_training: filterRows(snapshot.tractor_training)
            }
            const nextGoals = {}
            Object.entries(prev.hiring_goals || {}).forEach(([code, goal]) => {
                if (inRegion(code)) nextGoals[code] = goal
            })
            return { ...prev, hiring_goals: nextGoals, snapshot_data: nextSnapshot }
        })
    }, [resolvedRegionCodes, readOnly, setForm])

    const { accuracy, isLoading, liveOperators } = useRmiLiveData({ isInRegion, regionPlantCodes, snapshotData })

    /** Operators moved to Terminated during the report week, scoped to this
     *  region. Recomputed whenever the live feed or week changes. */
    const terminatedThisWeek = useMemo(() => {
        if (!liveOperators.length || !weekIso) return []
        const weekStart = new Date(weekIso)
        weekStart.setDate(weekStart.getDate() + 1)
        weekStart.setHours(0, 0, 0, 0)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 7)
        return liveOperators
            .filter((op) => {
                if (!isInRegion(op)) return false
                if (op.status !== 'Terminated' || !op.statusChangedAt) return false
                const changedAt = new Date(op.statusChangedAt)
                return changedAt >= weekStart && changedAt < weekEnd
            })
            .map((op) => ({ id: op.employeeId, name: op.name, plant: op.plantCode, position: op.position }))
    }, [liveOperators, weekIso, isInRegion])

    const updateSnapshotData = useCallback(
        (key, value) => {
            setForm((prev) => ({ ...prev, snapshot_data: { ...prev.snapshot_data, [key]: value } }))
        },
        [setForm]
    )

    const buildPullFn = (key, livePredicate, mapRow) => () => {
        if (!liveOperators.length) {
            alert('Please load live data first')
            return
        }
        const matches = liveOperators.filter((op) => isInRegion(op) && livePredicate(op))
        updateSnapshotData(key, matches.map(mapRow))
    }

    const mapTrainer = (op) => ({ id: op.employeeId, name: op.name, plant: op.plantCode, status: op.status })
    const mapPending = (op) => ({
        id: op.employeeId,
        name: op.name,
        plant: op.plantCode,
        startDate: op.pendingStartDate,
        trainer: op.assignedTrainer
    })
    const mapTraining = (op) => {
        const t = liveOperators.find((x) => x.employeeId === op.assignedTrainer)
        return {
            id: op.employeeId,
            name: op.name,
            plant: op.plantCode,
            trainer: t?.name || op.assignedTrainer || '—',
            trainingSince: op.statusChangedAt || null
        }
    }

    const pullMixerTrainers = buildPullFn(
        'mixer_trainers',
        (op) => op.isTrainer && op.status !== 'Terminated' && op.position === POSITIONS.MIXER,
        mapTrainer
    )
    const pullTractorTrainers = buildPullFn(
        'tractor_trainers',
        (op) => op.isTrainer && op.status !== 'Terminated' && op.position === POSITIONS.TRACTOR,
        mapTrainer
    )
    const pullMixerPending = buildPullFn(
        'mixer_pending',
        (op) => op.status === 'Pending Start' && op.pendingStartDate?.trim() && op.position === POSITIONS.MIXER,
        mapPending
    )
    const pullTractorPending = buildPullFn(
        'tractor_pending',
        (op) => op.status === 'Pending Start' && op.pendingStartDate?.trim() && op.position === POSITIONS.TRACTOR,
        mapPending
    )
    const pullMixerTraining = buildPullFn(
        'mixer_training',
        (op) => op.status === 'Training' && op.position === POSITIONS.MIXER,
        mapTraining
    )
    const pullTractorTraining = buildPullFn(
        'tractor_training',
        (op) => op.status === 'Training' && op.position === POSITIONS.TRACTOR,
        mapTraining
    )

    const buildRemoveFn = (mixerKey, tractorKey) => (position, id) => {
        const key = position === POSITIONS.MIXER ? mixerKey : tractorKey
        updateSnapshotData(
            key,
            (snapshotData[key] || []).filter((t) => t.id !== id)
        )
    }
    const removeTrainer = buildRemoveFn('mixer_trainers', 'tractor_trainers')
    const removePending = buildRemoveFn('mixer_pending', 'tractor_pending')
    const removeTraining = buildRemoveFn('mixer_training', 'tractor_training')

    const clearData = (key) => {
        if (!confirm(`Are you sure you want to clear all ${key.replace(/_/g, ' ')} data?`)) return
        updateSnapshotData(key, [])
    }

    const addTrainer = () => {
        if (!newTrainer.trainerId || !newTrainer.plant) {
            alert('Please select a trainer and plant')
            return
        }
        const selectedOperator = liveOperators.find((op) => op.employeeId === newTrainer.trainerId)
        if (!selectedOperator) {
            alert('Selected trainer not found')
            return
        }
        const key = newTrainer.position === POSITIONS.MIXER ? 'mixer_trainers' : 'tractor_trainers'
        const trainer = {
            id: selectedOperator.employeeId,
            name: selectedOperator.name,
            plant: newTrainer.plant,
            status: selectedOperator.status || 'Active'
        }
        updateSnapshotData(key, [...(snapshotData[key] || []), trainer])
        setNewTrainer({ plant: '', position: POSITIONS.MIXER, trainerId: '' })
        setShowAddTrainerModal(false)
    }
    const addPending = () => {
        if (!newPending.name || !newPending.plant || !newPending.startDate) {
            alert('Please fill in all required fields')
            return
        }
        const key = newPending.position === POSITIONS.MIXER ? 'mixer_pending' : 'tractor_pending'
        const pending = {
            id: `manual-${Date.now()}`,
            name: newPending.name,
            plant: newPending.plant,
            startDate: newPending.startDate,
            trainer: newPending.trainer
        }
        updateSnapshotData(key, [...(snapshotData[key] || []), pending])
        setNewPending({ name: '', plant: '', position: POSITIONS.MIXER, startDate: '', trainer: '' })
        setShowAddPendingModal(false)
    }

    const availableTrainers = liveOperators.filter(
        (op) => op.isTrainer && op.status !== 'Terminated' && op.position === newTrainer.position
    )

    const handleHiringGoalChange = (plantCode, value) => {
        if (setForm)
            setForm((prev) => ({ ...prev, hiring_goals: { ...(prev.hiring_goals || {}), [plantCode]: value } }))
    }

    /* Sync terminated-this-week from the live feed into the snapshot — keeps
     * the read-only Terminated section accurate across refreshes. */
    useEffect(() => {
        if (readOnly || !terminatedThisWeek.length) return
        const existing = snapshotData.terminated_operators
        const unchanged =
            Array.isArray(existing) &&
            existing.length === terminatedThisWeek.length &&
            terminatedThisWeek.every((op, i) => existing[i]?.id === op.id)
        if (!unchanged) updateSnapshotData('terminated_operators', terminatedThisWeek)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [terminatedThisWeek, readOnly])

    const makeActions = (pullFn, addFn, clearFn, isAccurate, dataLength) => (
        <>
            <ActionChip
                icon="fa-sync-alt"
                onClick={pullFn}
                disabled={isLoading || readOnly || isAccurate}
                title={isAccurate ? 'Data is up to date' : 'Pull live data'}
            >
                Pull
            </ActionChip>
            <ActionChip icon="fa-plus" accent="#0369a1" onClick={addFn} disabled={readOnly} title="Add">
                Add
            </ActionChip>
            <ActionChip
                icon="fa-trash-alt"
                accent="#b91c1c"
                onClick={clearFn}
                disabled={readOnly || dataLength === 0}
                title="Clear all"
            >
                Clear
            </ActionChip>
        </>
    )

    const trainerActions = {
        mixer: makeActions(
            pullMixerTrainers,
            () => {
                setNewTrainer({ plant: '', position: POSITIONS.MIXER, trainerId: '' })
                setShowAddTrainerModal(true)
            },
            () => clearData('mixer_trainers'),
            accuracy.mixerTrainers,
            mixerTrainers.length
        ),
        tractor: makeActions(
            pullTractorTrainers,
            () => {
                setNewTrainer({ plant: '', position: POSITIONS.TRACTOR, trainerId: '' })
                setShowAddTrainerModal(true)
            },
            () => clearData('tractor_trainers'),
            accuracy.tractorTrainers,
            tractorTrainers.length
        )
    }
    const pendingActions = {
        mixer: makeActions(
            pullMixerPending,
            () => {
                setNewPending({ name: '', plant: '', position: POSITIONS.MIXER, startDate: '', trainer: '' })
                setShowAddPendingModal(true)
            },
            () => clearData('mixer_pending'),
            accuracy.mixerPending,
            mixerPending.length
        ),
        tractor: makeActions(
            pullTractorPending,
            () => {
                setNewPending({ name: '', plant: '', position: POSITIONS.TRACTOR, startDate: '', trainer: '' })
                setShowAddPendingModal(true)
            },
            () => clearData('tractor_pending'),
            accuracy.tractorPending,
            tractorPending.length
        )
    }
    const trainingActions = {
        mixer: makeActions(
            pullMixerTraining,
            () => {
                setNewPending({ name: '', plant: '', position: POSITIONS.MIXER, startDate: '', trainer: '' })
                setShowAddPendingModal(true)
            },
            () => clearData('mixer_training'),
            accuracy.mixerTraining,
            mixerTraining.length
        ),
        tractor: makeActions(
            pullTractorTraining,
            () => {
                setNewPending({ name: '', plant: '', position: POSITIONS.TRACTOR, startDate: '', trainer: '' })
                setShowAddPendingModal(true)
            },
            () => clearData('tractor_training'),
            accuracy.tractorTraining,
            tractorTraining.length
        )
    }

    return (
        <div className="flex flex-col gap-2.5 mt-2.5">
            <TrainersSection
                mixerTrainers={mixerTrainers}
                tractorTrainers={tractorTrainers}
                plants={plants}
                readOnly={readOnly}
                onRemove={removeTrainer}
                actions={trainerActions}
            />
            <PendingSection
                mixerPending={mixerPending}
                tractorPending={tractorPending}
                plants={plants}
                readOnly={readOnly}
                onRemove={removePending}
                actions={pendingActions}
            />
            <TrainingSection
                mixerTraining={mixerTraining}
                tractorTraining={tractorTraining}
                plants={plants}
                readOnly={readOnly}
                onRemove={removeTraining}
                actions={trainingActions}
                weekIso={weekIso}
            />
            <TerminatedSection terminatedOperators={terminatedThisWeek} plants={plants} />
            <HiringGoalsSection
                plants={regionalPlants}
                hiringGoals={hiringGoals}
                onChange={handleHiringGoalChange}
                readOnly={readOnly}
            />

            <RmiAddTrainerModal
                availableTrainers={availableTrainers}
                isOpen={showAddTrainerModal}
                onClose={() => setShowAddTrainerModal(false)}
                onOpenPlantPicker={() => {
                    setPlantModalTarget('trainer')
                    setShowPlantModal(true)
                }}
                onSubmit={addTrainer}
                plants={plants}
                setTrainer={setNewTrainer}
                trainer={newTrainer}
            />

            <RmiAddPendingModal
                isOpen={showAddPendingModal}
                onClose={() => setShowAddPendingModal(false)}
                onOpenPlantPicker={() => {
                    setPlantModalTarget('pending')
                    setShowPlantModal(true)
                }}
                onSubmit={addPending}
                pending={newPending}
                plants={plants}
                setPending={setNewPending}
            />

            <PlantDropdownModal
                isOpen={showPlantModal}
                onClose={() => setShowPlantModal(false)}
                plants={plants?.map((p) => ({ plantCode: p.plant_code || p.code, plantName: p.name })) || []}
                onSelect={(plantCode) => {
                    if (plantModalTarget === 'trainer') setNewTrainer({ ...newTrainer, plant: plantCode })
                    else if (plantModalTarget === 'pending') setNewPending({ ...newPending, plant: plantCode })
                    setShowPlantModal(false)
                }}
                searchPlaceholder="Search plants..."
            />
        </div>
    )
}

/* ── Review-mode plugin ─────────────────────────────────────────────────── */

export function ReadyMixInstructorReviewPlugin({ assignedPlant, form, plants, reportUserId, weekIso }) {
    const snapshotData = form?.snapshot_data || {}
    const mixerTrainers = snapshotData.mixer_trainers || []
    const tractorTrainers = snapshotData.tractor_trainers || []
    const mixerPending = snapshotData.mixer_pending || []
    const tractorPending = snapshotData.tractor_pending || []
    const mixerTraining = snapshotData.mixer_training || []
    const tractorTraining = snapshotData.tractor_training || []
    const hiringGoals = form?.hiring_goals || {}

    const { regionalPlants, regionPlantCodes } = useRmiRegionScope({
        plants,
        userId: reportUserId,
        userPlantCode: assignedPlant
    })

    /* Live-derived Terminated fallback — only computed when the saved
     * snapshot doesn't already carry the list. Keeps older reports useful
     * even before snapshotting started capturing this. */
    const snapshotHasTerminated = Array.isArray(snapshotData.terminated_operators)
    const [liveTerminated, setLiveTerminated] = useState([])
    useEffect(() => {
        if (snapshotHasTerminated || !weekIso) return
        async function computeFromLive() {
            try {
                if (regionPlantCodes.size === 0) return
                const ops = await OperatorService.fetchOperators(regionPlantCodes)
                const weekStart = new Date(weekIso)
                weekStart.setDate(weekStart.getDate() + 1)
                weekStart.setHours(0, 0, 0, 0)
                const weekEnd = new Date(weekStart)
                weekEnd.setDate(weekEnd.getDate() + 7)
                setLiveTerminated(
                    (ops || [])
                        .filter((op) => {
                            if (
                                !regionPlantCodes.has(
                                    String(op?.plantCode || '')
                                        .trim()
                                        .toUpperCase()
                                )
                            )
                                return false
                            if (op.status !== 'Terminated' || !op.statusChangedAt) return false
                            const changedAt = new Date(op.statusChangedAt)
                            return changedAt >= weekStart && changedAt < weekEnd
                        })
                        .map((op) => ({ id: op.employeeId, name: op.name, plant: op.plantCode, position: op.position }))
                )
            } catch {
                /* Non-critical — leave list empty if live fetch fails. */
            }
        }
        computeFromLive()
    }, [snapshotHasTerminated, weekIso, regionPlantCodes])
    const terminatedOperators = snapshotHasTerminated ? snapshotData.terminated_operators : liveTerminated

    return (
        <div className="flex flex-col gap-2.5 mt-2.5">
            <TrainersSection mixerTrainers={mixerTrainers} tractorTrainers={tractorTrainers} plants={plants} readOnly />
            <PendingSection mixerPending={mixerPending} tractorPending={tractorPending} plants={plants} readOnly />
            <TrainingSection
                mixerTraining={mixerTraining}
                tractorTraining={tractorTraining}
                plants={plants}
                readOnly
                weekIso={weekIso}
            />
            <TerminatedSection terminatedOperators={terminatedOperators} plants={plants} />
            <HiringGoalsSection plants={regionalPlants} hiringGoals={hiringGoals} readOnly />
        </div>
    )
}
