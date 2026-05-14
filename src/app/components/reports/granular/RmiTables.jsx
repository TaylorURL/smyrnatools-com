import React, { useMemo } from 'react'

import {
    computeDaysInTraining,
    formatPendingStartDate,
    getPlantNameFromList,
    getTrainingReferenceDate,
    POSITIONS
} from '../../../constants/rmiReportConstants'
import {
    CARD_STYLE,
    FIELD_INPUT_CLASS,
    FIELD_STYLE,
    ROW_STYLE,
    TD_BASE,
    TH_BASE
} from '../../../constants/weeklyReportConstants'
import { DataTable, TableRowActionButton } from './RmiAtoms'

/** Trainer roster — name + plant + status + remove. */
export function TrainerTable({ onRemove, plants, position, readOnly, trainers }) {
    const headers = readOnly ? ['Trainer', 'Plant', 'Status'] : ['Trainer', 'Plant', 'Status', '']
    return (
        <DataTable
            headers={headers}
            data={trainers}
            emptyMessage={`No ${position === POSITIONS.MIXER ? 'mixer' : 'tractor'} trainers ${
                readOnly ? 'recorded' : '— pull live data or add manually'
            }`}
            emptyIcon="fa-user-slash"
            renderRow={(trainer) => (
                <tr key={trainer.id} style={ROW_STYLE}>
                    <td className={`${TD_BASE} font-semibold`}>
                        <div className="flex items-center gap-1.5">
                            <i className="fas fa-user-tie text-[10px] text-text-tertiary" />
                            {trainer.name}
                        </div>
                    </td>
                    <td className={TD_BASE} style={{ color: 'var(--text-secondary)' }}>
                        {getPlantNameFromList(trainer.plant, plants)}
                    </td>
                    <td className={TD_BASE}>
                        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold bg-[rgba(22,_163,_74,_0.12)] text-green-700">
                            {trainer.status}
                        </span>
                    </td>
                    {!readOnly && (
                        <td className={`${TD_BASE} text-right`}>
                            <TableRowActionButton
                                onClick={() => onRemove(position, trainer.id)}
                                title="Remove trainer"
                            />
                        </td>
                    )}
                </tr>
            )}
        />
    )
}

/** Pending-start operators — operator + plant + start date + remove. */
export function PendingTable({ onRemove, pending, plants, position, readOnly }) {
    const headers = readOnly ? ['Operator', 'Plant', 'Start Date'] : ['Operator', 'Plant', 'Start Date', '']
    return (
        <DataTable
            headers={headers}
            data={pending}
            emptyMessage={`No pending ${position === POSITIONS.MIXER ? 'mixer' : 'tractor'} operators`}
            renderRow={(op) => (
                <tr key={op.id} style={ROW_STYLE}>
                    <td className={`${TD_BASE} font-semibold`}>
                        <div className="flex items-center gap-1.5">
                            <i className="fas fa-user text-[10px] text-text-tertiary" />
                            {op.name}
                        </div>
                    </td>
                    <td className={TD_BASE} style={{ color: 'var(--text-secondary)' }}>
                        {getPlantNameFromList(op.plant, plants)}
                    </td>
                    <td className={`${TD_BASE} tabular-nums whitespace-nowrap`}>
                        {formatPendingStartDate(op.startDate)}
                    </td>
                    {!readOnly && (
                        <td className={`${TD_BASE} text-right`}>
                            <TableRowActionButton
                                onClick={() => onRemove(position, op.id)}
                                title="Remove pending operator"
                            />
                        </td>
                    )}
                </tr>
            )}
        />
    )
}

/** Operators currently in training — adds an auto-calculated "days in
 *  training" column anchored at the report's end-of-week date. */
