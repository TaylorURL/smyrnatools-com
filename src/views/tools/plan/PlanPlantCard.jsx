import React from 'react'

import { TimeInput } from '../../../app/components/common/PlanComponents'
import { MAX_YPH, TARGET_YPH, timeToMinutes } from '../../../utils/PlanUtility'

const CARD_WIDTH = 228
const YPH_DOMAIN_MAX = MAX_YPH * 1.2 // how far the bar track runs

function formatHours(h) {
    if (h == null || !Number.isFinite(h)) return null
    if (h < 10) return `${h.toFixed(1)}h`
    return `${Math.round(h)}h`
}

function pickYphStatus(yph) {
    if (yph == null) return { color: 'var(--text-tertiary)', label: 'No data' }
    if (yph > MAX_YPH) return { color: '#dc2626', label: 'Over capacity' }
    if (yph < TARGET_YPH - 0.3) return { color: '#d97706', label: 'Under target' }
    return { color: '#16a34a', label: 'On target' }
}

function pickRole({ leaveOffCount, recv, send, yphExceedsMax }) {
    if (yphExceedsMax) return { color: '#dc2626', icon: 'fa-triangle-exclamation', label: 'Over capacity' }
    if (leaveOffCount > 0) return { color: '#d97706', icon: 'fa-user-minus', label: `Leave ${leaveOffCount} off` }
    if (send > recv && send > 0) return { color: '#dc2626', icon: 'fa-up-right-from-square', label: `-${send} sent` }
    if (recv > send && recv > 0) return { color: '#16a34a', icon: 'fa-down-left-from-circle', label: `+${recv} recv` }
    return null
}

