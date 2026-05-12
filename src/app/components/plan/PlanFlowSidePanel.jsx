import React from 'react'

/** Empty-state shown when no plant is selected. */
export function PlanFlowEmptyPanel({ accentColor }) {
    return (
        <div className="flex flex-col items-center justify-center text-center p-6 flex-1">
            <i className="fas fa-arrow-pointer text-3xl mb-3 opacity-60" style={{ color: accentColor }} />
            <div className="font-bold text-[15px] mb-1 text-text-primary font-heading">Pick a plant</div>
            <div className="text-[12px] max-w-[240px] text-text-secondary">
                Click a node to inspect it, edit its routes, or send trucks to another plant.
            </div>
        </div>
    )
}

/** Selected-plant overview: stats, missing-operator editor, route list. */
export function PlanFlowPlantOverview({
    accentColor,
    calcClockIn,
    canEdit,
    getTravelTime,
    inbound,
    missingOperators = 0,
    mixerCountsByPlant,
    onAddRoute,
    onDeleteRoute,
    onEditRoute,
    onMissingOperatorsChange,
    outbound,
    production,
    selected,
    yphByCode,
    yphColorFor
}) {
    const yph = yphByCode[selected.code]
    const baseCount = mixerCountsByPlant[selected.code] || 0
    const hasMissing = missingOperators > 0
    const remaining = Math.max(0, baseCount - missingOperators)
    return (
        <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <div
                    className="flex items-center justify-center rounded-xl text-white font-heading font-bold h-11 w-11"
                    style={{ background: accentColor, fontSize: 16 }}
                >
                    {selected.code}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-[18px] text-text-primary font-heading">Plant {selected.code}</div>
                    <div className="text-[11px] text-text-secondary">
                        {baseCount} base
                        {hasMissing && (
                            <>
                                {' '}
                                <span className="text-red-600">-{missingOperators} missing</span>
                            </>
                        )}{' '}
                        · <span className="text-red-600">-{selected.send || 0} sent</span> ·{' '}
                        <span className="text-green-600">+{selected.recv || 0} recv</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <StatTile label="Eff ops" value={selected.eff} />
                <StatTile label="Yardage" value={production.totalYardage || '—'} />
                <StatTile
                    label="YPH"
                    value={yph ?? '—'}
                    color={yph != null ? yphColorFor(yph, accentColor) : undefined}
                />
            </div>

            {/* Missing-operator editor — subtracts from the plant's base for
                every pool / truck calculation across Plan, Planner & Schedule. */}
            {canEdit && onMissingOperatorsChange && (
                <MissingOperatorsEditor
                    baseCount={baseCount}
                    hasMissing={hasMissing}
                    missingOperators={missingOperators}
                    onChange={onMissingOperatorsChange}
                    remaining={remaining}
                />
            )}

            {canEdit && (
                <button
                    onClick={onAddRoute}
                    className="border-none rounded-lg cursor-pointer text-sm font-semibold text-white flex items-center justify-center gap-2 py-2.5"
                    style={{ background: accentColor }}
                >
                    <i className="fas fa-truck" />
                    Send Trucks from {selected.code}
                </button>
            )}

            <Section title="Outbound" count={outbound.length} icon="fa-arrow-up-from-bracket">
                {outbound.length === 0 && <EmptyHint>No outbound routes from {selected.code}</EmptyHint>}
                {outbound.map((assignment) => (
                    <RouteRow
                        key={`out-${assignment.idx}`}
                        accentColor={accentColor}
                        assignment={assignment}
                        canEdit={canEdit}
                        onEdit={() => onEditRoute(assignment.idx)}
                        onDelete={() => onDeleteRoute(assignment.idx)}
                        travel={getTravelTime?.(assignment.fromPlant, assignment.toPlant)}
                        clockIn={
                            assignment.time && calcClockIn
                                ? calcClockIn(assignment.time, assignment.fromPlant, assignment.toPlant)
                                : null
                        }
                    />
                ))}
            </Section>

            <Section title="Inbound" count={inbound.length} icon="fa-arrow-down-to-bracket">
                {inbound.length === 0 && <EmptyHint>No inbound routes to {selected.code}</EmptyHint>}
                {inbound.map((assignment) => (
                    <RouteRow
                        key={`in-${assignment.idx}`}
                        accentColor={accentColor}
                        assignment={assignment}
                        canEdit={canEdit}
                        onEdit={() => onEditRoute(assignment.idx)}
                        onDelete={() => onDeleteRoute(assignment.idx)}
                        travel={getTravelTime?.(assignment.fromPlant, assignment.toPlant)}
                        clockIn={
                            assignment.time && calcClockIn
                                ? calcClockIn(assignment.time, assignment.fromPlant, assignment.toPlant)
                                : null
                        }
                    />
                ))}
            </Section>
        </div>
    )
}

