import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'

import PlantDropdownModal from '../../../../app/components/common/PlantDropdownModal'
import { ReportUtility } from '../../../../utils/ReportUtility'

/* ── Plan-tab design tokens ───────────────────────────────────────────────
 *  Same vocabulary as the District / Plant / Efficiency / Aggregate report
 *  rewrites — CSS custom properties, compact 10–13px typography, hairline
 *  borders, 4px corner radius. */
const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
const CARD_STYLE = { background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }
const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}
const FIELD_INPUT_CLASS = 'w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none box-border disabled:opacity-90'

/* TAG_OPTIONS — incident categories surfaced as the picker on the form
 * row. Grouped loosely: severity/accidents → person impact → operational
 * → general categories. Preserve the prior order of the original eight
 * tags so reports filed before the expansion still render in the same
 * sequence. */
const TAG_OPTIONS = [
    'Accident',
    'DOT',
    'DOT Recordable',
    'Non-DOT',
    'Property Damage',
    'Injury',
    'Medical',
    'First Aid',
    'Backing / Chute Incident',
    'Spill',
    'Compliance',
    'Environmental',
    'Reprimand',
    'Safety'
]
const TAG_COLORS = {
    Accident: { bg: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', icon: 'fas fa-car-crash' },
    'Backing / Chute Incident': {
        bg: 'rgba(217, 119, 6, 0.15)',
        color: '#92400e',
        icon: 'fas fa-truck-arrow-right'
    },
    Compliance: { bg: 'rgba(59, 130, 246, 0.15)', color: '#2563eb', icon: 'fas fa-clipboard-check' },
    DOT: { bg: 'rgba(234, 179, 8, 0.15)', color: '#a16207', icon: 'fas fa-truck' },
    'DOT Recordable': { bg: 'rgba(234, 179, 8, 0.20)', color: '#854d0e', icon: 'fas fa-triangle-exclamation' },
    Environmental: { bg: 'rgba(34, 197, 94, 0.15)', color: '#15803d', icon: 'fas fa-leaf' },
    'First Aid': { bg: 'rgba(20, 184, 166, 0.15)', color: '#0f766e', icon: 'fas fa-kit-medical' },
    Injury: { bg: 'rgba(220, 38, 38, 0.15)', color: '#b91c1c', icon: 'fas fa-user-injured' },
    Medical: { bg: 'rgba(244, 63, 94, 0.15)', color: '#be123c', icon: 'fas fa-briefcase-medical' },
    'Non-DOT': { bg: 'rgba(249, 115, 22, 0.15)', color: '#c2410c', icon: 'fas fa-file-alt' },
    'Property Damage': { bg: 'rgba(234, 88, 12, 0.18)', color: '#9a3412', icon: 'fas fa-car-burst' },
    Reprimand: { bg: 'rgba(168, 85, 247, 0.15)', color: '#7c3aed', icon: 'fas fa-exclamation-triangle' },
    Safety: { bg: 'rgba(14, 165, 233, 0.15)', color: '#0369a1', icon: 'fas fa-shield-alt' },
    Spill: { bg: 'rgba(6, 182, 212, 0.15)', color: '#0e7490', icon: 'fas fa-droplet' }
}

/** Compact card header — icon chip + label/title — same primitive used by
 *  every other redesigned report. */
function CardHeader({ icon, iconBg, iconColor, label, sub, title, right }) {
    return (
        <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
                <div
                    className="flex h-6 w-6 items-center justify-center rounded shrink-0"
                    style={{
                        background: iconBg || 'var(--bg-tertiary)',
                        color: iconColor || 'var(--text-secondary)'
                    }}
                >
                    <i className={`fas ${icon} text-[11px]`} />
                </div>
                <div className="min-w-0 flex-1">
                    {label && (
                        <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            {label}
                        </div>
                    )}
                    <div className="text-[12.5px] font-semibold leading-tight text-text-primary">{title}</div>
                    {sub && <div className="text-[10.5px] mt-0.5 text-text-tertiary">{sub}</div>}
                </div>
            </div>
            {right && <div className="shrink-0">{right}</div>}
        </div>
    )
}

/* ── TagPicker (modal) ───────────────────────────────────────────────────── */

function TagPicker({ disabled, onChange, options, placeholder, value }) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const lower = query.toLowerCase()
    const filtered = options.filter((o) => o.toLowerCase().includes(lower))
    const toggle = (val) => {
        if (disabled) return
        const has = value.includes(val)
        onChange(has ? value.filter((v) => v !== val) : [...value, val])
    }
    const selectAll = () => !disabled && onChange(options)
    const clearAll = () => !disabled && onChange([])

    const modalContent = open ? (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setOpen(false)}
        >
            <div
                className="flex w-full max-w-[400px] max-h-[80vh] flex-col overflow-hidden rounded shadow-2xl"
                style={CARD_STYLE}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-3 py-2.5 bg-bg-secondary border-b border-border-light">
                    <div>
                        <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            Categories
                        </div>
                        <div className="text-[12.5px] font-semibold text-text-primary">Select Issue Categories</div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="rounded border-none cursor-pointer bg-bg-tertiary text-text-secondary h-6 w-6"
                    >
                        <i className="fas fa-times text-[10px]" />
                    </button>
                </div>
                <div className="flex gap-1.5 p-2 border-b border-border-light">
                    <button
                        type="button"
                        onClick={selectAll}
                        className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-semibold cursor-pointer border-none"
                        style={FIELD_STYLE}
                    >
                        <i className="fas fa-check-double text-[10px]" /> Select All
                    </button>
                    <button
                        type="button"
                        onClick={clearAll}
                        className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-semibold cursor-pointer border-none"
                        style={FIELD_STYLE}
                    >
                        <i className="fas fa-times text-[10px]" /> Clear
                    </button>
                </div>
                <div className="p-2 border-b border-border-light">
                    <div className="flex items-center gap-2 rounded px-2 py-1.5" style={FIELD_STYLE}>
                        <i className="fas fa-search text-[10px] text-text-tertiary" />
                        <input
                            type="text"
                            placeholder="Search tags…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="flex-1 border-none bg-transparent text-[12.5px] outline-none text-text-primary"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-1.5">
                    {filtered.map((opt) => {
                        const tagStyle = TAG_COLORS[opt] || {
                            bg: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)',
                            icon: 'fas fa-tag'
                        }
                        const isSelected = value.includes(opt)
                        return (
                            <div
                                key={opt}
                                onClick={() => toggle(opt)}
                                className="flex items-center gap-2 rounded cursor-pointer mb-0.5 px-2 py-1.5"
                                style={{
                                    background: isSelected ? 'var(--bg-secondary)' : 'transparent'
                                }}
                            >
                                <div
                                    className="flex items-center justify-center rounded text-[9px] text-white h-[18px] w-[18px]"
                                    style={{
                                        background: isSelected ? 'var(--accent, #1e3a5f)' : 'var(--bg-tertiary)',
                                        border: isSelected
                                            ? `1px solid var(--accent, #1e3a5f)`
                                            : '1px solid var(--border-light)'
                                    }}
                                >
                                    {isSelected && <i className="fas fa-check" />}
                                </div>
                                <i className={tagStyle.icon} style={{ color: tagStyle.color, fontSize: 11 }} />
                                <span
                                    className="text-[12px] text-text-primary"
                                    style={{ fontWeight: isSelected ? 600 : 400 }}
                                >
                                    {opt}
                                </span>
                            </div>
                        )
                    })}
                    {filtered.length === 0 && (
                        <div className="p-6 text-center text-[12px] text-text-tertiary">
                            <i className="fas fa-search block text-[16px] mb-1" />
                            <span>No matching tags</span>
                        </div>
                    )}
                </div>
                <div className="p-2 bg-bg-secondary border-t border-border-light">
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="w-full rounded text-[12px] font-bold uppercase tracking-wider text-white py-2 cursor-pointer border-none bg-[var(--accent, #1e3a5f)]"
                    >
                        Done · {value.length} selected
                    </button>
                </div>
            </div>
        </div>
    ) : null

    return (
        <div className="relative w-full">
            <button
                type="button"
                disabled={disabled}
                aria-expanded={open}
                onClick={() => setOpen(true)}
                className={`${FIELD_INPUT_CLASS} flex items-center justify-between text-left cursor-pointer disabled:cursor-not-allowed`}
                style={FIELD_STYLE}
            >
                <span className="flex items-center gap-1.5">
                    <i className="fas fa-tags text-[10px] text-text-tertiary" />
                    {value.length
                        ? `${value.length} tag${value.length > 1 ? 's' : ''} selected`
                        : placeholder || 'Select tags'}
                </span>
                <i className="fas fa-chevron-down text-[9px] text-text-tertiary" />
            </button>
            {typeof document !== 'undefined' && ReactDOM.createPortal(modalContent, document.body)}
        </div>
    )
}