/**
 * Rich plant card for the PlanView top strip. Surfaces at-a-glance info a
 * dispatcher actually uses: plant name, operator/mixer counts, YPH with a
 * target-zone progress bar, shift span, earliest clock-in, and send/recv
 * deltas. Click the card to filter the plan by that plant; click again to
 * pop a production editor for fast first/last-job + yardage entry.
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
    const { code, eff, base, send, recv } = stat
    const firstMins = timeToMinutes(production.firstJobTime)
    const lastMins = timeToMinutes(production.lastJobTime)
    const hours = firstMins !== null && lastMins !== null && lastMins > firstMins ? (lastMins - firstMins) / 60 : null
    const yardage = parseFloat(production.totalYardage) || 0
    const yph = hours && yardage && eff > 0 ? Math.round((yardage / (hours * eff)) * 10) / 10 : null
    const minNeeded = hours && yardage ? Math.ceil(yardage / (hours * TARGET_YPH)) : null
    const leaveOffCount = yph !== null && yph < TARGET_YPH && minNeeded !== null ? Math.max(0, eff - minNeeded) : 0

    const status = pickYphStatus(yph)
    const role = pickRole({ leaveOffCount, recv, send, yphExceedsMax: yph != null && yph > MAX_YPH })
    const missingProduction = !production.firstJobTime || !production.lastJobTime || !production.totalYardage

    // Progress-bar geometry
    const barPct = yph != null ? Math.min(100, (yph / YPH_DOMAIN_MAX) * 100) : 0
    const targetPct = (TARGET_YPH / YPH_DOMAIN_MAX) * 100
    const maxPct = (MAX_YPH / YPH_DOMAIN_MAX) * 100

    const handleCardClick = (e) => {
        if (e.target.closest('[data-stop-card-click]')) return
        onSelect()
    }
    const openEditor = (e) => {
        e.stopPropagation()
        onTogglePopover()
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
                {/* Header — code tile, name, role pill */}
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
                            style={{
                                color: 'var(--text-primary)',
                                fontFamily: 'var(--font-heading)',
                                lineHeight: 1.15
                            }}
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
                        onClick={openEditor}
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

                {/* YPH bar — shows target + max zones and current position */}
                <div className="mt-2">
                    <div
                        className="relative h-1.5 rounded-full overflow-hidden"
                        style={{ background: 'var(--bg-tertiary)' }}
                    >
                        {/* Green "on-target" zone between TARGET_YPH and MAX_YPH */}
                        <div
                            className="absolute top-0 bottom-0"
                            style={{
                                background: 'rgba(22, 163, 74, 0.18)',
                                left: `${targetPct}%`,
                                width: `${maxPct - targetPct}%`
                            }}
                        />
                        {/* Current yph fill */}
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
                        {/* Target tick */}
                        <div
                            className="absolute top-0 bottom-0 border-r"
                            style={{ borderColor: 'rgba(22, 163, 74, 0.55)', left: `${targetPct}%`, width: 1 }}
                            title={`Target ${TARGET_YPH} yph`}
                        />
                        {/* Max tick */}
                        <div
                            className="absolute top-0 bottom-0 border-r"
                            style={{ borderColor: 'rgba(220, 38, 38, 0.55)', left: `${maxPct}%`, width: 1 }}
                            title={`Max ${MAX_YPH} yph`}
                        />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                            {yardage > 0 ? (
                                `${yardage} yd`
                            ) : (
                                <span style={{ color: 'var(--text-tertiary)' }}>— yd</span>
                            )}
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

                {/* Time range + shift */}
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

                {/* Bottom row — earliest clock-in + leave-off warning + edit hint */}
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
            </button>

            {/* Centered edit modal */}
            {isPopoverOpen && (
                <div
                    data-stop-card-click
                    onClick={onTogglePopover}
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fadeIn"
                    style={{ background: 'rgba(0,0,0,0.45)' }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-xl shadow-xl w-full max-w-[360px]"
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-medium)' }}
                    >
                        <div
                            className="flex items-center gap-2.5 px-4 py-3 border-b"
                            style={{ borderColor: 'var(--border-light)' }}
                        >
                            <div
                                className="flex items-center justify-center rounded-lg shrink-0"
                                style={{
                                    background: accentColor,
                                    color: '#fff',
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
                                    className="text-sm font-bold"
                                    style={{
                                        color: 'var(--text-primary)',
                                        fontFamily: 'var(--font-heading)',
                                        lineHeight: 1.15
                                    }}
                                >
                                    {plantName || `Plant ${code}`}
                                </div>
                                <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                    Edit production
                                </div>
                            </div>
                            <button
                                onClick={onTogglePopover}
                                className="w-8 h-8 rounded-lg border-none cursor-pointer flex items-center justify-center"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                            >
                                <i className="fas fa-times text-xs" />
                            </button>
                        </div>
                        <div className="px-4 py-4 flex flex-col gap-3">
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <div
                                        className="text-[9px] font-bold uppercase tracking-wider mb-1"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        First Job
                                    </div>
                                    <TimeInput
                                        value={production.firstJobTime || ''}
                                        onChange={(val) => updatePlantProduction(code, 'firstJobTime', val)}
                                        className="!w-full"
                                    />
                                </div>
                                <div>
                                    <div
                                        className="text-[9px] font-bold uppercase tracking-wider mb-1"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        Last Job
                                    </div>
                                    <TimeInput
                                        value={production.lastJobTime || ''}
                                        onChange={(val) => updatePlantProduction(code, 'lastJobTime', val)}
                                        className="!w-full"
                                    />
                                </div>
                                <div>
                                    <div
                                        className="text-[9px] font-bold uppercase tracking-wider mb-1"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        Yards
                                    </div>
                                    <input
                                        type="number"
                                        value={production.totalYardage || ''}
                                        onChange={(e) => updatePlantProduction(code, 'totalYardage', e.target.value)}
                                        placeholder="0"
                                        className="border rounded-md text-sm outline-none font-mono text-center py-1.5 px-1 w-full"
                                        style={{
                                            backgroundColor: 'var(--bg-primary)',
                                            borderColor: 'var(--border-medium)',
                                            color: 'var(--text-primary)'
                                        }}
                                    />
                                </div>
                            </div>
                            <div
                                className="rounded-lg px-3 py-2 flex items-center justify-between"
                                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                            >
                                <div>
                                    <div
                                        className="text-[9px] font-bold uppercase tracking-wider"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    >
                                        Yards / hr / op
                                    </div>
                                    <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                        {status.label}
                                    </div>
                                </div>
                                <div
                                    className="text-lg font-bold"
                                    style={{ color: status.color, fontFamily: 'var(--font-heading)' }}
                                >
                                    {yph != null ? yph : '—'}
                                </div>
                            </div>
                        </div>
                        <div
                            className="px-4 py-3 flex justify-end gap-2 border-t"
                            style={{ borderColor: 'var(--border-light)' }}
                        >
                            <button
                                onClick={onTogglePopover}
                                className="px-4 py-2 rounded-lg text-sm font-semibold border-none cursor-pointer"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default PlanPlantCard
