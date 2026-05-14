import React from 'react'

import { POSITIONS } from '../../../constants/rmiReportConstants'
import { CARD_STYLE } from '../../../constants/weeklyReportConstants'
import { CardHeader, CategoryCard } from './RmiAtoms'
import { HiringGoalsTable, PendingTable, TerminatedTable, TrainerTable, TrainingTable } from './RmiTables'

/** Mixer vs Tractor trainer roster, side by side. */
export function TrainersSection({ actions, mixerTrainers, onRemove, plants, readOnly, tractorTrainers }) {
    return (
        <div className="rounded p-3" style={CARD_STYLE}>
            <CardHeader
                icon="fa-chalkboard-teacher"
                label="Trainers"
                title="Active Trainers by Position"
                sub="Current instructors assigned to train new operators."
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <CategoryCard
                    position={POSITIONS.MIXER}
                    label="Mixer Trainers"
                    count={mixerTrainers.length}
                    actions={actions?.mixer}
                >
                    <TrainerTable
                        trainers={mixerTrainers}
                        plants={plants}
                        position={POSITIONS.MIXER}
                        onRemove={onRemove}
                        readOnly={readOnly}
                    />
                </CategoryCard>
                <CategoryCard
                    position={POSITIONS.TRACTOR}
                    label="Tractor Trainers"
                    count={tractorTrainers.length}
                    actions={actions?.tractor}
                >
                    <TrainerTable
                        trainers={tractorTrainers}
                        plants={plants}
                        position={POSITIONS.TRACTOR}
                        onRemove={onRemove}
                        readOnly={readOnly}
                    />
                </CategoryCard>
            </div>
        </div>
    )
}

/** Pending-start operators by position. */
export function PendingSection({ actions, mixerPending, onRemove, plants, readOnly, tractorPending }) {
    return (
        <div className="rounded p-3" style={CARD_STYLE}>
            <CardHeader
                icon="fa-user-clock"
                label="Pending"
                title="Pending Start Operators"
                sub="New operators awaiting start date with assigned trainers."
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <CategoryCard
                    position={POSITIONS.MIXER}
                    label="Mixer Operators"
                    count={mixerPending.length}
                    actions={actions?.mixer}
                >
                    <PendingTable
                        pending={mixerPending}
                        plants={plants}
                        position={POSITIONS.MIXER}
                        onRemove={onRemove}
                        readOnly={readOnly}
                    />
                </CategoryCard>
                <CategoryCard
                    position={POSITIONS.TRACTOR}
                    label="Tractor Operators"
                    count={tractorPending.length}
                    actions={actions?.tractor}
                >
                    <PendingTable
                        pending={tractorPending}
                        plants={plants}
                        position={POSITIONS.TRACTOR}
                        onRemove={onRemove}
                        readOnly={readOnly}
                    />
                </CategoryCard>
            </div>
        </div>
    )
}

/** Operators currently in training by position — drives days-in-training. */
export function TrainingSection({ actions, mixerTraining, onRemove, plants, readOnly, tractorTraining, weekIso }) {
    return (
        <div className="rounded p-3" style={CARD_STYLE}>
            <CardHeader
                icon="fa-graduation-cap"
                label="Training"
                title="Operators in Training"
                sub="Operators currently in training with assigned trainers."
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <CategoryCard
                    position={POSITIONS.MIXER}
                    label="Mixer Operators"
                    count={mixerTraining.length}
                    actions={actions?.mixer}
                >
                    <TrainingTable
                        training={mixerTraining}
                        plants={plants}
                        position={POSITIONS.MIXER}
                        onRemove={onRemove}
                        readOnly={readOnly}
                        weekIso={weekIso}
                    />
                </CategoryCard>
                <CategoryCard
                    position={POSITIONS.TRACTOR}
                    label="Tractor Operators"
                    count={tractorTraining.length}
                    actions={actions?.tractor}
                >
                    <TrainingTable
                        training={tractorTraining}
                        plants={plants}
                        position={POSITIONS.TRACTOR}
                        onRemove={onRemove}
                        readOnly={readOnly}
                        weekIso={weekIso}
                    />
                </CategoryCard>
            </div>
        </div>
    )
}

/** Single table of operators moved to Terminated during the report week. */
export function TerminatedSection({ plants, terminatedOperators }) {
    return (
        <div className="rounded p-3" style={CARD_STYLE}>
            <CardHeader
                icon="fa-user-slash"
                label="Terminated"
                title="Terminated Operators"
                sub="Operators moved to Terminated status during this report week."
            />
            <TerminatedTable operators={terminatedOperators} plants={plants} />
        </div>
    )
}

/** Per-plant hiring goal table. */
export function HiringGoalsSection({ hiringGoals, onChange, plants, readOnly }) {
    return (
        <div className="rounded p-3" style={CARD_STYLE}>
            <CardHeader
                icon="fa-bullseye"
                label="Goals"
                title="Weekly Hiring Goals"
                sub={
                    readOnly ? 'Hiring targets for each plant location.' : 'Set hiring targets for each plant location.'
                }
            />
            <HiringGoalsTable plants={plants} hiringGoals={hiringGoals} onChange={onChange} readOnly={readOnly} />
        </div>
    )
}