/* ── Issue card primitives ───────────────────────────────────────────────── */

function IssueChip({ children, color = 'var(--text-secondary)', icon, tint = 'var(--bg-tertiary)' }) {
    return (
        <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold"
            style={{ background: tint, color }}
        >
            {icon && <i className={`${icon} text-[9px]`} />}
            {children}
        </span>
    )
}

function IssueCardHeader({ idx, issue, onRemove, readOnly }) {
    return (
        <div className="flex items-center justify-between gap-2 px-2.5 py-2 flex-wrap bg-bg-tertiary border-b border-border-light">
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center justify-center rounded text-[10.5px] font-bold tabular-nums text-white bg-[var(--accent, #1e3a5f)] h-[22px] w-[22px]">
                    {idx + 1}
                </div>
                {issue.plant && (
                    <IssueChip color="#1e40af" icon="fas fa-industry" tint="rgba(59, 130, 246, 0.12)">
                        {issue.plant === 'All' ? 'All Plants' : `Plant ${issue.plant}`}
                    </IssueChip>
                )}
                {issue.date && (
                    <IssueChip color="#15803d" icon="fas fa-calendar" tint="rgba(22, 163, 74, 0.12)">
                        {new Date(issue.date + 'T00:00:00').toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short',
                            weekday: readOnly ? 'short' : undefined
                        })}
                    </IssueChip>
                )}
                {issue.affectsEfficiency && (
                    <IssueChip color="#b91c1c" icon="fas fa-chart-line" tint="rgba(220, 38, 38, 0.12)">
                        Affects Efficiency
                    </IssueChip>
                )}
            </div>
            {!readOnly && onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    title="Remove issue"
                    className="flex items-center justify-center rounded border-none cursor-pointer bg-[rgba(220,_38,_38,_0.12)] text-red-700 h-6 w-6"
                >
                    <i className="fas fa-trash-alt text-[10px]" />
                </button>
            )}
        </div>
    )
}

