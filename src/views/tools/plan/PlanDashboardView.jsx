import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { timeToMinutes } from '../../../utils/PlanUtility'
import PlanFlowPreview from './PlanFlowPreview'
import PlanMiniTimeline from './PlanMiniTimeline'
import PlanNotesSection from './PlanNotesSection'

/* ── Helpers ────────────────────────────────────────────────────────────── */

const subtractMinutesFromTime = (time, minutes) => {
    const mins = timeToMinutes(time)
    if (mins === null || !Number.isFinite(minutes)) return null
    const target = Math.max(0, mins - minutes)
    const h = Math.floor(target / 60)
    const m = target % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Daily plan metadata (special + QC attention jobs) is persisted by
 * piggy-backing on the plan's `plant_production` JSONB blob via a
 * reserved `_meta` key. That lets us ship persistence without a DB
 * schema change — every writer goes through these two helpers.
 */
const PLAN_META_KEY = '_meta'
const readMeta = (plantProduction) => plantProduction?.[PLAN_META_KEY] || {}
const writeMeta = (setPlantProduction, updater) => {
    setPlantProduction?.((prev) => {
        const next = { ...(prev || {}) }
        const current = next[PLAN_META_KEY] || {}
        const nextMeta = typeof updater === 'function' ? updater(current) : updater
        next[PLAN_META_KEY] = nextMeta
        return next
    })
}

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const emptyJob = () => ({ contractor: '', description: '', id: makeId(), plant: '', time: '', title: '' })

/* ── Sub-components ────────────────────────────────────────────────────── */

function StatCard({ accent, hint, icon, label, value, valueColor }) {
    return (
        <div
            className="rounded-xl p-4 flex flex-col gap-0.5"
            style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)'
            }}
        >
            <div className="flex items-center gap-2">
                {icon && (
                    <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${accent}14`, color: accent }}
                    >
                        <i className={`fas ${icon} text-[11px]`} />
                    </div>
                )}
                <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    {label}
                </span>
            </div>
            <div
                className="font-bold text-[26px] leading-none mt-1"
                style={{ color: valueColor || 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
            >
                {value}
            </div>
            {hint && (
                <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {hint}
                </div>
            )}
        </div>
    )
}

function Card({ children, icon, iconColor, id, right, title }) {
    return (
        <section
            id={id}
            className="rounded-xl scroll-mt-4"
            style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)'
            }}
        >
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
                {icon && (
                    <i className={`fas ${icon} text-[12px]`} style={{ color: iconColor || 'var(--text-secondary)' }} />
                )}
                <span
                    className="text-[12px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                >
                    {title}
                </span>
                <div className="flex-1" />
                {right}
            </div>
            <div className="p-4">{children}</div>
        </section>
    )
}

function ChecklistRow({ accent, checked, onToggle, subtitle, text, time }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-none cursor-pointer text-left transition-colors"
            style={{
                background: checked ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                opacity: checked ? 0.65 : 1
            }}
        >
            <div
                className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                style={{
                    background: checked ? accent : 'var(--bg-primary)',
                    border: `1.5px solid ${checked ? accent : 'var(--border-medium)'}`,
                    color: '#fff'
                }}
            >
                {checked && <i className="fas fa-check text-[9px]" />}
            </div>
            <div className="flex-1 min-w-0">
                <div
                    className="text-[13px] font-semibold"
                    style={{
                        color: 'var(--text-primary)',
                        textDecoration: checked ? 'line-through' : 'none'
                    }}
                >
                    {text}
                </div>
                {subtitle && (
                    <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        {subtitle}
                    </div>
                )}
            </div>
            {time && (
                <div
                    className="font-bold text-sm shrink-0 font-mono"
                    style={{ color: checked ? 'var(--text-secondary)' : accent, fontFamily: 'var(--font-heading)' }}
                >
                    {time}
                </div>
            )}
        </button>
    )
}

function JobEditor({ accent, job, onCancel, onSave, plants, tint, titleLabel = 'Title' }) {
    const [draft, setDraft] = useState(job)
    const isNew = !job.title && !job.description
    useEffect(() => {
        setDraft(job)
    }, [job])
    const update = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }))
    const canSave = (draft.title || '').trim().length > 0
    return (
        <div
            className="rounded-lg p-3 flex flex-col gap-2"
            style={{
                background: 'var(--bg-primary)',
                border: `1.5px solid ${tint || accent}`,
                boxShadow: 'var(--shadow-sm)'
            }}
        >
            <div className="grid grid-cols-2 gap-2">
                <input
                    autoFocus
                    type="text"
                    value={draft.title || ''}
                    onChange={(e) => update('title', e.target.value)}
                    placeholder={titleLabel}
                    className="col-span-2 w-full px-3 py-2 rounded-md text-sm font-semibold outline-none"
                    style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-primary)'
                    }}
                />
                <select
                    value={draft.plant || ''}
                    onChange={(e) => update('plant', e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm"
                    style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-medium)',
                        color: 'var(--text-primary)'
                    }}
                >
                    <option value="">Plant…</option>
                    {(plants || []).map((p) => (
                        <option key={p.plant_code} value={p.plant_code}>
                            {p.plant_code}
                            {p.plant_name ? ` — ${p.plant_name}` : ''}
                        </option>
                    ))}
                </select>
                <input
                    type="time"
                    value={draft.time || ''}
                    onChange={(e) => update('time', e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm font-mono"
                    style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-medium)',
                        color: 'var(--text-primary)'
                    }}
                />
                <input
                    type="text"
                    value={draft.contractor || ''}
                    onChange={(e) => update('contractor', e.target.value)}
                    placeholder="Contractor or job ref"
                    className="col-span-2 w-full px-3 py-2 rounded-md text-sm"
                    style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-medium)',
                        color: 'var(--text-primary)'
                    }}
                />
                <textarea
                    value={draft.description || ''}
                    onChange={(e) => update('description', e.target.value)}
                    placeholder="What needs attention? Any crew / spec / timing notes…"
                    rows={3}
                    className="col-span-2 w-full px-3 py-2 rounded-md text-sm outline-none resize-none"
                    style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-medium)',
                        color: 'var(--text-primary)'
                    }}
                />
            </div>
            <div className="flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-3 py-1.5 rounded-md text-[12px] font-semibold border-none cursor-pointer"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => canSave && onSave(draft)}
                    disabled={!canSave}
                    className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-white border-none cursor-pointer disabled:opacity-50"
                    style={{ background: tint || accent }}
                >
                    <i className="fas fa-check mr-1" />
                    {isNew ? 'Add job' : 'Save changes'}
                </button>
            </div>
        </div>
    )
}

function JobRow({ accent, job, onDelete, onEdit, plantNameByCode, tint }) {
    return (
        <div
            className="rounded-lg p-3 flex items-start gap-3"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
        >
            <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${tint || accent}18`, color: tint || accent }}
            >
                <i className="fas fa-circle-exclamation text-[12px]" />
            </div>
            <div className="flex-1 min-w-0">
                <div
                    className="text-[14px] font-semibold"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                >
                    {job.title || 'Untitled'}
                </div>
                <div
                    className="text-[11px] flex items-center gap-1.5 flex-wrap"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    {job.plant && (
                        <span
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
                            style={{ background: 'var(--bg-tertiary)' }}
                        >
                            <i className="fas fa-industry text-[9px]" />
                            {job.plant}
                            {plantNameByCode?.[job.plant] ? ` · ${plantNameByCode[job.plant]}` : ''}
                        </span>
                    )}
                    {job.time && (
                        <span className="inline-flex items-center gap-1 font-mono">
                            <i className="fas fa-clock text-[9px]" />
                            {job.time}
                        </span>
                    )}
                    {job.contractor && (
                        <span className="inline-flex items-center gap-1">
                            <i className="fas fa-helmet-safety text-[9px]" />
                            {job.contractor}
                        </span>
                    )}
                </div>
                {job.description && (
                    <div className="text-[12px] mt-1.5 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                        {job.description}
                    </div>
                )}
            </div>
            <div className="flex flex-col gap-1 shrink-0">
                <button
                    onClick={onEdit}
                    className="w-7 h-7 rounded-md border-none cursor-pointer"
                    style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
                    title="Edit"
                >
                    <i className="fas fa-pen text-[10px]" />
                </button>
                <button
                    onClick={onDelete}
                    className="w-7 h-7 rounded-md border-none cursor-pointer"
                    style={{ background: 'var(--bg-primary)', color: '#dc2626' }}
                    title="Delete"
                >
                    <i className="fas fa-trash text-[10px]" />
                </button>
            </div>
        </div>
    )
}

