import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Panel as SharedPanel, Stat as SharedStat } from '../../../app/components/ui/Panel'
import { timeToMinutes } from '../../../utils/PlanUtility'
import PlanFlowPreview from './PlanFlowPreview'
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

/* ── Sub-components ──────────────────────────────────────────────────────
 *  Local aliases for the shared `Panel` / `Stat` primitives. Keeping them
 *  named `StatCard` / `Card` preserves every existing call site in this
 *  file without a churn-heavy rename. */

const StatCard = SharedStat
const Card = (props) => <SharedPanel {...props} />

function FlowSummary({ color, label, routes, summary }) {
    return (
        <div className="flex flex-col">
            <div className="flex items-baseline gap-2 mb-0.5">
                <span className="inline-block rounded-sm" style={{ background: color, height: 8, width: 8 }} />
                <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {label}
                </span>
            </div>
            <div className="text-[13px] font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                {summary}
            </div>
            {routes.length > 0 && (
                <div className="flex flex-col gap-0.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    {routes.map((r, i) => (
                        <div key={`${label}-${i}`} className="flex items-baseline gap-2">
                            <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                                +{r.ops}
                            </span>
                            <span>
                                {r.prefix} {r.partner}
                            </span>
                            <span className="font-mono" style={{ color: 'var(--text-tertiary)' }}>
                                {r.time}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                    autoFocus
                    type="text"
                    value={draft.title || ''}
                    onChange={(e) => update('title', e.target.value)}
                    placeholder={titleLabel}
                    className="sm:col-span-2 w-full px-3 py-2 rounded-md text-sm font-semibold outline-none"
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
                    className="sm:col-span-2 w-full px-3 py-2 rounded-md text-sm"
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
                    className="sm:col-span-2 w-full px-3 py-2 rounded-md text-sm outline-none resize-none"
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

function JobRow({ accent, canEdit = true, job, onDelete, onEdit, plantNameByCode, tint }) {
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
            {canEdit && (
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
            )}
        </div>
    )
}

function JobsSection({
    accent,
    canEdit = true,
    emptyHint,
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
            right={
                canEdit && (
                    <button
                        onClick={startCreate}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-white border-none cursor-pointer"
                        style={{ background: tint || accent }}
                    >
                        <i className="fas fa-plus mr-1" /> Add
                    </button>
                )
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
                            canEdit={canEdit}
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
const NAV_SECTIONS = [
    { icon: 'fa-chart-line', id: 'overview', label: 'Overview' },
    { icon: 'fa-user-tie', id: 'my-plant', label: 'Your Plant', requiresYourScope: true },
    { icon: 'fa-sticky-note', id: 'notes', label: 'Notes' },
    { icon: 'fa-project-diagram', id: 'flow-preview', label: 'Flow' },
    { icon: 'fa-circle-exclamation', id: 'extra-diligence', label: 'Extra Diligence' },
    { icon: 'fa-triangle-exclamation', id: 'insights', label: 'Plan Insights' },
    { icon: 'fa-cubes', id: 'yardage', label: 'Yardage by Plant' }
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
    yourSectionLabel
}) {
    return (
        <aside className="hidden lg:block sticky top-0 self-start py-5 pr-3" style={{ width: 200 }}>
            <nav className="flex flex-col">
                {sections.map((section) => {
                    if (section.requiresYourScope && !hasYourScope) return null
                    if (section.id === 'insights' && !hasInsights) return null
                    const isActive = activeId === section.id
                    const badge = section.id === 'extra-diligence' ? (specialCount || 0) + (qcCount || 0) : null
                    const label = section.id === 'my-plant' ? yourSectionLabel || section.label : section.label
                    return (
                        <button
                            key={section.id}
                            onClick={() => onJump(section.id)}
                            className="flex items-center gap-2 px-2 py-1.5 border-none cursor-pointer text-[13px] text-left bg-transparent"
                            style={{
                                borderLeft: `2px solid ${isActive ? accent : 'transparent'}`,
                                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontWeight: isActive ? 600 : 400
                            }}
                        >
                            <span className="flex-1 truncate">{label}</span>
                            {badge != null && badge > 0 && (
                                <span className="text-[11px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                                    {badge}
                                </span>
                            )}
                        </button>
                    )
                })}
            </nav>
        </aside>
    )
}

/* ── Right "at a glance" rail ──────────────────────────────────────────── */

function AtAGlancePanel({
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
    const rows = [
        { label: 'Routes', value: (validAssignmentCount || 0).toString() },
        { label: 'Operators', value: (totalOps || 0).toString() },
        { label: 'Yardage', value: totalYardage.toLocaleString() },
        {
            color: earliestClockIn ? '#16a34a' : undefined,
            label: 'Earliest clock-in',
            value: earliestClockIn || '—'
        },
        {
            color: shiftSpanHours && shiftSpanHours > 10 ? '#d97706' : undefined,
            label: 'Shift span',
            value: shiftSpanHours ? `${shiftSpanHours}h` : '—'
        },
        { label: 'Extra diligence', value: ((specialCount || 0) + (qcCount || 0)).toString() }
    ]
    return (
        <aside className="hidden xl:block sticky top-0 self-start py-5 pl-4" style={{ width: 240 }}>
            <div className="text-[12px] mb-1" style={{ color: 'var(--text-tertiary)' }}>
                {dateLabel}
            </div>
            <div className="flex flex-col">
                {rows.map((r) => (
                    <div
                        key={r.label}
                        className="flex items-baseline justify-between py-1.5 border-b"
                        style={{ borderColor: 'var(--border-light)' }}
                    >
                        <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                            {r.label}
                        </span>
                        <span
                            className="text-[13px] font-semibold font-mono"
                            style={{ color: r.color || 'var(--text-primary)' }}
                        >
                            {r.value}
                        </span>
                    </div>
                ))}
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
    canEdit = true,
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
            <div className="mx-auto w-full max-w-[1600px] px-3 sm:px-4 lg:px-6 flex gap-4">
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
                    yourSectionLabel={yourSectionLabel}
                />

                {/* CENTER — main content */}
                <div className="flex-1 min-w-0 py-3 sm:py-5 flex flex-col gap-3 sm:gap-5">
                    {/* Overview — fleet-wide stats with in-plan context */}
                    <section id="overview" className="scroll-mt-4">
                        <div
                            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 rounded overflow-hidden"
                            style={{ border: '1px solid var(--border-light)' }}
                        >
                            <StatCard
                                label="Operators"
                                value={totalOperatorsFleet.toLocaleString()}
                                hint={totalOps > 0 ? `${totalOps} moving · ${movementPct}%` : 'None moving today'}
                            />
                            <StatCard
                                label="Plants"
                                value={`${stats.length}/${regionPlantCount || stats.length}`}
                                valueColor={stats.length < regionPlantCount ? '#d97706' : undefined}
                                hint={
                                    stats.length < regionPlantCount
                                        ? `${regionPlantCount - stats.length} not in plan`
                                        : 'All in plan'
                                }
                            />
                            <StatCard
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
                                        : 'Nothing scheduled'
                                }
                            />
                            <StatCard
                                label="Yardage"
                                value={totalYardage.toLocaleString()}
                                hint={
                                    plantsMissingProduction > 0
                                        ? `${plantsWithYardage}/${stats.length} reporting · avg ${avgYardagePerPlant}`
                                        : plantsWithYardage > 0
                                          ? `Avg ${avgYardagePerPlant} yd / plant`
                                          : 'No production'
                                }
                                valueColor={
                                    plantsMissingProduction > 0 && plantsWithYardage > 0 ? '#d97706' : undefined
                                }
                            />
                            <StatCard
                                label="Earliest clock-in"
                                value={earliestClockIn || '—'}
                                valueColor={earliestClockIn ? '#16a34a' : undefined}
                                hint={earliestClockIn ? 'First departure' : 'No routes'}
                            />
                            <StatCard
                                label="Shift span"
                                value={shiftSpanHours ? `${shiftSpanHours}h` : '—'}
                                valueColor={shiftSpanHours && shiftSpanHours > 10 ? '#d97706' : undefined}
                                hint={
                                    shiftSpanHours
                                        ? shiftSpanHours > 10
                                            ? 'Overtime likely'
                                            : 'Within normal'
                                        : 'No routes'
                                }
                            />
                        </div>
                    </section>

                    {/* Your plant / district / region — gated by plan.yourtab */}
                    {hasYourScope && (
                        <Card
                            id="my-plant"
                            title={yourSectionTitle}
                            right={
                                onSwitchToPlanner && (
                                    <button
                                        onClick={onSwitchToPlanner}
                                        className="text-[11px] font-semibold px-3 py-1.5 rounded-md border-none cursor-pointer shrink-0"
                                        style={{ background: accentColor, color: '#fff' }}
                                        title="Open Planner"
                                    >
                                        <i className="fas fa-project-diagram sm:mr-1" />
                                        <span className="hidden sm:inline">Open Planner</span>
                                    </button>
                                )
                            }
                        >
                            {myAlertCount > 0 && (
                                <div
                                    className="rounded p-3 mb-3"
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        borderLeft: '3px solid #d97706'
                                    }}
                                >
                                    <div className="text-[12.5px] mb-1.5" style={{ color: 'var(--text-primary)' }}>
                                        <span className="font-semibold">
                                            {myAlertCount} flagged job{myAlertCount === 1 ? '' : 's'}
                                        </span>{' '}
                                        in your {scopeNoun}
                                        {(mySpecialJobs.length > 0 || myQcJobs.length > 0) && (
                                            <span style={{ color: 'var(--text-secondary)' }}>
                                                {' — '}
                                                {mySpecialJobs.length > 0 && `${mySpecialJobs.length} special`}
                                                {mySpecialJobs.length > 0 && myQcJobs.length > 0 && ', '}
                                                {myQcJobs.length > 0 && `${myQcJobs.length} QC`}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        {mySpecialJobs.map((j) => (
                                            <button
                                                key={`alert-s-${j.id}`}
                                                onClick={() => jumpTo('special')}
                                                className="text-left text-[12px] border-none cursor-pointer bg-transparent flex items-baseline gap-2 px-0 py-0.5"
                                                style={{ color: 'var(--text-secondary)' }}
                                            >
                                                <span style={{ color: '#d97706' }}>•</span>
                                                <span className="flex-1 truncate">{j.title || 'Untitled'}</span>
                                                {j.time && <span className="font-mono text-[11px]">{j.time}</span>}
                                            </button>
                                        ))}
                                        {myQcJobs.map((j) => (
                                            <button
                                                key={`alert-q-${j.id}`}
                                                onClick={() => jumpTo('qc')}
                                                className="text-left text-[12px] border-none cursor-pointer bg-transparent flex items-baseline gap-2 px-0 py-0.5"
                                                style={{ color: 'var(--text-secondary)' }}
                                            >
                                                <span style={{ color: '#7c3aed' }}>•</span>
                                                <span className="flex-1 truncate">{j.title || 'Untitled'}</span>
                                                {j.time && <span className="font-mono text-[11px]">{j.time}</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mb-3">
                                <FlowSummary
                                    color="#dc2626"
                                    label="Outbound"
                                    summary={outboundSummary}
                                    routes={myOutbound.map((a) => ({
                                        ops: parseInt(a.driverCount, 10) || 0,
                                        partner: a.toPlant,
                                        prefix: '→',
                                        time: a.time
                                    }))}
                                />
                                <FlowSummary
                                    color="#16a34a"
                                    label="Inbound"
                                    summary={inboundSummary}
                                    routes={myInbound.map((a) => ({
                                        ops: parseInt(a.driverCount, 10) || 0,
                                        partner: a.fromPlant,
                                        prefix: 'from',
                                        time: a.time
                                    }))}
                                />
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

                    <Card id="notes" title="Notes">
                        <PlanNotesSection
                            accentColor={accentColor}
                            cachedFormatted={formattedNotes}
                            cachedSource={formattedNotesSource}
                            canEdit={canEdit}
                            notes={notes}
                            onFormattedChange={setFormattedNotes}
                            setNotes={setNotes}
                        />
                    </Card>

                    <Card
                        id="flow-preview"
                        title="Flow preview"
                        right={
                            onSwitchToPlanner && (
                                <button
                                    onClick={onSwitchToPlanner}
                                    className="text-[11px] font-semibold px-3 py-1.5 rounded-md border-none cursor-pointer flex items-center gap-1.5 shrink-0"
                                    style={{ background: accentColor, color: '#fff' }}
                                    title="Open Planner"
                                >
                                    <i className="fas fa-up-right-from-square text-[9px]" />
                                    <span className="hidden sm:inline">Open Planner</span>
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

                    {/* Extra Diligence — combined Special Attention + QC Attention block.
                        The wrapper id matches the consolidated nav entry; inner ids stay
                        so existing inline jumpTo('special') / jumpTo('qc') links still scroll
                        to the right subsection. Uses <section> + scroll-mt-4 to match the
                        scrollIntoView landing pattern of every other anchor on the page. */}
                    <section id="extra-diligence" className="scroll-mt-4 flex flex-col gap-3 sm:gap-5">
                        <JobsSection
                            id="special"
                            accent={accentColor}
                            canEdit={canEdit}
                            tint="#d97706"
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
                            canEdit={canEdit}
                            tint="#7c3aed"
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
                    </section>

                    {hasInsights && (
                        <Card
                            id="insights"
                            title={`Plan insights · ${planInsights.warnings.length + planInsights.suggestions.length}`}
                        >
                            <div className="flex flex-col gap-1.5">
                                {planInsights.warnings.map((w, i) => (
                                    <div
                                        key={`w-${i}`}
                                        className="flex items-baseline gap-2 text-[12.5px] py-1"
                                        style={{ borderLeft: '2px solid #f59e0b', paddingLeft: 10 }}
                                    >
                                        <span style={{ color: 'var(--text-primary)' }}>{w.message}</span>
                                    </div>
                                ))}
                                {planInsights.suggestions.map((s, i) => (
                                    <div
                                        key={`s-${i}`}
                                        className="flex items-baseline gap-2 text-[12.5px] py-1"
                                        style={{ borderLeft: '2px solid var(--border-medium)', paddingLeft: 10 }}
                                    >
                                        <span style={{ color: 'var(--text-secondary)' }}>{s.message}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {stats.length > 0 && (
                        <Card id="yardage" title="Yardage by plant">
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

                    <div className="h-8" />
                </div>

                {/* RIGHT — at-a-glance */}
                <AtAGlancePanel
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