function TagsDisplay({ onRemoveTag, readOnly, tags }) {
    if (!tags?.length) return null
    return (
        <div className="flex flex-wrap gap-1">
            {tags.map((t) => {
                const tagStyle = TAG_COLORS[t] || {
                    bg: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                    icon: 'fas fa-tag'
                }
                return (
                    <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold"
                        style={{ background: tagStyle.bg, color: tagStyle.color }}
                    >
                        <i className={`${tagStyle.icon} text-[9px]`} />
                        {t}
                        {!readOnly && onRemoveTag && (
                            <button
                                type="button"
                                className="ml-0.5 border-none bg-transparent p-0 cursor-pointer opacity-70 hover:opacity-100"
                                onClick={() => onRemoveTag(t)}
                                style={{ color: tagStyle.color }}
                            >
                                <i className="fas fa-times text-[9px]" />
                            </button>
                        )}
                    </span>
                )
            })}
        </div>
    )
}

function FieldLabel({ children, icon, required }) {
    return (
        <label className={`${SECTION_LABEL_CLASS} flex items-center gap-1.5 text-text-tertiary`}>
            {icon && <i className={`fas ${icon} text-[10px]`} />}
            {children}
            {required && <span className="text-red-600">*</span>}
        </label>
    )
}

function SafetyEmptyState({ success }) {
    return (
        <div className="flex flex-col items-center justify-center gap-1.5 py-8 px-4 rounded bg-bg-secondary border border-border-medium">
            <i
                className={`fas ${success ? 'fa-circle-check' : 'fa-shield-alt'} text-[22px]`}
                style={{ color: success ? '#16a34a' : 'var(--text-tertiary)' }}
            />
            <div className="text-[12.5px] font-semibold" style={{ color: success ? '#15803d' : 'var(--text-primary)' }}>
                {success ? 'All Clear' : 'No Issues Reported'}
            </div>
            <div className="text-[11.5px] text-text-tertiary">
                {success
                    ? 'No safety issues were reported during this reporting period.'
                    : 'Click Add Issue to document any safety incidents.'}
            </div>
        </div>
    )
}