function JobsSection({
    accent,
    emptyHint,
    icon,
    iconColor,
    id,
    jobs,
    onCreate,
    onDelete,
    onSave,
    plantNameByCode,
    plants,
    tint,
    title,
    titleLabel
}) {
    const [editingId, setEditingId] = useState(null)
    const [draftJob, setDraftJob] = useState(null)

    const startCreate = () => {
        const fresh = emptyJob()
        setDraftJob(fresh)
        setEditingId(fresh.id)
    }
    const startEdit = (job) => {
        setDraftJob(job)
        setEditingId(job.id)
    }
    const cancel = () => {
        setDraftJob(null)
        setEditingId(null)
    }
    const save = (draft) => {
        if (jobs.some((j) => j.id === draft.id)) onSave(draft)
        else onCreate(draft)
        cancel()
    }

    return (
        <Card
            id={id}
            title={`${title} · ${jobs.length}`}
            icon={icon}
            iconColor={iconColor}
            right={
                <button
                    onClick={startCreate}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-white border-none cursor-pointer"
                    style={{ background: tint || accent }}
                >
                    <i className="fas fa-plus mr-1" /> Add
                </button>
            }
        >
            <div className="flex flex-col gap-2">
                {jobs.length === 0 && !draftJob && (
                    <div
                        className="rounded-lg p-4 text-center text-[12px] italic"
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
                    >
                        {emptyHint}
                    </div>
                )}
                {jobs.map((job) =>
                    editingId === job.id ? (
                        <JobEditor
                            key={job.id}
                            accent={accent}
                            tint={tint}
                            job={draftJob}
                            plants={plants}
                            onCancel={cancel}
                            onSave={save}
                            titleLabel={titleLabel}
                        />
                    ) : (
                        <JobRow
                            key={job.id}
                            accent={accent}
                            tint={tint}
                            job={job}
                            plantNameByCode={plantNameByCode}
                            onEdit={() => startEdit(job)}
                            onDelete={() => onDelete(job.id)}
                        />
                    )
                )}
                {draftJob && editingId === draftJob.id && !jobs.some((j) => j.id === draftJob.id) && (
                    <JobEditor
                        accent={accent}
                        tint={tint}
                        job={draftJob}
                        plants={plants}
                        onCancel={cancel}
                        onSave={save}
                        titleLabel={titleLabel}
                    />
                )}
            </div>
        </Card>
    )
}

/* ── Side nav ──────────────────────────────────────────────────────────── */

const YOUR_SECTION_LABELS = {
    dispatch: 'Your Dispatch',
    district: 'Your District',
    plant: 'Your Plant',
    region: 'Your Region'
}
const YOUR_SECTION_ICONS = {
    dispatch: 'fa-truck-fast',
    district: 'fa-map-location-dot',
    plant: 'fa-user-tie',
    region: 'fa-map'
}