export function TrainingTable({ onRemove, plants, position, readOnly, training, weekIso }) {
    const headers = readOnly
        ? ['Operator', 'Plant', 'Trainer', 'Days in Training']
        : ['Operator', 'Plant', 'Trainer', 'Days in Training', '']
    const referenceDate = useMemo(() => getTrainingReferenceDate(weekIso), [weekIso])
    return (
        <DataTable
            headers={headers}
            data={training}
            emptyMessage={`No ${position === POSITIONS.MIXER ? 'mixer' : 'tractor'} operators in training`}
            renderRow={(op) => {
                const days = computeDaysInTraining(op.trainingSince, referenceDate)
                return (
                    <tr key={op.id} style={ROW_STYLE}>
                        <td className={`${TD_BASE} font-semibold`}>
                            <div className="flex items-center gap-1.5">
                                <i className="fas fa-user text-[10px] text-text-tertiary" />
                                {op.name}
                            </div>
                        </td>
                        <td className={TD_BASE} style={{ color: 'var(--text-secondary)' }}>
                            {getPlantNameFromList(op.plant, plants)}
                        </td>
                        <td className={TD_BASE} style={{ color: 'var(--text-primary)' }}>
                            {op.trainer || '—'}
                        </td>
                        <td className={`${TD_BASE} tabular-nums text-text-primary`}>
                            {days == null ? '—' : `${days} day${days === 1 ? '' : 's'}`}
                        </td>
                        {!readOnly && (
                            <td className={`${TD_BASE} text-right`}>
                                <TableRowActionButton
                                    onClick={() => onRemove(position, op.id)}
                                    title="Remove training operator"
                                />
                            </td>
                        )}
                    </tr>
                )
            }}
        />
    )
}

/** Read-only roster of operators moved to Terminated during the report week. */
export function TerminatedTable({ operators, plants }) {
    return (
        <DataTable
            headers={['Operator', 'Plant', 'Position']}
            data={operators}
            emptyMessage="No terminated operators recorded."
            emptyIcon="fa-user-check"
            renderRow={(op) => (
                <tr key={op.id} style={ROW_STYLE}>
                    <td className={`${TD_BASE} font-semibold`}>
                        <div className="flex items-center gap-1.5">
                            <i className="fas fa-user-slash text-[10px] text-text-tertiary" />
                            {op.name}
                        </div>
                    </td>
                    <td className={TD_BASE} style={{ color: 'var(--text-secondary)' }}>
                        {getPlantNameFromList(op.plant, plants)}
                    </td>
                    <td className={TD_BASE} style={{ color: 'var(--text-primary)' }}>
                        {op.position || '—'}
                    </td>
                </tr>
            )}
        />
    )
}

/** Hiring goals per plant — read-only renders the number; edit mode swaps
 *  in a number input that fires `onChange(plantCode, value)`. */
export function HiringGoalsTable({ hiringGoals, onChange, plants, readOnly }) {
    return (
        <div className="overflow-x-auto rounded" style={CARD_STYLE}>
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        {['Plant', 'Code', 'Hiring Goal'].map((h) => (
                            <th key={h} className={TH_BASE}>
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {plants?.map((plant) => {
                        const plantCode = plant.plant_code || plant.code
                        const plantName = plant.name || plant.plant_name || plantCode
                        return (
                            <tr key={plantCode} style={ROW_STYLE}>
                                <td className={`${TD_BASE} font-semibold`}>
                                    <div className="flex items-center gap-1.5">
                                        <i className="fas fa-industry text-[10px] text-text-tertiary" />
                                        <span>{plantName}</span>
                                    </div>
                                </td>
                                <td className={TD_BASE}>
                                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums bg-bg-tertiary text-text-secondary border border-border-light">
                                        {plantCode}
                                    </span>
                                </td>
                                <td className={TD_BASE}>
                                    {readOnly ? (
                                        <div className="font-bold text-[13px] tabular-nums text-text-primary">
                                            {hiringGoals[plantCode] || '0'}
                                        </div>
                                    ) : (
                                        <input
                                            type="number"
                                            min="0"
                                            value={hiringGoals[plantCode] || ''}
                                            onChange={(e) => onChange(plantCode, e.target.value)}
                                            placeholder="0"
                                            className={`${FIELD_INPUT_CLASS} text-center tabular-nums`}
                                            style={{ ...FIELD_STYLE, width: 80 }}
                                        />
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