/* ── Submit-mode plugin ─────────────────────────────────────────────────── */

export function SafetyManagerSubmitPlugin({ form, plants, readOnly, setForm }) {
    const [showPlantModal, setShowPlantModal] = useState(false)
    const [selectedIssueIdForPlant, setSelectedIssueIdForPlant] = useState(null)

    /* Migrate legacy string `issues` value into the array shape and seed an
     * empty starter row when the form has no issues yet. */
    useEffect(() => {
        if (typeof form.issues === 'string') {
            const today = ReportUtility.getTodayISODate()
            setForm((f) => ({
                ...f,
                issues: f.issues
                    ? [
                          {
                              affectsEfficiency: false,
                              date: today,
                              description: f.issues,
                              id: Date.now(),
                              plant: '',
                              tag: '',
                              tags: []
                          }
                      ]
                    : [
                          {
                              affectsEfficiency: false,
                              date: today,
                              description: '',
                              id: Date.now(),
                              plant: '',
                              tag: '',
                              tags: []
                          }
                      ]
            }))
        } else if (!form.issues || (Array.isArray(form.issues) && form.issues.length === 0)) {
            const today = ReportUtility.getTodayISODate()
            setForm((f) => ({
                ...f,
                issues: [
                    {
                        affectsEfficiency: false,
                        date: today,
                        description: '',
                        id: Date.now(),
                        plant: '',
                        tag: '',
                        tags: []
                    }
                ]
            }))
        }
    }, [form.issues, setForm])
    /* Backfill missing fields for issues created under older shapes. */
    useEffect(() => {
        if (!Array.isArray(form.issues)) return
        let needsUpdate = false
        const migrated = form.issues.map((i) => {
            const next = { ...i }
            if (!Array.isArray(next.tags)) {
                next.tags = next.tag ? [next.tag] : []
                needsUpdate = true
            }
            if (next.date === undefined) {
                next.date = ''
                needsUpdate = true
            }
            if (next.affectsEfficiency === undefined) {
                next.affectsEfficiency = false
                needsUpdate = true
            }
            return next
        })
        if (needsUpdate) setForm((f) => ({ ...f, issues: migrated }))
    }, [form.issues, setForm])

    const issues = Array.isArray(form.issues) ? form.issues : []

    const updateIssue = (id, patch) => {
        setForm((f) => ({
            ...f,
            issues: issues.map((i) => {
                if (i.id !== id) return i
                const next = { ...i, ...patch }
                if (patch.plant !== undefined && (!patch.plant || patch.plant === 'All')) {
                    next.affectsEfficiency = false
                }
                return next
            })
        }))
    }
    const updateIssueTagsArray = (id, nextArray) => updateIssue(id, { tag: nextArray[0] || '', tags: nextArray })
    const removeIssueTag = (id, tagToRemove) => {
        const issue = issues.find((i) => i.id === id)
        if (!issue) return
        const next = (issue.tags || []).filter((t) => t !== tagToRemove)
        updateIssue(id, { tag: next[0] || '', tags: next })
    }
    const removeIssue = (id) => setForm((f) => ({ ...f, issues: issues.filter((i) => i.id !== id) }))
    const addIssue = () => {
        const today = ReportUtility.getTodayISODate()
        setForm((f) => ({
            ...f,
            issues: [
                ...(f.issues || []),
                {
                    affectsEfficiency: false,
                    date: today,
                    description: '',
                    id: Date.now(),
                    plant: '',
                    tag: '',
                    tags: []
                }
            ]
        }))
    }

    return (
        <div className="rounded p-3 mt-2.5" style={CARD_STYLE}>
            <CardHeader
                icon="fa-exclamation-circle"
                iconBg="rgba(220, 38, 38, 0.12)"
                iconColor="#b91c1c"
                label="Safety"
                title="Issues & Incidents"
                sub="Document any safety-related issues that occurred during this reporting period."
                right={
                    !readOnly ? (
                        <button
                            type="button"
                            onClick={addIssue}
                            className="inline-flex items-center gap-1.5 rounded text-[11.5px] font-bold uppercase tracking-wider text-white px-2.5 py-1.5 cursor-pointer border-none bg-[var(--accent, #1e3a5f)]"
                        >
                            <i className="fas fa-plus text-[10px]" />
                            Add Issue
                        </button>
                    ) : null
                }
            />

            {issues.length === 0 ? (
                <SafetyEmptyState />
            ) : (
                <div className="flex flex-col gap-2">
                    {issues.map((issue, idx) => {
                        const efficiencyDisabled = readOnly || !issue.plant || issue.plant === 'All'
                        const tags = Array.isArray(issue.tags) ? issue.tags : []
                        return (
                            <div
                                key={issue.id}
                                className="rounded overflow-hidden bg-bg-secondary border border-border-light"
                            >
                                <IssueCardHeader
                                    issue={issue}
                                    idx={idx}
                                    onRemove={() => removeIssue(issue.id)}
                                    readOnly={readOnly}
                                />
                                <div className="flex flex-col gap-2.5 p-2.5">
                                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-2">
                                        <div className="flex flex-col gap-1">
                                            <FieldLabel icon="fa-industry" required>
                                                Plant Location
                                            </FieldLabel>
                                            <button
                                                type="button"
                                                disabled={readOnly}
                                                onClick={() => {
                                                    setSelectedIssueIdForPlant(issue.id)
                                                    setShowPlantModal(true)
                                                }}
                                                className={`${FIELD_INPUT_CLASS} flex items-center justify-between text-left cursor-pointer disabled:cursor-not-allowed`}
                                                style={FIELD_STYLE}
                                            >
                                                <span>
                                                    {issue.plant
                                                        ? issue.plant === 'All'
                                                            ? 'All Plants'
                                                            : `Plant ${issue.plant}`
                                                        : 'Select Plant…'}
                                                </span>
                                                <i className="fas fa-chevron-down text-[9px] text-text-tertiary" />
                                            </button>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <FieldLabel icon="fa-calendar-alt">Date of Incident</FieldLabel>
                                            <input
                                                type="date"
                                                disabled={readOnly}
                                                value={issue.date || ''}
                                                onChange={(e) => updateIssue(issue.id, { date: e.target.value })}
                                                className={`${FIELD_INPUT_CLASS} tabular-nums`}
                                                style={FIELD_STYLE}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <FieldLabel icon="fa-tags" required>
                                            Issue Categories
                                        </FieldLabel>
                                        <TagPicker
                                            value={tags}
                                            options={TAG_OPTIONS}
                                            disabled={readOnly}
                                            placeholder="Select categories"
                                            onChange={(vals) => updateIssueTagsArray(issue.id, vals)}
                                        />
                                        {tags.length > 0 && (
                                            <div className="mt-1">
                                                <TagsDisplay
                                                    tags={tags}
                                                    onRemoveTag={(t) => removeIssueTag(issue.id, t)}
                                                    readOnly={readOnly}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <FieldLabel icon="fa-align-left" required>
                                            Issue Description
                                        </FieldLabel>
                                        <textarea
                                            disabled={readOnly}
                                            value={issue.description}
                                            onChange={(e) => updateIssue(issue.id, { description: e.target.value })}
                                            rows={4}
                                            className={`${FIELD_INPUT_CLASS} resize-y min-h-[88px]`}
                                            style={FIELD_STYLE}
                                            placeholder="Describe the incident in detail — what happened, who was involved, and any actions taken…"
                                        />
                                    </div>
                                    <label
                                        className={`flex items-center gap-2 select-none ${
                                            efficiencyDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={!!issue.affectsEfficiency}
                                            disabled={efficiencyDisabled}
                                            onChange={(e) =>
                                                updateIssue(issue.id, { affectsEfficiency: e.target.checked })
                                            }
                                        />
                                        <span
                                            className="relative rounded-full transition-colors shrink-0 w-[30px] h-4"
                                            style={{
                                                background: issue.affectsEfficiency
                                                    ? 'var(--accent, #1e3a5f)'
                                                    : 'var(--border-medium)'
                                            }}
                                        >
                                            <span
                                                className="absolute rounded-full bg-bg-primary transition-all w-3 h-3"
                                                style={{
                                                    top: 2,
                                                    left: issue.affectsEfficiency ? 16 : 2,
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                                                }}
                                            />
                                        </span>
                                        <span className="text-[12px] text-text-secondary">
                                            Should affect plant&apos;s efficiency
                                            {(!issue.plant || issue.plant === 'All') && (
                                                <span className="ml-1 text-[10.5px] text-text-tertiary">
                                                    (select a specific plant first)
                                                </span>
                                            )}
                                        </span>
                                    </label>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <PlantDropdownModal
                isOpen={showPlantModal}
                onClose={() => {
                    setShowPlantModal(false)
                    setSelectedIssueIdForPlant(null)
                }}
                plants={plants}
                showAllPlants={true}
                onSelect={(plantCode) => {
                    if (selectedIssueIdForPlant !== null) {
                        updateIssue(selectedIssueIdForPlant, { plant: plantCode })
                    }
                    setShowPlantModal(false)
                    setSelectedIssueIdForPlant(null)
                }}
            />
        </div>
    )
}

/* ── Review-mode plugin ─────────────────────────────────────────────────── */

function normalizeIssues(formIssues) {
    if (Array.isArray(formIssues)) return formIssues
    if (typeof formIssues === 'string' && formIssues) {
        return [{ affectsEfficiency: false, date: '', description: formIssues, id: 0, plant: '', tag: '', tags: [] }]
    }
    return []
}

function getIssueTags(issue) {
    return Array.isArray(issue.tags) ? issue.tags : issue.tag ? [issue.tag] : []
}

export function SafetyManagerReviewPlugin({ form }) {
    const issues = normalizeIssues(form.issues)
    if (issues.length === 0) {
        return (
            <div className="rounded p-3 mt-2.5" style={CARD_STYLE}>
                <CardHeader
                    icon="fa-shield-alt"
                    iconBg="rgba(22, 163, 74, 0.12)"
                    iconColor="#15803d"
                    label="Safety"
                    title="Issues & Incidents"
                    sub="No safety incidents reported for this period."
                />
                <SafetyEmptyState success />
            </div>
        )
    }
    return (
        <div className="rounded p-3 mt-2.5" style={CARD_STYLE}>
            <CardHeader
                icon="fa-exclamation-circle"
                iconBg="rgba(220, 38, 38, 0.12)"
                iconColor="#b91c1c"
                label="Safety"
                title="Issues & Incidents"
                sub={`${issues.length} issue${issues.length > 1 ? 's' : ''} reported for this period.`}
                right={
                    <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold tabular-nums bg-[rgba(220,_38,_38,_0.12)] text-red-700">
                        <i className="fas fa-clipboard-list text-[9px]" />
                        {issues.length} Incident{issues.length > 1 ? 's' : ''}
                    </span>
                }
            />
            <div className="flex flex-col gap-2">
                {issues.map((issue, idx) => {
                    const tags = getIssueTags(issue)
                    return (
                        <div
                            key={issue.id || idx}
                            className="rounded overflow-hidden bg-bg-secondary border border-border-light"
                        >
                            <IssueCardHeader issue={issue} idx={idx} readOnly />
                            <div className="flex flex-col gap-2 p-2.5">
                                {tags.length > 0 && <TagsDisplay tags={tags} readOnly />}
                                <div className="rounded p-2.5 bg-bg-primary border border-border-light">
                                    <div
                                        className={`${SECTION_LABEL_CLASS} mb-1 flex items-center gap-1.5 text-text-tertiary`}
                                    >
                                        <i className="fas fa-file-alt text-[10px]" />
                                        Description
                                    </div>
                                    <div className="text-[12.5px] leading-relaxed text-text-primary">
                                        {issue.description || (
                                            <span className="italic text-text-tertiary">No description provided.</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