const NAV_SECTIONS = [
    { icon: 'fa-chart-line', id: 'overview', label: 'Overview' },
    { icon: 'fa-sticky-note', id: 'notes', label: 'Notes' },
    { icon: 'fa-user-tie', id: 'my-plant', label: 'Your Plant', requiresYourScope: true },
    { icon: 'fa-project-diagram', id: 'flow-preview', label: 'Flow' },
    { icon: 'fa-circle-exclamation', id: 'special', label: 'Special Attention' },
    { icon: 'fa-vial-circle-check', id: 'qc', label: 'QC Attention' },
    { icon: 'fa-triangle-exclamation', id: 'insights', label: 'Plan Insights' },
    { icon: 'fa-cubes', id: 'yardage', label: 'Yardage by Plant' },
    { icon: 'fa-chart-gantt', id: 'timeline', label: 'Timeline' }
]

function SideNav({
    accent,
    activeId,
    hasInsights,
    hasYourScope,
    onJump,
    sections,
    specialCount,
    qcCount,
    yourSectionLabel,
    yourSectionIcon
}) {
    return (
        <aside className="hidden lg:block sticky top-0 self-start py-5 pr-3" style={{ width: 240 }}>
            <div
                className="rounded-xl p-3"
                style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-sm)'
                }}
            >
                <div
                    className="text-[10px] font-bold uppercase tracking-wider mb-2 px-2"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    Plan sections
                </div>
                <nav className="flex flex-col gap-0.5">
                    {sections.map((section) => {
                        if (section.requiresYourScope && !hasYourScope) return null
                        if (section.id === 'insights' && !hasInsights) return null
                        const isActive = activeId === section.id
                        const badge = section.id === 'special' ? specialCount : section.id === 'qc' ? qcCount : null
                        const icon = section.id === 'my-plant' ? yourSectionIcon || section.icon : section.icon
                        const label = section.id === 'my-plant' ? yourSectionLabel || section.label : section.label
                        return (
                            <button
                                key={section.id}
                                onClick={() => onJump(section.id)}
                                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border-none cursor-pointer text-[12.5px] font-semibold text-left transition-colors"
                                style={{
                                    background: isActive ? `${accent}14` : 'transparent',
                                    color: isActive ? accent : 'var(--text-secondary)'
                                }}
                            >
                                <i className={`fas ${icon} text-[11px] w-4 text-center`} />
                                <span className="flex-1">{label}</span>
                                {badge != null && badge > 0 && (
                                    <span
                                        className="text-[10px] font-bold rounded-full px-1.5 py-0.5"
                                        style={{
                                            background: isActive ? accent : 'var(--bg-tertiary)',
                                            color: isActive ? '#fff' : 'var(--text-secondary)'
                                        }}
                                    >
                                        {badge}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </nav>
            </div>
        </aside>
    )
}

/* ── Right "at a glance" rail ──────────────────────────────────────────── */

function AtAGlancePanel({
    accent,
    earliestClockIn,
    planDate,
    shiftSpanHours,
    specialCount,
    qcCount,
    totalOps,
    totalYardage,
    validAssignmentCount
}) {
    const dateLabel = planDate
        ? new Date(planDate + 'T00:00:00').toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'long',
              weekday: 'long',
              year: 'numeric'
          })
        : ''
    const row = (icon, label, value, color) => (
        <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
        >
            <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{ background: `${accent}14`, color: accent }}
            >
                <i className={`fas ${icon} text-[11px]`} />
            </div>
            <div className="flex-1 min-w-0">
                <div
                    className="text-[10px] uppercase tracking-wider font-bold"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    {label}
                </div>
                <div
                    className="font-bold text-[15px]"
                    style={{ color: color || 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                >
                    {value}
                </div>
            </div>
        </div>
    )
    return (
        <aside className="hidden xl:block sticky top-0 self-start py-5 pl-3" style={{ width: 280 }}>
            <div
                className="rounded-xl p-4 flex flex-col gap-2"
                style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-sm)'
                }}
            >
                <div
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    Plan snapshot
                </div>
                <div
                    className="text-[13px] font-semibold"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                >
                    {dateLabel}
                </div>
                <div className="flex flex-col gap-1.5 mt-1">
                    {row('fa-route', 'Routes', validAssignmentCount || 0)}
                    {row('fa-users', 'Operators', totalOps || 0)}
                    {row('fa-cubes', 'Yardage', totalYardage.toLocaleString())}
                    {row(
                        'fa-clock',
                        'Earliest clock-in',
                        earliestClockIn || '—',
                        earliestClockIn ? '#16a34a' : undefined
                    )}
                    {row(
                        'fa-hourglass-half',
                        'Shift span',
                        shiftSpanHours ? `${shiftSpanHours}h` : '—',
                        shiftSpanHours && shiftSpanHours > 10 ? '#d97706' : undefined
                    )}
                    {row('fa-circle-exclamation', 'Special attention', specialCount)}
                    {row('fa-vial-circle-check', 'QC attention', qcCount)}
                </div>
                <div className="flex items-center gap-1 text-[11px] mt-1" style={{ color: accent }}>
                    <i className="fas fa-check-circle" />
                    <span>Auto-saved</span>
                </div>
            </div>
        </aside>
    )
}

/* ── Main component ────────────────────────────────────────────────────── */

/**
 * PlanDashboardView — 3-column daily-plan dashboard.
 *
 * Left nav: sticky scrollspy with anchors to each content section.
 * Center: stats, personal (plant-manager) dispatch reminders, Special
 * Attention + QC Attention job lists (persisted via plan metadata),
 * insights, yardage breakdown, timeline preview, and notes.
 * Right: at-a-glance snapshot panel with today's plan numbers.
 */
