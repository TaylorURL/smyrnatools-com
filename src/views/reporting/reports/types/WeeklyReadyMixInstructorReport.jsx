import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'

import PlantDropdownModal from '../../../../app/components/common/PlantDropdownModal'
import { OperatorService } from '../../../../services/OperatorService'

/* ── Plan-tab design tokens ───────────────────────────────────────────────
 *  Same vocabulary as the District / Plant / Efficiency / Aggregate /
 *  Safety report rewrites. */
const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
const CARD_STYLE = { background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }
const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}
const FIELD_INPUT_CLASS = 'w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none box-border disabled:opacity-90'
const TH_BASE = `${SECTION_LABEL_CLASS} px-3 py-2 text-left whitespace-nowrap`
const TH_STYLE = {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-tertiary)',
    borderBottom: '1px solid var(--border-light)'
}
const TD_BASE = 'px-3 py-1.5 text-[12px] align-middle'

const POSITIONS = {
    MIXER: 'Mixer Operator',
    TRACTOR: 'Tractor Operator'
}
const CATEGORY_ICONS = {
    [POSITIONS.MIXER]: 'fa-truck-loading',
    [POSITIONS.TRACTOR]: 'fa-tractor'
}

function getPlantNameFromList(plantCode, plants) {
    const plant = plants?.find((p) => (p.plant_code || p.code) === plantCode)
    return plant?.name || plantCode || '—'
}

/* ── Primitives ──────────────────────────────────────────────────────────── */

function CardHeader({ icon, label, sub, title, right }) {
    return (
        <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
                <div
                    className="flex h-6 w-6 items-center justify-center rounded shrink-0"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                    <i className={`fas ${icon} text-[11px]`} />
                </div>
                <div className="min-w-0 flex-1">
                    {label && (
                        <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            {label}
                        </div>
                    )}
                    <div className="text-[12.5px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {title}
                    </div>
                    {sub && (
                        <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            {sub}
                        </div>
                    )}
                </div>
            </div>
            {right && <div className="shrink-0">{right}</div>}
        </div>
    )
}

function ActionChip({ accent, children, disabled, icon, onClick, title }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                color: accent || 'var(--text-secondary)'
            }}
        >
            {icon && <i className={`fas ${icon} text-[10px]`} />}
            {children}
        </button>
    )
}

function RMIEmptyState({ icon = 'fa-user-slash', message }) {
    return (
        <div
            className="flex items-center justify-center gap-2 py-5 px-3 rounded text-[11.5px]"
            style={{
                background: 'var(--bg-secondary)',
                border: '1px dashed var(--border-medium)',
                color: 'var(--text-tertiary)'
            }}
        >
            <i className={`fas ${icon} text-[12px]`} />
            <span>{message}</span>
        </div>
    )
}

function CategoryCard({ position, label, count, actions, children }) {
    const icon = CATEGORY_ICONS[position] || CATEGORY_ICONS[POSITIONS.MIXER]
    return (
        <div
            className="rounded overflow-hidden flex flex-col"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
        >
            <div
                className="flex items-center justify-between gap-2 px-2.5 py-2 flex-wrap"
                style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-light)' }}
            >
                <div className="flex items-center gap-2">
                    <i className={`fas ${icon} text-[11px]`} style={{ color: 'var(--text-secondary)' }} />
                    <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {label}
                    </span>
                    <span
                        className="inline-flex items-center justify-center rounded text-[10.5px] font-bold tabular-nums"
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-secondary)',
                            minWidth: 22,
                            height: 18,
                            padding: '0 5px'
                        }}
                    >
                        {count}
                    </span>
                </div>
                {actions && <div className="flex gap-1 flex-wrap">{actions}</div>}
            </div>
            <div className="p-2">{children}</div>
        </div>
    )
}

function DataTable({ data, headers, renderRow, emptyIcon = 'fa-check-circle', emptyMessage }) {
    if (!data?.length) return <RMIEmptyState icon={emptyIcon} message={emptyMessage} />
    return (
        <div className="overflow-x-auto rounded" style={CARD_STYLE}>
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className={TH_BASE} style={TH_STYLE}>
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>{data.map(renderRow)}</tbody>
            </table>
        </div>
    )
}