function MissingOperatorsEditor({ baseCount, hasMissing, missingOperators, onChange, remaining }) {
    return (
        <div
            className="rounded-lg p-3"
            style={{
                background: hasMissing ? 'rgba(220, 38, 38, 0.06)' : 'var(--bg-secondary)',
                border: `1px solid ${hasMissing ? 'rgba(220, 38, 38, 0.35)' : 'var(--border-light)'}`
            }}
        >
            <div className="flex items-start gap-2">
                <i
                    className="fas fa-user-slash text-[13px] mt-0.5"
                    style={{ color: hasMissing ? '#dc2626' : 'var(--text-tertiary)' }}
                />
                <div className="flex-1 min-w-0">
                    <div
                        className="text-[12px] font-bold"
                        style={{ color: hasMissing ? '#991b1b' : 'var(--text-primary)' }}
                    >
                        Missing operators
                    </div>
                    <div className="text-[10.5px] leading-snug text-text-secondary">
                        {hasMissing
                            ? `Plant runs on ${remaining} active mixer${remaining === 1 ? '' : 's'} today (${baseCount} assigned − ${missingOperators} out).`
                            : 'Note anyone out sick / vacation to subtract from this plant’s pool.'}
                    </div>
                </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onChange(Math.max(0, missingOperators - 1))}
                    disabled={missingOperators === 0}
                    className="border-none rounded-md cursor-pointer text-[13px] font-bold flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed bg-bg-primary border border-border-medium text-text-primary h-8 w-8"
                    title="Subtract one missing operator"
                >
                    −
                </button>
                <input
                    type="number"
                    min={0}
                    max={baseCount || 50}
                    value={missingOperators}
                    onChange={(event) => {
                        const next = Math.max(0, parseInt(event.target.value, 10) || 0)
                        onChange(next)
                    }}
                    className="flex-1 px-2 py-1.5 rounded-md text-sm font-mono text-center border bg-bg-primary border-border-medium text-text-primary"
                />
                <button
                    type="button"
                    onClick={() => onChange(Math.min(baseCount || missingOperators + 1, missingOperators + 1))}
                    disabled={baseCount > 0 && missingOperators >= baseCount}
                    className="border-none rounded-md cursor-pointer text-[13px] font-bold flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed bg-bg-primary border border-border-medium text-text-primary h-8 w-8"
                    title="Add one missing operator"
                >
                    +
                </button>
                {hasMissing && (
                    <button
                        type="button"
                        onClick={() => onChange(0)}
                        className="border-none rounded-md cursor-pointer text-[11px] font-semibold px-2.5 py-1.5 bg-bg-primary border border-border-medium text-text-secondary"
                        title="Clear — everyone is in"
                    >
                        Reset
                    </button>
                )}
            </div>
        </div>
    )
}

function Section({ children, count, icon, title }) {
    return (
        <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-2 text-text-secondary">
                <i className={`fas ${icon} text-[9px]`} />
                {title} ({count})
            </div>
            <div className="flex flex-col gap-1.5">{children}</div>
        </div>
    )
}

function EmptyHint({ children }) {
    return (
        <div className="text-[12px] italic px-3 py-4 text-center rounded-lg bg-bg-secondary text-text-tertiary">
            {children}
        </div>
    )
}

function RouteRow({ accentColor, assignment, canEdit, clockIn, onDelete, onEdit, travel }) {
    const ops = parseInt(assignment.driverCount, 10) || 0
    return (
        <div className="rounded-lg p-2.5 flex items-center gap-2.5 bg-bg-secondary border border-border-light">
            <div className="flex items-center gap-1 font-bold text-[12px] font-heading" style={{ color: accentColor }}>
                <span>{assignment.fromPlant}</span>
                <i className="fas fa-arrow-right text-[9px]" />
                <span>{assignment.toPlant}</span>
            </div>
            <div className="flex-1" />
            <div className="text-right">
                <div className="text-[13px] font-bold leading-none text-text-primary font-heading">
                    {assignment.time || '—'}
                </div>
                <div className="text-[10px] text-text-secondary">
                    {ops} op{ops === 1 ? '' : 's'}
                    {travel != null && <> · {travel}m</>}
                </div>
                {clockIn && <div className="text-[10px] font-semibold text-green-600">clock {clockIn}</div>}
                {assignment.leaveTime && (
                    <div className="text-[10px] font-semibold" style={{ color: accentColor }}>
                        leave {assignment.leaveTime}
                    </div>
                )}
            </div>
            {canEdit && (
                <div className="flex flex-col gap-1">
                    <button
                        onClick={onEdit}
                        className="w-6 h-6 rounded border-none bg-transparent cursor-pointer text-text-secondary"
                        title="Edit"
                    >
                        <i className="fas fa-pen text-[10px]" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="w-6 h-6 rounded border-none bg-transparent cursor-pointer text-red-600"
                        title="Delete"
                    >
                        <i className="fas fa-trash text-[10px]" />
                    </button>
                </div>
            )}
        </div>
    )
}

function StatTile({ color, label, value }) {
    return (
        <div className="rounded-lg px-3 py-2 bg-bg-secondary border border-border-light">
            <div className="text-[9px] font-bold uppercase tracking-wider text-text-secondary">{label}</div>
            <div className="font-bold text-[18px] font-heading" style={{ color: color || 'var(--text-primary)' }}>
                {value}
            </div>
        </div>
    )
}