function PlanDashboardView({
    accentColor,
    assignments,
    calcClockIn,
    earliestClockIn,
    getTravelTime,
    mixerCountsByPlant,
    notes,
    onSwitchToPlanner,
    planDate,
    planInsights,
    plantNameByCode,
    plantProduction,
    plants,
    setNotes,
    setPlantProduction,
    shiftSpanHours,
    stats,
    totalOps,
    validAssignmentCount,
    yourPlantScope
}) {
    const scopePlantCodes = useMemo(
        () => (yourPlantScope?.plantCodes?.length ? yourPlantScope.plantCodes : []),
        [yourPlantScope]
    )
    const scopePlantSet = useMemo(() => new Set(scopePlantCodes), [scopePlantCodes])
    const hasYourScope = scopePlantSet.size > 0
    const yourSectionKind = yourPlantScope?.kind || 'plant'
    const yourSectionLabel = YOUR_SECTION_LABELS[yourSectionKind]
    const yourSectionIcon = YOUR_SECTION_ICONS[yourSectionKind]
    const yourSectionTitle = yourPlantScope?.label || yourSectionLabel
    const [checked, setChecked] = useState({})
    const toggle = (key) => setChecked((prev) => ({ ...prev, [key]: !prev[key] }))
    const [activeSection, setActiveSection] = useState('overview')
    const scrollContainerRef = useRef(null)

    /* ── Derived plan numbers ──────────────────────────────────────── */
    const totalYardage = useMemo(
        () =>
            Object.entries(plantProduction || {})
                .filter(([code]) => code !== PLAN_META_KEY)
                .reduce((sum, [, prod]) => sum + (parseFloat(prod?.totalYardage) || 0), 0),
        [plantProduction]
    )
    const plantsWithYardage = useMemo(
        () =>
            Object.keys(plantProduction || {}).filter(
                (code) => code !== PLAN_META_KEY && (parseFloat(plantProduction[code]?.totalYardage) || 0) > 0
            ).length,
        [plantProduction]
    )

    // Broader fleet-wide numbers to set today's plan in context.
    const totalOperatorsFleet = useMemo(
        () => Object.values(mixerCountsByPlant || {}).reduce((sum, count) => sum + (count || 0), 0),
        [mixerCountsByPlant]
    )

    // Merge `stats` with every plant known to the region so the flow
    // preview mirrors what's on the full Planner tab.
    const allPlantStats = useMemo(() => {
        const existing = new Map(stats.map((s) => [s.code, s]))
        const list = (plants || []).map((p) => {
            const code = p.plant_code
            if (existing.has(code)) return existing.get(code)
            const base = mixerCountsByPlant?.[code] || 0
            return { base, code, eff: base, recv: 0, send: 0 }
        })
        stats.forEach((s) => {
            if (!list.some((x) => x.code === s.code)) list.push(s)
        })
        return list.sort((a, b) => (a.code || '').localeCompare(b.code || ''))
    }, [plants, stats, mixerCountsByPlant])
    const regionPlantCount = (plants || []).length
    const movementPct = totalOperatorsFleet > 0 ? Math.round((totalOps / totalOperatorsFleet) * 100) : 0
    const avgYardagePerPlant = plantsWithYardage > 0 ? Math.round(totalYardage / plantsWithYardage) : 0
    const plantsMissingProduction = Math.max(0, stats.length - plantsWithYardage)

    /* ── Meta (special + QC jobs) ──────────────────────────────────── */
    const meta = readMeta(plantProduction)
    const specialJobs = useMemo(() => meta.specialJobs || [], [meta.specialJobs])
    const qcJobs = useMemo(() => meta.qcJobs || [], [meta.qcJobs])
    const updateJobList = useCallback(
        (key, updater) => {
            writeMeta(setPlantProduction, (prev) => ({
                ...prev,
                [key]: typeof updater === 'function' ? updater(prev[key] || []) : updater
            }))
        },
        [setPlantProduction]
    )
    const formattedNotes = meta.formattedNotes || null
    const formattedNotesSource = meta.formattedNotesSource ?? null
    const setFormattedNotes = useCallback(
        (formatted, source) => {
            writeMeta(setPlantProduction, (prev) => {
                const next = { ...prev }
                if (formatted && source != null) {
                    next.formattedNotes = formatted
                    next.formattedNotesSource = source
                } else {
                    delete next.formattedNotes
                    delete next.formattedNotesSource
                }
                return next
            })
        },
        [setPlantProduction]
    )

    const addSpecialJob = (job) => updateJobList('specialJobs', (list) => [...list, job])
    const saveSpecialJob = (job) => updateJobList('specialJobs', (list) => list.map((j) => (j.id === job.id ? job : j)))
    const deleteSpecialJob = (id) => updateJobList('specialJobs', (list) => list.filter((j) => j.id !== id))
    const addQcJob = (job) => updateJobList('qcJobs', (list) => [...list, job])
    const saveQcJob = (job) => updateJobList('qcJobs', (list) => list.map((j) => (j.id === job.id ? job : j)))
    const deleteQcJob = (id) => updateJobList('qcJobs', (list) => list.filter((j) => j.id !== id))

    /* ── Scope-aware summary (Plant / District / Region) ────────────
       Outbound/Inbound include intra-scope moves so managers see every
       transfer touching their coverage area — a plant-to-plant move
       inside the same district counts as both outbound and inbound. */
    const myOutbound = useMemo(
        () =>
            hasYourScope
                ? (assignments || []).filter(
                      (a) => a.fromPlant && a.toPlant && a.time && scopePlantSet.has(a.fromPlant)
                  )
                : [],
        [assignments, hasYourScope, scopePlantSet]
    )
    const myInbound = useMemo(
        () =>
            hasYourScope
                ? (assignments || []).filter((a) => a.fromPlant && a.toPlant && a.time && scopePlantSet.has(a.toPlant))
                : [],
        [assignments, hasYourScope, scopePlantSet]
    )
    const outboundOps = myOutbound.reduce((sum, a) => sum + (parseInt(a.driverCount, 10) || 0), 0)
    const inboundOps = myInbound.reduce((sum, a) => sum + (parseInt(a.driverCount, 10) || 0), 0)
    const mySpecialJobs = useMemo(
        () => (hasYourScope ? specialJobs.filter((j) => scopePlantSet.has(j.plant)) : []),
        [specialJobs, hasYourScope, scopePlantSet]
    )
    const myQcJobs = useMemo(
        () => (hasYourScope ? qcJobs.filter((j) => scopePlantSet.has(j.plant)) : []),
        [qcJobs, hasYourScope, scopePlantSet]
    )
    const myAlertCount = mySpecialJobs.length + myQcJobs.length

    /** Help-being-sent checklist — per outbound route from any in-scope plant. */
    const pmChecklist = useMemo(() => {
        if (!hasYourScope) return []
        return myOutbound.map((a, idx) => {
            const travel = getTravelTime?.(a.fromPlant, a.toPlant)
            const departTime = travel != null ? subtractMinutesFromTime(a.time, travel) : null
            const ops = parseInt(a.driverCount, 10) || 0
            const originLabel = scopePlantCodes.length > 1 ? `${a.fromPlant} → ` : ''
            return {
                key: `dispatch-${idx}-${a.fromPlant}-${a.toPlant}`,
                subtitle: `${ops} operator${ops === 1 ? '' : 's'} · arrive ${a.time}${travel != null ? ` · ${travel}m travel` : ''}`,
                text: `${originLabel}Send help → ${a.toPlant}`,
                time: departTime || a.time
            }
        })
    }, [getTravelTime, hasYourScope, myOutbound, scopePlantCodes.length])

    const scopeNoun =
        yourSectionKind === 'dispatch'
            ? 'dispatch area'
            : yourSectionKind === 'region'
              ? 'region'
              : yourSectionKind === 'district'
                ? 'district'
                : 'plant'
    const outboundSummary = myOutbound.length
        ? `Sending ${outboundOps} operator${outboundOps === 1 ? '' : 's'} to ${new Set(myOutbound.map((a) => a.toPlant)).size} plant${myOutbound.length === 1 ? '' : 's'}`
        : `No outbound activity from your ${scopeNoun} today`
    const inboundSummary = myInbound.length
        ? `Receiving ${inboundOps} operator${inboundOps === 1 ? '' : 's'} from ${new Set(myInbound.map((a) => a.fromPlant)).size} plant${myInbound.length === 1 ? '' : 's'}`
        : `No inbound activity to your ${scopeNoun} today`

    /* ── ScrollSpy — highlight the last section whose top has crossed the
          activation line (a fixed distance from the scroll container top).
          Runs once on mount so the first section is active from the start. */
    useEffect(() => {
        const root = scrollContainerRef.current
        if (!root) return
        const ACTIVATION_OFFSET = 120
        const update = () => {
            const containerTop = root.getBoundingClientRect().top
            const atBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - 4
            let best = NAV_SECTIONS[0]?.id || 'overview'
            if (atBottom) {
                // When the container is at its scroll floor, the last rendered
                // section's top may still be below the activation line —
                // force-activate whichever nav section renders last.
                for (let i = NAV_SECTIONS.length - 1; i >= 0; i--) {
                    if (root.querySelector(`#${NAV_SECTIONS[i].id}`)) {
                        best = NAV_SECTIONS[i].id
                        break
                    }
                }
            } else {
                for (const section of NAV_SECTIONS) {
                    const el = root.querySelector(`#${section.id}`)
                    if (!el) continue
                    const top = el.getBoundingClientRect().top - containerTop
                    if (top - ACTIVATION_OFFSET <= 0) best = section.id
                }
            }
            setActiveSection((prev) => (prev === best ? prev : best))
        }
        update()
        root.addEventListener('scroll', update, { passive: true })
        window.addEventListener('resize', update)
        // Re-measure after layout settles (sections can render async)
        const t1 = window.setTimeout(update, 50)
        const t2 = window.setTimeout(update, 300)
        return () => {
            root.removeEventListener('scroll', update)
            window.removeEventListener('resize', update)
            window.clearTimeout(t1)
            window.clearTimeout(t2)
        }
    }, [
        hasYourScope,
        planInsights.warnings.length,
        planInsights.suggestions.length,
        stats.length,
        validAssignmentCount,
        specialJobs.length,
        qcJobs.length
    ])

    const jumpTo = (id) => {
        const root = scrollContainerRef.current
        if (!root) return
        const el = root.querySelector(`#${id}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const hasInsights = planInsights.warnings.length + planInsights.suggestions.length > 0

    return (
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] px-4 lg:px-6 flex gap-4">
                {/* LEFT — sticky scrollspy nav */}
                <SideNav
                    accent={accentColor}
                    activeId={activeSection}
                    hasInsights={hasInsights}
                    hasYourScope={hasYourScope}
                    onJump={jumpTo}
                    sections={NAV_SECTIONS}
                    specialCount={specialJobs.length}
                    qcCount={qcJobs.length}
                    yourSectionIcon={yourSectionIcon}
                    yourSectionLabel={yourSectionLabel}
                />

                {/* CENTER — main content */}
                <div className="flex-1 min-w-0 py-5 flex flex-col gap-5">
                    {/* Overview — hero stats (fleet-wide figures with in-plan context) */}
                    <section id="overview" className="scroll-mt-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            <StatCard
                                accent={accentColor}
                                icon="fa-users"
                                label="Operators"
                                value={totalOperatorsFleet.toLocaleString()}
                                hint={
                                    totalOps > 0
                                        ? `${totalOps} moving today · ${movementPct}% of fleet`
                                        : 'No operators being moved today'
                                }
                            />
                            <StatCard
                                accent={accentColor}
                                icon="fa-industry"
                                label="Plants"
                                value={`${stats.length}/${regionPlantCount || stats.length}`}
                                valueColor={stats.length < regionPlantCount ? '#d97706' : undefined}
                                hint={
                                    stats.length < regionPlantCount
                                        ? `${regionPlantCount - stats.length} not in today's plan`
                                        : 'All plants in plan'
                                }
                            />
                            <StatCard
                                accent={accentColor}
                                icon="fa-route"
                                label="Routes"
                                value={validAssignmentCount}
                                hint={
                                    validAssignmentCount > 0
                                        ? `${new Set((assignments || []).filter((a) => a.fromPlant).map((a) => a.fromPlant)).size} sender${
                                              new Set(
                                                  (assignments || []).filter((a) => a.fromPlant).map((a) => a.fromPlant)
                                              ).size === 1
                                                  ? ''
                                                  : 's'
                                          } · ${new Set((assignments || []).filter((a) => a.toPlant).map((a) => a.toPlant)).size} receiver${
                                              new Set(
                                                  (assignments || []).filter((a) => a.toPlant).map((a) => a.toPlant)
                                              ).size === 1
                                                  ? ''
                                                  : 's'
                                          }`
                                        : 'Nothing scheduled yet'
                                }
                            />
                            <StatCard
                                accent={accentColor}
                                icon="fa-cubes"
                                label="Total yardage"
                                value={totalYardage.toLocaleString()}
                                hint={
                                    plantsMissingProduction > 0
                                        ? `${plantsWithYardage}/${stats.length} plants reporting · avg ${avgYardagePerPlant} yd`
                                        : plantsWithYardage > 0
                                          ? `Avg ${avgYardagePerPlant} yd / plant`
                                          : 'No production entered'
                                }
                                valueColor={
                                    plantsMissingProduction > 0 && plantsWithYardage > 0 ? '#d97706' : undefined
                                }
                            />
                            <StatCard
                                accent={accentColor}
                                icon="fa-clock"
                                label="Earliest clock-in"
                                value={earliestClockIn || '—'}
                                valueColor={earliestClockIn ? '#16a34a' : undefined}
                                hint={earliestClockIn ? 'First operator departs' : 'No routes scheduled'}
                            />
                            <StatCard
                                accent={accentColor}
                                icon="fa-hourglass-half"
                                label="Shift span"
                                value={shiftSpanHours ? `${shiftSpanHours}h` : '—'}
                                valueColor={shiftSpanHours && shiftSpanHours > 10 ? '#d97706' : undefined}
                                hint={
                                    shiftSpanHours
                                        ? shiftSpanHours > 10
                                            ? 'Overtime likely across fleet'
                                            : 'Within normal limits'
                                        : 'No routes scheduled'
                                }
                            />
                        </div>
                    </section>

                    <Card id="notes" title="Notes" icon="fa-sticky-note" iconColor={accentColor}>
                        <PlanNotesSection
                            accentColor={accentColor}
                            cachedFormatted={formattedNotes}
                            cachedSource={formattedNotesSource}
                            notes={notes}
                            onFormattedChange={setFormattedNotes}
                            setNotes={setNotes}
                        />
                    </Card>

                    {/* Your plant / district / region — gated by plan.yourtab */}
                    {hasYourScope && (
                        <Card
                            id="my-plant"
                            title={yourSectionTitle}
                            icon={yourSectionIcon}
                            iconColor={accentColor}
                            right={
                                onSwitchToPlanner && (
                                    <button
                                        onClick={onSwitchToPlanner}
                                        className="text-[11px] font-semibold px-3 py-1.5 rounded-md border-none cursor-pointer"
                                        style={{ background: accentColor, color: '#fff' }}
                                    >
                                        <i className="fas fa-project-diagram mr-1" /> Open Planner
                                    </button>
                                )
                            }
                        >
                            {myAlertCount > 0 && (
                                <div
                                    className="rounded-lg p-3 mb-4 flex items-start gap-3"
                                    style={{
                                        background: 'linear-gradient(90deg, #fef3c740, #fee2e240)',
                                        border: '1px solid #fbbf24'
                                    }}
                                >
                                    <div
                                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ background: '#f59e0b', color: '#fff' }}
                                    >
                                        <i className="fas fa-triangle-exclamation text-[14px]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div
                                            className="text-[13px] font-bold"
                                            style={{ color: '#78350f', fontFamily: 'var(--font-heading)' }}
                                        >
                                            {myAlertCount} flagged job{myAlertCount === 1 ? '' : 's'} in your{' '}
                                            {scopeNoun}
                                        </div>
                                        <div className="text-[11px]" style={{ color: '#92400e' }}>
                                            {mySpecialJobs.length > 0 && (
                                                <>
                                                    <b>{mySpecialJobs.length}</b> special attention
                                                    {myQcJobs.length > 0 && ' · '}
                                                </>
                                            )}
                                            {myQcJobs.length > 0 && (
                                                <>
                                                    <b>{myQcJobs.length}</b> QC attention
                                                </>
                                            )}
                                        </div>
                                        <div className="mt-2 flex flex-col gap-1.5">
                                            {mySpecialJobs.map((j) => (
                                                <button
                                                    key={`alert-s-${j.id}`}
                                                    onClick={() => jumpTo('special')}
                                                    className="text-left rounded-md px-2.5 py-1.5 text-[11.5px] border-none cursor-pointer flex items-center gap-2"
                                                    style={{
                                                        background: 'rgba(217, 119, 6, 0.15)',
                                                        color: '#78350f'
                                                    }}
                                                >
                                                    <i
                                                        className="fas fa-circle-exclamation text-[10px]"
                                                        style={{ color: '#d97706' }}
                                                    />
                                                    <span className="font-semibold flex-1 truncate">
                                                        {j.title || 'Untitled'}
                                                    </span>
                                                    {j.time && (
                                                        <span
                                                            className="font-mono text-[10.5px]"
                                                            style={{ color: '#92400e' }}
                                                        >
                                                            {j.time}
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                            {myQcJobs.map((j) => (
                                                <button
                                                    key={`alert-q-${j.id}`}
                                                    onClick={() => jumpTo('qc')}
                                                    className="text-left rounded-md px-2.5 py-1.5 text-[11.5px] border-none cursor-pointer flex items-center gap-2"
                                                    style={{
                                                        background: 'rgba(124, 58, 237, 0.12)',
                                                        color: '#5b21b6'
                                                    }}
                                                >
                                                    <i
                                                        className="fas fa-vial-circle-check text-[10px]"
                                                        style={{ color: '#7c3aed' }}
                                                    />
                                                    <span className="font-semibold flex-1 truncate">
                                                        {j.title || 'Untitled'}
                                                    </span>
                                                    {j.time && (
                                                        <span
                                                            className="font-mono text-[10.5px]"
                                                            style={{ color: '#6d28d9' }}
                                                        >
                                                            {j.time}
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                <div
                                    className="rounded-lg p-3 flex items-start gap-3"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-light)'
                                    }}
                                >
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                        style={{
                                            background: myOutbound.length ? '#dc262614' : 'var(--bg-tertiary)',
                                            color: '#dc2626'
                                        }}
                                    >
                                        <i className="fas fa-up-right-from-square text-[12px]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div
                                            className="text-[11px] font-bold uppercase tracking-wider"
                                            style={{ color: 'var(--text-secondary)' }}
                                        >
                                            Outbound help
                                        </div>
                                        <div
                                            className="font-bold text-[15px]"
                                            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                                        >
                                            {outboundSummary}
                                        </div>
                                        {myOutbound.length > 0 && (
                                            <div
                                                className="mt-1 flex flex-wrap gap-1.5 text-[11px]"
                                                style={{ color: 'var(--text-secondary)' }}
                                            >
                                                {myOutbound.map((a, i) => (
                                                    <span
                                                        key={`out-${i}`}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded"
                                                        style={{ background: 'var(--bg-tertiary)' }}
                                                    >
                                                        <span
                                                            style={{
                                                                fontFamily: 'var(--font-heading)',
                                                                fontWeight: 700
                                                            }}
                                                        >
                                                            +{parseInt(a.driverCount, 10) || 0}
                                                        </span>
                                                        → {a.toPlant}
                                                        <span style={{ color: 'var(--text-tertiary)' }}>
                                                            · {a.time}
                                                        </span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div
                                    className="rounded-lg p-3 flex items-start gap-3"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-light)'
                                    }}
                                >
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                        style={{
                                            background: myInbound.length ? '#16a34a14' : 'var(--bg-tertiary)',
                                            color: '#16a34a'
                                        }}
                                    >
                                        <i className="fas fa-down-left-from-circle text-[12px]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div
                                            className="text-[11px] font-bold uppercase tracking-wider"
                                            style={{ color: 'var(--text-secondary)' }}
                                        >
                                            Inbound help
                                        </div>
                                        <div
                                            className="font-bold text-[15px]"
                                            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
                                        >
                                            {inboundSummary}
                                        </div>
                                        {myInbound.length > 0 && (
                                            <div
                                                className="mt-1 flex flex-wrap gap-1.5 text-[11px]"
                                                style={{ color: 'var(--text-secondary)' }}
                                            >
                                                {myInbound.map((a, i) => (
                                                    <span
                                                        key={`in-${i}`}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded"
                                                        style={{ background: 'var(--bg-tertiary)' }}
                                                    >
                                                        <span
                                                            style={{
                                                                fontFamily: 'var(--font-heading)',
                                                                fontWeight: 700
                                                            }}
                                                        >
                                                            +{parseInt(a.driverCount, 10) || 0}
                                                        </span>
                                                        from {a.fromPlant}
                                                        <span style={{ color: 'var(--text-tertiary)' }}>
                                                            · {a.time}
                                                        </span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {pmChecklist.length > 0 ? (
                                <div>
                                    <div
                                        className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        <i className="fas fa-clipboard-check text-[10px]" />
                                        Dispatch checklist
                                        <span className="font-normal">
                                            ({Object.values(checked).filter(Boolean).length} / {pmChecklist.length})
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        {pmChecklist.map((item) => (
                                            <ChecklistRow
                                                key={item.key}
                                                accent={accentColor}
                                                checked={!!checked[item.key]}
                                                onToggle={() => toggle(item.key)}
                                                subtitle={item.subtitle}
                                                text={item.text}
                                                time={item.time}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className="rounded-lg p-4 text-center text-[12px]"
                                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                                >
                                    {yourSectionKind === 'plant'
                                        ? 'Your plant isn\u2019t sending operators today.'
                                        : `Nothing being sent outside your ${scopeNoun} today.`}
                                </div>
                            )}
                        </Card>
                    )}

                    <Card
                        id="flow-preview"
                        title="Flow preview"
                        icon="fa-project-diagram"
                        iconColor={accentColor}
                        right={
                            onSwitchToPlanner && (
                                <button
                                    onClick={onSwitchToPlanner}
                                    className="text-[11px] font-semibold px-3 py-1.5 rounded-md border-none cursor-pointer flex items-center gap-1.5"
                                    style={{ background: accentColor, color: '#fff' }}
                                >
                                    <i className="fas fa-up-right-from-square text-[9px]" /> Open Planner
                                </button>
                            )
                        }
                    >
                        <PlanFlowPreview
                            accentColor={accentColor}
                            allPlantStats={allPlantStats}
                            assignments={assignments}
                            onOpenPlanner={onSwitchToPlanner}
                            plantProduction={plantProduction}
                        />
                    </Card>

                    <JobsSection
                        id="special"
                        accent={accentColor}
                        tint="#d97706"
                        icon="fa-circle-exclamation"
                        iconColor="#d97706"
                        title="Special Attention"
                        emptyHint="No special-attention jobs yet. Add anything the crew needs to double-check — VIP pours, tight sequences, high-slump runs, late starts, etc."
                        jobs={specialJobs}
                        plants={plants}
                        plantNameByCode={plantNameByCode}
                        onCreate={addSpecialJob}
                        onSave={saveSpecialJob}
                        onDelete={deleteSpecialJob}
                        titleLabel="Title (e.g. Harbor Dev · Mix 4000-B pour at 6:00)"
                    />

                    <JobsSection
                        id="qc"
                        accent={accentColor}
                        tint="#7c3aed"
                        icon="fa-vial-circle-check"
                        iconColor="#7c3aed"
                        title="QC Attention"
                        emptyHint="No QC-flagged jobs yet. Add any pour that needs cylinders cast, mix-design watch, slump re-checks, temp monitoring, or technician on site."
                        jobs={qcJobs}
                        plants={plants}
                        plantNameByCode={plantNameByCode}
                        onCreate={addQcJob}
                        onSave={saveQcJob}
                        onDelete={deleteQcJob}
                        titleLabel="Title (e.g. QC cylinders on Mix 4500 · Plant 214)"
                    />

                    {hasInsights && (
                        <Card
                            id="insights"
                            title={`Plan insights · ${planInsights.warnings.length + planInsights.suggestions.length}`}
                            icon="fa-triangle-exclamation"
                            iconColor="#f59e0b"
                        >
                            <div className="flex flex-col gap-2">
                                {planInsights.warnings.map((w, i) => (
                                    <div
                                        key={`w-${i}`}
                                        className="flex items-start gap-2.5 rounded-lg px-3 py-2 text-[12px]"
                                        style={{ background: '#fef3c720', border: '1px solid #fbbf2440' }}
                                    >
                                        <i
                                            className={`fas ${w.icon} text-[10px] mt-0.5 shrink-0`}
                                            style={{ color: '#f59e0b' }}
                                        />
                                        <span style={{ color: 'var(--text-primary)' }}>{w.message}</span>
                                    </div>
                                ))}
                                {planInsights.suggestions.map((s, i) => (
                                    <div
                                        key={`s-${i}`}
                                        className="flex items-start gap-2.5 rounded-lg px-3 py-2 text-[12px]"
                                        style={{ background: 'var(--bg-secondary)' }}
                                    >
                                        <i
                                            className={`fas ${s.icon} text-[10px] mt-0.5 shrink-0`}
                                            style={{ color: 'var(--text-secondary)' }}
                                        />
                                        <span style={{ color: 'var(--text-secondary)' }}>{s.message}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {stats.length > 0 && (
                        <Card id="yardage" title="Yardage by plant" icon="fa-cubes" iconColor={accentColor}>
                            <div className="flex flex-col gap-2">
                                {stats
                                    .map((s) => ({
                                        ...s,
                                        yardage: parseFloat(plantProduction[s.code]?.totalYardage) || 0
                                    }))
                                    .sort((a, b) => b.yardage - a.yardage)
                                    .map((s) => {
                                        const pct = totalYardage > 0 ? (s.yardage / totalYardage) * 100 : 0
                                        return (
                                            <div key={s.code} className="flex items-center gap-3">
                                                <div
                                                    className="w-12 font-bold text-[13px]"
                                                    style={{
                                                        fontFamily: 'var(--font-heading)',
                                                        color: 'var(--text-primary)'
                                                    }}
                                                >
                                                    {s.code}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div
                                                        className="h-2 rounded-full overflow-hidden"
                                                        style={{ background: 'var(--bg-tertiary)' }}
                                                    >
                                                        <div
                                                            className="h-full rounded-full transition-all"
                                                            style={{
                                                                background: accentColor,
                                                                width: `${Math.max(pct, s.yardage > 0 ? 3 : 0)}%`
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <div
                                                    className="w-24 text-right text-[12px]"
                                                    style={{ color: 'var(--text-secondary)' }}
                                                >
                                                    <b style={{ color: 'var(--text-primary)' }}>
                                                        {s.yardage.toLocaleString()} yd
                                                    </b>
                                                    {totalYardage > 0 && (
                                                        <>
                                                            {' '}
                                                            <span style={{ color: 'var(--text-tertiary)' }}>
                                                                ({Math.round(pct)}%)
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                            </div>
                        </Card>
                    )}

                    {validAssignmentCount > 0 && (
                        <Card id="timeline" title="Timeline preview" icon="fa-chart-gantt" iconColor={accentColor}>
                            <PlanMiniTimeline
                                accentColor={accentColor}
                                assignments={assignments}
                                getTravelTime={getTravelTime}
                                mixerCountsByPlant={mixerCountsByPlant}
                                plantProduction={plantProduction}
                            />
                        </Card>
                    )}

                    <div className="h-8" />
                </div>

                {/* RIGHT — at-a-glance */}
                <AtAGlancePanel
                    accent={accentColor}
                    earliestClockIn={earliestClockIn}
                    planDate={planDate}
                    shiftSpanHours={shiftSpanHours}
                    specialCount={specialJobs.length}
                    qcCount={qcJobs.length}
                    totalOps={totalOps}
                    totalYardage={totalYardage}
                    validAssignmentCount={validAssignmentCount}
                />
            </div>
        </div>
    )
}

export default PlanDashboardView