function TableRowActionButton({ onClick, title }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className="flex items-center justify-center rounded border-none cursor-pointer"
            style={{
                background: 'rgba(220, 38, 38, 0.12)',
                color: '#b91c1c',
                height: 22,
                width: 22
            }}
        >
            <i className="fas fa-times text-[10px]" />
        </button>
    )
}

const ROW_STYLE = { borderTop: '1px solid var(--border-light)', color: 'var(--text-primary)' }

/* ── Tables ──────────────────────────────────────────────────────────────── */

function TrainerTable({ trainers, plants, position, onRemove, readOnly }) {
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
                            <i className="fas fa-user-tie text-[10px]" style={{ color: 'var(--text-tertiary)' }} />
                            {trainer.name}
                        </div>
                    </td>
                    <td className={TD_BASE} style={{ color: 'var(--text-secondary)' }}>
                        {getPlantNameFromList(trainer.plant, plants)}
                    </td>
                    <td className={TD_BASE}>
                        <span
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold"
                            style={{ background: 'rgba(22, 163, 74, 0.12)', color: '#15803d' }}
                        >
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

function PendingTable({ pending, plants, position, onRemove, readOnly }) {
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
                            <i className="fas fa-user text-[10px]" style={{ color: 'var(--text-tertiary)' }} />
                            {op.name}
                        </div>
                    </td>
                    <td className={TD_BASE} style={{ color: 'var(--text-secondary)' }}>
                        {getPlantNameFromList(op.plant, plants)}
                    </td>
                    <td className={`${TD_BASE} tabular-nums`}>{op.startDate || '—'}</td>
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

function TrainingTable({ training, plants, position, onRemove, readOnly }) {
    const headers = readOnly ? ['Operator', 'Plant', 'Trainer'] : ['Operator', 'Plant', 'Trainer', '']
    return (
        <DataTable
            headers={headers}
            data={training}
            emptyMessage={`No ${position === POSITIONS.MIXER ? 'mixer' : 'tractor'} operators in training`}
            renderRow={(op) => (
                <tr key={op.id} style={ROW_STYLE}>
                    <td className={`${TD_BASE} font-semibold`}>
                        <div className="flex items-center gap-1.5">
                            <i className="fas fa-user text-[10px]" style={{ color: 'var(--text-tertiary)' }} />
                            {op.name}
                        </div>
                    </td>
                    <td className={TD_BASE} style={{ color: 'var(--text-secondary)' }}>
                        {getPlantNameFromList(op.plant, plants)}
                    </td>
                    <td className={TD_BASE} style={{ color: 'var(--text-primary)' }}>
                        {op.trainer || '—'}
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
            )}
        />
    )
}

function TerminatedTable({ operators, plants }) {
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
                            <i className="fas fa-user-slash text-[10px]" style={{ color: 'var(--text-tertiary)' }} />
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

function HiringGoalsTable({ plants, hiringGoals, onChange, readOnly }) {
    return (
        <div className="overflow-x-auto rounded" style={CARD_STYLE}>
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                    <tr>
                        {['Plant', 'Code', 'Hiring Goal'].map((h) => (
                            <th key={h} className={TH_BASE} style={TH_STYLE}>
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
                                        <i
                                            className="fas fa-industry text-[10px]"
                                            style={{ color: 'var(--text-tertiary)' }}
                                        />
                                        <span>{plantName}</span>
                                    </div>
                                </td>
                                <td className={TD_BASE}>
                                    <span
                                        className="inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums"
                                        style={{
                                            background: 'var(--bg-tertiary)',
                                            color: 'var(--text-secondary)',
                                            border: '1px solid var(--border-light)'
                                        }}
                                    >
                                        {plantCode}
                                    </span>
                                </td>
                                <td className={TD_BASE}>
                                    {readOnly ? (
                                        <div
                                            className="font-bold text-[13px] tabular-nums"
                                            style={{ color: 'var(--text-primary)' }}
                                        >
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

/* ── Sections ────────────────────────────────────────────────────────────── */

function TrainersSection({ mixerTrainers, tractorTrainers, plants, readOnly, onRemove, actions }) {
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

function PendingSection({ mixerPending, tractorPending, plants, readOnly, onRemove, actions }) {
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

function TrainingSection({ mixerTraining, tractorTraining, plants, readOnly, onRemove, actions }) {
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
                    />
                </CategoryCard>
            </div>
        </div>
    )
}

function TerminatedSection({ terminatedOperators, plants }) {
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

function HiringGoalsSection({ plants, hiringGoals, onChange, readOnly }) {
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

/* ── Modal primitive ─────────────────────────────────────────────────────── */

function FormModal({ icon, isOpen, onClose, onSubmit, sub, submitDisabled, submitLabel, title, children }) {
    if (!isOpen || typeof document === 'undefined') return null
    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                className="w-full max-w-[480px] max-h-[90vh] overflow-y-auto rounded shadow-2xl"
                style={CARD_STYLE}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className="flex items-center justify-between px-3 py-2.5"
                    style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)' }}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <div
                            className="flex h-6 w-6 items-center justify-center rounded shrink-0"
                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                        >
                            <i className={`fas ${icon} text-[11px]`} />
                        </div>
                        <div className="min-w-0">
                            <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                Action
                            </div>
                            <div
                                className="text-[12.5px] font-semibold leading-tight"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                {title}
                            </div>
                            {sub && (
                                <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                    {sub}
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded border-none cursor-pointer"
                        style={{
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)',
                            height: 24,
                            width: 24
                        }}
                    >
                        <i className="fas fa-times text-[10px]" />
                    </button>
                </div>
                <div className="p-3 flex flex-col gap-2">{children}</div>
                <div
                    className="flex justify-end gap-1.5 px-3 py-2.5"
                    style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-light)' }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded text-[11.5px] font-semibold uppercase tracking-wider px-2.5 py-1.5 cursor-pointer border-none"
                        style={{
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={submitDisabled}
                        className="inline-flex items-center gap-1.5 rounded text-[11.5px] font-bold uppercase tracking-wider text-white px-2.5 py-1.5 cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: 'var(--accent, #1e3a5f)' }}
                    >
                        <i className="fas fa-plus text-[10px]" />
                        {submitLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}

function ModalField({ children, icon, label, required }) {
    return (
        <div className="flex flex-col gap-1">
            <label
                className={`${SECTION_LABEL_CLASS} flex items-center gap-1.5`}
                style={{ color: 'var(--text-tertiary)' }}
            >
                {icon && <i className={`fas ${icon} text-[10px]`} />}
                {label}
                {required && (
                    <span className="ml-0.5" style={{ color: '#dc2626' }}>
                        *
                    </span>
                )}
            </label>
            {children}
        </div>
    )
}

/* ── Submit-mode plugin ─────────────────────────────────────────────────── */

export function ReadyMixInstructorSubmitPlugin({ form, setForm, readOnly, plants, weekIso }) {
    const [liveOperators, setLiveOperators] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [showAddTrainerModal, setShowAddTrainerModal] = useState(false)
    const [showAddPendingModal, setShowAddPendingModal] = useState(false)
    const [showPlantModal, setShowPlantModal] = useState(false)
    const [plantModalTarget, setPlantModalTarget] = useState(null)
    const [newTrainer, setNewTrainer] = useState({ plant: '', position: 'Mixer Operator', trainerId: '' })
    const [newPending, setNewPending] = useState({
        name: '',
        plant: '',
        position: 'Mixer Operator',
        startDate: '',
        trainer: ''
    })
    const snapshotData = React.useMemo(() => form?.snapshot_data || {}, [form])
    const mixerTrainers = React.useMemo(() => snapshotData.mixer_trainers || [], [snapshotData])
    const tractorTrainers = React.useMemo(() => snapshotData.tractor_trainers || [], [snapshotData])
    const mixerPending = React.useMemo(() => snapshotData.mixer_pending || [], [snapshotData])
    const tractorPending = React.useMemo(() => snapshotData.tractor_pending || [], [snapshotData])
    const mixerTraining = React.useMemo(() => snapshotData.mixer_training || [], [snapshotData])
    const tractorTraining = React.useMemo(() => snapshotData.tractor_training || [], [snapshotData])
    const hiringGoals = form?.hiring_goals || {}
    const terminatedThisWeek = React.useMemo(() => {
        if (!liveOperators.length || !weekIso) return []
        const weekStart = new Date(weekIso)
        weekStart.setDate(weekStart.getDate() + 1)
        weekStart.setHours(0, 0, 0, 0)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 7)
        return liveOperators
            .filter((op) => {
                if (op.status !== 'Terminated' || !op.statusChangedAt) return false
                const changedAt = new Date(op.statusChangedAt)
                return changedAt >= weekStart && changedAt < weekEnd
            })
            .map((op) => ({ id: op.employeeId, name: op.name, plant: op.plantCode, position: op.position }))
    }, [liveOperators, weekIso])
    const isMixerTrainersAccurate = React.useMemo(() => {
        if (!liveOperators.length || mixerTrainers.length === 0) return false
        const liveTrainers = liveOperators.filter(
            (op) => op.isTrainer && op.status !== 'Terminated' && op.position === 'Mixer Operator'
        )
        if (mixerTrainers.length !== liveTrainers.length) return false
        const mixerTrainerIds = new Set(mixerTrainers.map((t) => t.id))
        return liveTrainers.every((op) => mixerTrainerIds.has(op.employeeId))
    }, [liveOperators, mixerTrainers])
    const isTractorTrainersAccurate = React.useMemo(() => {
        if (!liveOperators.length || tractorTrainers.length === 0) return false
        const liveTrainers = liveOperators.filter(
            (op) => op.isTrainer && op.status !== 'Terminated' && op.position === 'Tractor Operator'
        )
        if (tractorTrainers.length !== liveTrainers.length) return false
        const tractorTrainerIds = new Set(tractorTrainers.map((t) => t.id))
        return liveTrainers.every((op) => tractorTrainerIds.has(op.employeeId))
    }, [liveOperators, tractorTrainers])
    const isMixerPendingAccurate = React.useMemo(() => {
        if (!liveOperators.length || mixerPending.length === 0) return false
        const livePending = liveOperators.filter(
            (op) =>
                op.status === 'Pending Start' &&
                op.pendingStartDate &&
                op.pendingStartDate.trim() !== '' &&
                op.position === 'Mixer Operator'
        )
        if (mixerPending.length !== livePending.length) return false
        const mixerPendingIds = new Set(mixerPending.map((p) => p.id))
        return livePending.every((op) => mixerPendingIds.has(op.employeeId))
    }, [liveOperators, mixerPending])
    const isTractorPendingAccurate = React.useMemo(() => {
        if (!liveOperators.length || tractorPending.length === 0) return false
        const livePending = liveOperators.filter(
            (op) =>
                op.status === 'Pending Start' &&
                op.pendingStartDate &&
                op.pendingStartDate.trim() !== '' &&
                op.position === 'Tractor Operator'
        )
        if (tractorPending.length !== livePending.length) return false
        const tractorPendingIds = new Set(tractorPending.map((p) => p.id))
        return livePending.every((op) => tractorPendingIds.has(op.employeeId))
    }, [liveOperators, tractorPending])
    const isMixerTrainingAccurate = React.useMemo(() => {
        if (!liveOperators.length || mixerTraining.length === 0) return false
        const liveTraining = liveOperators.filter((op) => op.status === 'Training' && op.position === 'Mixer Operator')
        if (mixerTraining.length !== liveTraining.length) return false
        const mixerTrainingIds = new Set(mixerTraining.map((t) => t.id))
        return liveTraining.every((op) => mixerTrainingIds.has(op.employeeId))
    }, [liveOperators, mixerTraining])
    const isTractorTrainingAccurate = React.useMemo(() => {
        if (!liveOperators.length || tractorTraining.length === 0) return false
        const liveTraining = liveOperators.filter(
            (op) => op.status === 'Training' && op.position === 'Tractor Operator'
        )
        if (tractorTraining.length !== liveTraining.length) return false
        const tractorTrainingIds = new Set(tractorTraining.map((t) => t.id))
        return liveTraining.every((op) => tractorTrainingIds.has(op.employeeId))
    }, [liveOperators, tractorTraining])
    const loadLiveData = React.useCallback(
        async function loadLiveData() {
            setIsLoading(true)
            try {
                const plantCodes = plants ? new Set(plants.map((p) => p.plant_code || p.code).filter(Boolean)) : null
                const ops = await OperatorService.fetchOperators(plantCodes)
                setLiveOperators(ops || [])
            } catch (error) {
                console.error('Failed to load operators:', error)
                alert('Failed to load live data')
            } finally {
                setIsLoading(false)
            }
        },
        [plants]
    )
    function updateSnapshotData(key, value) {
        setForm((prev) => ({ ...prev, snapshot_data: { ...prev.snapshot_data, [key]: value } }))
    }
    function pullMixerTrainers() {
        if (!liveOperators.length) {
            alert('Please load live data first')
            return
        }
        const trainers = liveOperators.filter(
            (op) => op.isTrainer && op.status !== 'Terminated' && op.position === 'Mixer Operator'
        )
        updateSnapshotData(
            'mixer_trainers',
            trainers.map((op) => ({ id: op.employeeId, name: op.name, plant: op.plantCode, status: op.status }))
        )
    }
    function pullTractorTrainers() {
        if (!liveOperators.length) {
            alert('Please load live data first')
            return
        }
        const trainers = liveOperators.filter(
            (op) => op.isTrainer && op.status !== 'Terminated' && op.position === 'Tractor Operator'
        )
        updateSnapshotData(
            'tractor_trainers',
            trainers.map((op) => ({ id: op.employeeId, name: op.name, plant: op.plantCode, status: op.status }))
        )
    }
    function pullMixerPending() {
        if (!liveOperators.length) {
            alert('Please load live data first')
            return
        }
        const pending = liveOperators.filter(
            (op) => op.status === 'Pending Start' && op.pendingStartDate?.trim() && op.position === 'Mixer Operator'
        )
        updateSnapshotData(
            'mixer_pending',
            pending.map((op) => ({
                id: op.employeeId,
                name: op.name,
                plant: op.plantCode,
                startDate: op.pendingStartDate,
                trainer: op.assignedTrainer
            }))
        )
    }
    function pullTractorPending() {
        if (!liveOperators.length) {
            alert('Please load live data first')
            return
        }
        const pending = liveOperators.filter(
            (op) => op.status === 'Pending Start' && op.pendingStartDate?.trim() && op.position === 'Tractor Operator'
        )
        updateSnapshotData(
            'tractor_pending',
            pending.map((op) => ({
                id: op.employeeId,
                name: op.name,
                plant: op.plantCode,
                startDate: op.pendingStartDate,
                trainer: op.assignedTrainer
            }))
        )
    }
    function pullMixerTraining() {
        if (!liveOperators.length) {
            alert('Please load live data first')
            return
        }
        const training = liveOperators.filter((op) => op.status === 'Training' && op.position === 'Mixer Operator')
        updateSnapshotData(
            'mixer_training',
            training.map((op) => {
                const trainer = liveOperators.find((t) => t.employeeId === op.assignedTrainer)
                return {
                    id: op.employeeId,
                    name: op.name,
                    plant: op.plantCode,
                    trainer: trainer?.name || op.assignedTrainer || '—'
                }
            })
        )
    }
    function pullTractorTraining() {
        if (!liveOperators.length) {
            alert('Please load live data first')
            return
        }
        const training = liveOperators.filter((op) => op.status === 'Training' && op.position === 'Tractor Operator')
        updateSnapshotData(
            'tractor_training',
            training.map((op) => {
                const trainer = liveOperators.find((t) => t.employeeId === op.assignedTrainer)
                return {
                    id: op.employeeId,
                    name: op.name,
                    plant: op.plantCode,
                    trainer: trainer?.name || op.assignedTrainer || '—'
                }
            })
        )
    }
    function removeTrainer(position, id) {
        const key = position === POSITIONS.MIXER ? 'mixer_trainers' : 'tractor_trainers'
        updateSnapshotData(
            key,
            (snapshotData[key] || []).filter((t) => t.id !== id)
        )
    }
    function removePending(position, id) {
        const key = position === POSITIONS.MIXER ? 'mixer_pending' : 'tractor_pending'
        updateSnapshotData(
            key,
            (snapshotData[key] || []).filter((t) => t.id !== id)
        )
    }
    function removeTraining(position, id) {
        const key = position === POSITIONS.MIXER ? 'mixer_training' : 'tractor_training'
        updateSnapshotData(
            key,
            (snapshotData[key] || []).filter((t) => t.id !== id)
        )
    }
    function clearData(key) {
        if (!confirm(`Are you sure you want to clear all ${key.replace(/_/g, ' ')} data?`)) return
        updateSnapshotData(key, [])
    }
    function addTrainer() {
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
        setNewTrainer({ plant: '', position: 'Mixer Operator', trainerId: '' })
        setShowAddTrainerModal(false)
    }
    function addPending() {
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
        setNewPending({ name: '', plant: '', position: 'Mixer Operator', startDate: '', trainer: '' })
        setShowAddPendingModal(false)
    }
    function getPlantName(plantCode) {
        return getPlantNameFromList(plantCode, plants)
    }
    function getAvailableTrainers(position) {
        return liveOperators.filter((op) => op.isTrainer && op.status !== 'Terminated' && op.position === position)
    }
    function handleHiringGoalChange(plantCode, value) {
        if (setForm)
            setForm((prev) => ({ ...prev, hiring_goals: { ...(prev.hiring_goals || {}), [plantCode]: value } }))
    }
    useEffect(() => {
        loadLiveData()
    }, [plants, loadLiveData])
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

    const createActionButtons = (pullFn, addFn, clearFn, isAccurate, dataLength) => (
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
        mixer: createActionButtons(
            pullMixerTrainers,
            () => {
                setNewTrainer({ plant: '', position: POSITIONS.MIXER, trainerId: '' })
                setShowAddTrainerModal(true)
            },
            () => clearData('mixer_trainers'),
            isMixerTrainersAccurate,
            mixerTrainers.length
        ),
        tractor: createActionButtons(
            pullTractorTrainers,
            () => {
                setNewTrainer({ plant: '', position: POSITIONS.TRACTOR, trainerId: '' })
                setShowAddTrainerModal(true)
            },
            () => clearData('tractor_trainers'),
            isTractorTrainersAccurate,
            tractorTrainers.length
        )
    }
    const pendingActions = {
        mixer: createActionButtons(
            pullMixerPending,
            () => {
                setNewPending({ name: '', plant: '', position: POSITIONS.MIXER, startDate: '', trainer: '' })
                setShowAddPendingModal(true)
            },
            () => clearData('mixer_pending'),
            isMixerPendingAccurate,
            mixerPending.length
        ),
        tractor: createActionButtons(
            pullTractorPending,
            () => {
                setNewPending({ name: '', plant: '', position: POSITIONS.TRACTOR, startDate: '', trainer: '' })
                setShowAddPendingModal(true)
            },
            () => clearData('tractor_pending'),
            isTractorPendingAccurate,
            tractorPending.length
        )
    }
    const trainingActions = {
        mixer: createActionButtons(
            pullMixerTraining,
            () => {
                setNewPending({ name: '', plant: '', position: POSITIONS.MIXER, startDate: '', trainer: '' })
                setShowAddPendingModal(true)
            },
            () => clearData('mixer_training'),
            isMixerTrainingAccurate,
            mixerTraining.length
        ),
        tractor: createActionButtons(
            pullTractorTraining,
            () => {
                setNewPending({ name: '', plant: '', position: POSITIONS.TRACTOR, startDate: '', trainer: '' })
                setShowAddPendingModal(true)
            },
            () => clearData('tractor_training'),
            isTractorTrainingAccurate,
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
            />
            <TerminatedSection terminatedOperators={terminatedThisWeek} plants={plants} readOnly={readOnly} />
            <HiringGoalsSection
                plants={plants}
                hiringGoals={hiringGoals}
                onChange={handleHiringGoalChange}
                readOnly={readOnly}
            />

            <FormModal
                icon="fa-user-plus"
                isOpen={showAddTrainerModal}
                onClose={() => setShowAddTrainerModal(false)}
                onSubmit={addTrainer}
                submitLabel="Add Trainer"
                title="Add Trainer"
                sub="Select an existing trainer from your region."
            >
                <ModalField icon="fa-briefcase" label="Position" required>
                    <select
                        value={newTrainer.position}
                        onChange={(e) => setNewTrainer({ ...newTrainer, position: e.target.value, trainerId: '' })}
                        className={`${FIELD_INPUT_CLASS} appearance-none cursor-pointer pr-8`}
                        style={FIELD_STYLE}
                    >
                        <option value={POSITIONS.MIXER}>Mixer Operator</option>
                        <option value={POSITIONS.TRACTOR}>Tractor Operator</option>
                    </select>
                </ModalField>
                <ModalField icon="fa-user-tie" label="Select Trainer" required>
                    <select
                        value={newTrainer.trainerId}
                        onChange={(e) => setNewTrainer({ ...newTrainer, trainerId: e.target.value })}
                        className={`${FIELD_INPUT_CLASS} appearance-none cursor-pointer pr-8`}
                        style={FIELD_STYLE}
                    >
                        <option value="">Choose a trainer…</option>
                        {getAvailableTrainers(newTrainer.position).map((trainer) => (
                            <option key={trainer.employeeId} value={trainer.employeeId}>
                                {trainer.name} · {getPlantName(trainer.plantCode)}
                            </option>
                        ))}
                    </select>
                    {getAvailableTrainers(newTrainer.position).length === 0 && (
                        <span className="text-[10.5px]" style={{ color: 'var(--text-tertiary)' }}>
                            No trainers available for this position.
                        </span>
                    )}
                </ModalField>
                <ModalField icon="fa-industry" label="Assign to Plant" required>
                    <button
                        type="button"
                        className={`${FIELD_INPUT_CLASS} flex items-center justify-between text-left cursor-pointer`}
                        style={FIELD_STYLE}
                        onClick={() => {
                            setPlantModalTarget('trainer')
                            setShowPlantModal(true)
                        }}
                    >
                        <span>{newTrainer.plant ? getPlantName(newTrainer.plant) : 'Select plant…'}</span>
                        <i className="fas fa-chevron-down text-[9px]" style={{ color: 'var(--text-tertiary)' }} />
                    </button>
                </ModalField>
            </FormModal>

            <FormModal
                icon="fa-user-clock"
                isOpen={showAddPendingModal}
                onClose={() => setShowAddPendingModal(false)}
                onSubmit={addPending}
                submitLabel="Add Operator"
                title="Add Pending Start Operator"
                sub="Add a new operator awaiting start date."
            >
                <ModalField icon="fa-briefcase" label="Position" required>
                    <select
                        value={newPending.position}
                        onChange={(e) => setNewPending({ ...newPending, position: e.target.value })}
                        className={`${FIELD_INPUT_CLASS} appearance-none cursor-pointer pr-8`}
                        style={FIELD_STYLE}
                    >
                        <option value={POSITIONS.MIXER}>Mixer Operator</option>
                        <option value={POSITIONS.TRACTOR}>Tractor Operator</option>
                    </select>
                </ModalField>
                <ModalField icon="fa-user" label="Operator Name" required>
                    <input
                        type="text"
                        value={newPending.name}
                        onChange={(e) => setNewPending({ ...newPending, name: e.target.value })}
                        className={FIELD_INPUT_CLASS}
                        style={FIELD_STYLE}
                        placeholder="Enter operator name"
                    />
                </ModalField>
                <ModalField icon="fa-industry" label="Assign to Plant" required>
                    <button
                        type="button"
                        className={`${FIELD_INPUT_CLASS} flex items-center justify-between text-left cursor-pointer`}
                        style={FIELD_STYLE}
                        onClick={() => {
                            setPlantModalTarget('pending')
                            setShowPlantModal(true)
                        }}
                    >
                        <span>{newPending.plant ? getPlantName(newPending.plant) : 'Select plant…'}</span>
                        <i className="fas fa-chevron-down text-[9px]" style={{ color: 'var(--text-tertiary)' }} />
                    </button>
                </ModalField>
                <ModalField icon="fa-calendar-alt" label="Start Date" required>
                    <input
                        type="date"
                        value={newPending.startDate}
                        onChange={(e) => setNewPending({ ...newPending, startDate: e.target.value })}
                        className={`${FIELD_INPUT_CLASS} tabular-nums`}
                        style={FIELD_STYLE}
                    />
                </ModalField>
                <ModalField icon="fa-chalkboard-teacher" label="Assigned Trainer">
                    <input
                        type="text"
                        value={newPending.trainer}
                        onChange={(e) => setNewPending({ ...newPending, trainer: e.target.value })}
                        className={FIELD_INPUT_CLASS}
                        style={FIELD_STYLE}
                        placeholder="Enter trainer name (optional)"
                    />
                </ModalField>
            </FormModal>

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

export function ReadyMixInstructorReviewPlugin({ form, plants, weekIso }) {
    const snapshotData = form?.snapshot_data || {}
    const mixerTrainers = snapshotData.mixer_trainers || []
    const tractorTrainers = snapshotData.tractor_trainers || []
    const mixerPending = snapshotData.mixer_pending || []
    const tractorPending = snapshotData.tractor_pending || []
    const mixerTraining = snapshotData.mixer_training || []
    const tractorTraining = snapshotData.tractor_training || []
    const hiringGoals = form?.hiring_goals || {}
    const snapshotHasTerminated = Array.isArray(snapshotData.terminated_operators)
    const [liveTerminated, setLiveTerminated] = useState([])
    useEffect(() => {
        if (snapshotHasTerminated || !weekIso) return
        async function computeFromLive() {
            try {
                const plantCodes = plants ? new Set(plants.map((p) => p.plant_code || p.code).filter(Boolean)) : null
                const ops = await OperatorService.fetchOperators(plantCodes)
                const weekStart = new Date(weekIso)
                weekStart.setDate(weekStart.getDate() + 1)
                weekStart.setHours(0, 0, 0, 0)
                const weekEnd = new Date(weekStart)
                weekEnd.setDate(weekEnd.getDate() + 7)
                setLiveTerminated(
                    (ops || [])
                        .filter((op) => {
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
    }, [snapshotHasTerminated, weekIso, plants])
    const terminatedOperators = snapshotHasTerminated ? snapshotData.terminated_operators : liveTerminated
    return (
        <div className="flex flex-col gap-2.5 mt-2.5">
            <TrainersSection mixerTrainers={mixerTrainers} tractorTrainers={tractorTrainers} plants={plants} readOnly />
            <PendingSection mixerPending={mixerPending} tractorPending={tractorPending} plants={plants} readOnly />
            <TrainingSection mixerTraining={mixerTraining} tractorTraining={tractorTraining} plants={plants} readOnly />
            <TerminatedSection terminatedOperators={terminatedOperators} plants={plants} />
            <HiringGoalsSection plants={plants} hiringGoals={hiringGoals} readOnly />
        </div>
    )
}
