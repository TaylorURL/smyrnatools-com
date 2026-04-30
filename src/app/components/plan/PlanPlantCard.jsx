import React from 'react'

import { MAX_YPH, TARGET_YPH, timeToMinutes } from '../../../utils/PlanUtility'
import { PlanPlantProductionEditor } from './PlanPlantProductionEditor'

const CARD_WIDTH = 228
const YPH_DOMAIN_MAX = MAX_YPH * 1.2
const TARGET_PCT = (TARGET_YPH / YPH_DOMAIN_MAX) * 100
const MAX_PCT = (MAX_YPH / YPH_DOMAIN_MAX) * 100

const formatHours = (hours) => {
    if (hours == null || !Number.isFinite(hours)) return null
    if (hours < 10) return `${hours.toFixed(1)}h`
    return `${Math.round(hours)}h`
}

const pickYphStatus = (yph) => {
    if (yph == null) return { color: 'var(--text-tertiary)', label: 'No data' }
    if (yph > MAX_YPH) return { color: '#dc2626', label: 'Over capacity' }
    if (yph < TARGET_YPH - 0.3) return { color: '#d97706', label: 'Under target' }
    return { color: '#16a34a', label: 'On target' }
}

const pickRole = ({ leaveOffCount, recv, send, yphExceedsMax }) => {
    if (yphExceedsMax) return { color: '#dc2626', icon: 'fa-triangle-exclamation', label: 'Over capacity' }
    if (leaveOffCount > 0) return { color: '#d97706', icon: 'fa-user-minus', label: `Leave ${leaveOffCount} off` }
    if (send > recv && send > 0) return { color: '#dc2626', icon: 'fa-up-right-from-square', label: `-${send} sent` }
    if (recv > send && recv > 0) return { color: '#16a34a', icon: 'fa-down-left-from-circle', label: `+${recv} recv` }
    return null
}

/** Derive the YPH-related metrics that drive both the bar fill and the
 *  leave-off badge. Returned shape is consumed by every sub-component. */
function deriveCardMetrics(stat, production) {
    const { eff, recv, send } = stat
    const firstMins = timeToMinutes(production.firstJobTime)
    const lastMins = timeToMinutes(production.lastJobTime)
    const hours = firstMins !== null && lastMins !== null && lastMins > firstMins ? (lastMins - firstMins) / 60 : null
    const yardage = parseFloat(production.totalYardage) || 0
    const yph = hours && yardage && eff > 0 ? Math.round((yardage / (hours * eff)) * 10) / 10 : null
    const minNeeded = hours && yardage ? Math.ceil(yardage / (hours * TARGET_YPH)) : null
    const leaveOffCount = yph !== null && yph < TARGET_YPH && minNeeded !== null ? Math.max(0, eff - minNeeded) : 0
    const status = pickYphStatus(yph)
    const role = pickRole({ leaveOffCount, recv, send, yphExceedsMax: yph != null && yph > MAX_YPH })
    return { hours, leaveOffCount, role, status, yardage, yph }
}

/**
 * Rich plant card for the PlanView top strip. Surfaces at-a-glance info a
 * dispatcher actually uses: plant name, operator/mixer counts, YPH with a
 * target-zone progress bar, shift span, earliest clock-in, and send/recv
 * deltas. Click the card to filter the plan by that plant; click the pencil
 * to pop a production editor for fast first/last-job + yardage entry.
 */
function PlanPlantCard({
    accentColor,
    earliestArrival,
    earliestClockIn,
    isPopoverOpen,
    isSelected,
    onSelect,
    onTogglePopover,
    plantName,
    production,
    stat,
    updatePlantProduction
}) {
    const metrics = deriveCardMetrics(stat, production)
    const missingProduction = !production.firstJobTime || !production.lastJobTime || !production.totalYardage
    const handleCardClick = (event) => {
        if (event.target.closest('[data-stop-card-click]')) return
        onSelect()
    }

    return (
        <div className="relative shrink-0">
            <button
                onClick={handleCardClick}
                className="flex flex-col rounded-xl px-3 py-2 border-2 cursor-pointer text-left transition-all"
                style={{
                    background: isSelected ? `${accentColor}10` : 'var(--bg-primary)',
                    borderColor: isSelected ? accentColor : 'var(--border-light)',
                    width: CARD_WIDTH
                }}
            >
                <CardHeader
                    accentColor={accentColor}
                    isPopoverOpen={isPopoverOpen}
                    isSelected={isSelected}
                    plantName={plantName}
                    role={metrics.role}
                    stat={stat}
                    onEdit={onTogglePopover}
                />
                <CardYphBar metrics={metrics} />
                <CardTimeRange hours={metrics.hours} production={production} />
                <CardBottomRow
                    code={stat.code}
                    earliestArrival={earliestArrival}
                    earliestClockIn={earliestClockIn}
                    eff={stat.eff}
                    leaveOffCount={metrics.leaveOffCount}
                    missingProduction={missingProduction}
                />
            </button>
            {isPopoverOpen && (
                <PlanPlantProductionEditor
                    accentColor={accentColor}
                    code={stat.code}
                    plantName={plantName}
                    production={production}
                    status={metrics.status}
                    updatePlantProduction={updatePlantProduction}
                    yph={metrics.yph}
                    onTogglePopover={onTogglePopover}
                />
            )}
        </div>
    )
}

function CardHeader({ accentColor, isPopoverOpen, isSelected, plantName, role, stat, onEdit }) {
    const { code, eff, base, send, recv } = stat
    return (
        <div className="flex items-center gap-2">
            <div
                className="flex items-center justify-center rounded-lg shrink-0"
                style={{
                    background: isSelected ? accentColor : `${accentColor}14`,
                    color: isSelected ? '#fff' : accentColor,
                    fontFamily: 'var(--font-heading)',
                    fontSize: 13,
                    fontWeight: 700,
                    height: 32,
                    width: 32
                }}
            >
                {code}
            </div>
            <div className="flex-1 min-w-0">
                <div
                    className="text-[12px] font-semibold truncate"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', lineHeight: 1.15 }}
                    title={plantName || code}
                >
                    {plantName || `Plant ${code}`}
                </div>
                <div
                    className="text-[10px] flex items-center gap-1.5 mt-0.5"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    <span>
                        <b style={{ color: 'var(--text-primary)' }}>{eff}</b> op{eff === 1 ? '' : 's'}
                    </span>
                    <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                    <span>
                        {base} base
                        {send > 0 && <span style={{ color: '#dc2626' }}> -{send}</span>}
                        {recv > 0 && <span style={{ color: '#16a34a' }}> +{recv}</span>}
                    </span>
                </div>
            </div>
            {role && (
                <span
                    className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0"
                    style={{ background: `${role.color}18`, color: role.color }}
                    title={role.label}
                >
                    <i className={`fas ${role.icon} text-[8px]`} />
                </span>
            )}
            <button
                data-stop-card-click
                type="button"
                onClick={(event) => {
                    event.stopPropagation()
                    onEdit()
                }}
                className="shrink-0 w-6 h-6 rounded-md border-none cursor-pointer flex items-center justify-center transition-colors"
                style={{
                    background: isPopoverOpen ? accentColor : 'var(--bg-tertiary)',
                    color: isPopoverOpen ? '#fff' : 'var(--text-secondary)'
                }}
                title={`Edit ${code} production`}
            >
                <i className="fas fa-pen text-[9px]" />
            </button>
        </div>
    )
}

function CardYphBar({ metrics }) {
    const { status, yardage, yph } = metrics
    const barPct = yph != null ? Math.min(100, (yph / YPH_DOMAIN_MAX) * 100) : 0
    return (
        <div className="mt-2">
            <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                <div
                    className="absolute top-0 bottom-0"
                    style={{
                        background: 'rgba(22, 163, 74, 0.18)',
                        left: `${TARGET_PCT}%`,
                        width: `${MAX_PCT - TARGET_PCT}%`
                    }}
                />
                {yph != null && (
                    <div
                        className="absolute top-0 bottom-0 rounded-full"
                        style={{
                            background: status.color,
                            left: 0,
                            transition: 'width 0.3s ease, background 0.3s ease',
                            width: `${barPct}%`
                        }}
                    />
                )}
                <div
                    className="absolute top-0 bottom-0 border-r"
                    style={{ borderColor: 'rgba(22, 163, 74, 0.55)', left: `${TARGET_PCT}%`, width: 1 }}
                    title={`Target ${TARGET_YPH} yph`}
                />
                <div
                    className="absolute top-0 bottom-0 border-r"
                    style={{ borderColor: 'rgba(220, 38, 38, 0.55)', left: `${MAX_PCT}%`, width: 1 }}
                    title={`Max ${MAX_YPH} yph`}
                />
            </div>
            <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {yardage > 0 ? `${yardage} yd` : <span style={{ color: 'var(--text-tertiary)' }}>— yd</span>}
                </span>
                <span
                    className="text-[11px] font-bold flex items-center gap-1"
                    style={{ color: status.color, fontFamily: 'var(--font-heading)' }}
                >
                    {yph != null ? `${yph}` : '—'}
                    <span className="text-[9px] font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                        yph
                    </span>
                </span>
            </div>
        </div>
    )
}

function CardTimeRange({ hours, production }) {
    return (
        <div
            className="flex items-center gap-1.5 text-[10px] font-mono mt-1.5"
            style={{ color: 'var(--text-secondary)' }}
        >
            {production.firstJobTime && production.lastJobTime ? (
                <>
                    <i className="fas fa-sun text-[9px]" style={{ color: '#f59e0b' }} />
                    <span>{production.firstJobTime}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                    <span>{production.lastJobTime}</span>
                    {hours && (
                        <span className="ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                            {formatHours(hours)}
                        </span>
                    )}
                </>
            ) : (
                <span style={{ color: 'var(--text-tertiary)' }}>
                    <i className="fas fa-circle-exclamation mr-1" />
                    Add production times
                </span>
            )}
        </div>
    )
}

function CardBottomRow({ code, earliestArrival, earliestClockIn, eff, leaveOffCount, missingProduction }) {
    return (
        <div className="flex items-center gap-2 mt-1 text-[10px]">
            {earliestClockIn ? (
                <span
                    className="flex items-center gap-1 font-semibold"
                    style={{ color: '#16a34a' }}
                    title={`Earliest clock-in for operators sending from ${code}`}
                >
                    <i className="fas fa-clock text-[9px]" />
                    {earliestClockIn}
                </span>
            ) : earliestArrival ? (
                <span
                    className="flex items-center gap-1 font-semibold"
                    style={{ color: '#16a34a' }}
                    title={`Earliest incoming arrival at ${code}`}
                >
                    <i className="fas fa-plane-arrival text-[9px]" />
                    {earliestArrival}
                </span>
            ) : (
                <span style={{ color: 'var(--text-tertiary)' }}>
                    <i className="fas fa-clock text-[9px] mr-1" />
                    No routes yet
                </span>
            )}
            {leaveOffCount > 0 && (
                <span
                    className="flex items-center gap-1 font-bold ml-auto"
                    style={{ color: '#d97706' }}
                    title={`${eff - leaveOffCount} operators meets target; ${leaveOffCount} can stay home`}
                >
                    <i className="fas fa-user-minus text-[8px]" />-{leaveOffCount}
                </span>
            )}
            {!leaveOffCount && missingProduction && (
                <span className="ml-auto flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                    <i className="fas fa-pen text-[8px]" />
                    tap the pencil to edit
                </span>
            )}
        </div>
    )
}

export default PlanPlantCard
