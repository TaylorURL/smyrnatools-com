/* eslint-disable react/forbid-dom-props */
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import {
    CARD_STYLE,
    FIELD_SELECT_CLASS,
    FIELD_STYLE,
    SECTION_LABEL_CLASS
} from '../../../app/constants/weeklyReportConstants'
import { useAccentColor } from '../../../app/hooks/useAccentColor'
import { QualityIssueService } from '../../../services/QualityIssueService'
import StatsSidebar from './parts/StatsSidebar'
import QualityIssueModal from './QualityIssueModal'

const STATUS_DEFS = {
    active: { color: '#dc2626', icon: 'fa-fire', label: 'Active' },
    closed: { color: '#16a34a', icon: 'fa-circle-check', label: 'Closed' },
    follow_up: { color: '#0ea5e9', icon: 'fa-arrow-rotate-right', label: 'Follow Up' },
    holding: { color: '#d97706', icon: 'fa-pause', label: 'Holding' }
}
const STATUS_ORDER = ['active', 'follow_up', 'holding', 'closed']

const SEVERITY_DEFS = {
    critical: { color: '#b91c1c', label: 'Critical' },
    high: { color: '#dc2626', label: 'High' },
    low: { color: 'var(--text-secondary)', label: 'Low' },
    medium: { color: '#d97706', label: 'Medium' }
}

function formatDate(value) {
    if (!value) return '—'
    try {
        return new Date(value).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' })
    } catch {
        return '—'
    }
}

function formatCurrency(value) {
    if (value === null || value === undefined || value === '') return '—'
    const n = Number(value)
    if (!Number.isFinite(n)) return '—'
    return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: n % 1 === 0 ? 0 : 2 })}`
}

function getPlantName(plantCode, plants) {
    if (!plantCode) return ''
    const p = plants?.find((x) => (x.plant_code || x.code) === plantCode)
    return p?.plant_name || p?.name || ''
}

function CardHeader({ icon, label, sub, title, right }) {
    return (
        <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary text-text-secondary">
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

function StatusPill({ status, size = 'sm' }) {
    const def = STATUS_DEFS[status] || { color: 'var(--text-secondary)', icon: 'fa-circle', label: status || '—' }
    const fontSize = size === 'lg' ? '11.5px' : '10.5px'
    return (
        <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider"
            style={{
                background: `${def.color}1f`,
                border: `1px solid ${def.color}55`,
                color: 'var(--text-primary)',
                fontSize
            }}
        >
            <i className={`fas ${def.icon} text-[9px]`} />
            {def.label}
        </span>
    )
}

function StatusFilterChips({ activeStatus, counts, onChange }) {
    const ACTIVE_BG = (color) => `${color}26`
    return (
        <div className="flex flex-wrap gap-1">
            <button
                type="button"
                onClick={() => onChange('all')}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wider cursor-pointer border-none border border-border-light"
                style={{
                    background: activeStatus === 'all' ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                    color: activeStatus === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)'
                }}
            >
                All
                <span className="ml-1 tabular-nums text-text-tertiary">{counts.total}</span>
            </button>
            {STATUS_ORDER.map((status) => {
                const def = STATUS_DEFS[status]
                const active = activeStatus === status
                return (
                    <button
                        key={status}
                        type="button"
                        onClick={() => onChange(status)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wider cursor-pointer border-none"
                        style={{
                            background: active ? ACTIVE_BG(def.color) : 'var(--bg-secondary)',
                            border: `1px solid ${active ? `${def.color}55` : 'var(--border-light)'}`,
                            color: active ? 'var(--text-primary)' : 'var(--text-secondary)'
                        }}
                    >
                        <i className={`fas ${def.icon} text-[9px]`} />
                        {def.label}
                        <span className="ml-1 tabular-nums text-text-tertiary">{counts[status] || 0}</span>
                    </button>
                )
            })}
        </div>
    )
}

export default function QualityIssuesView({ plants = [], regionCode = '' }) {
    const accentColor = useAccentColor()
    const [issues, setIssues] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [plantFilter, setPlantFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [editingIssue, setEditingIssue] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [refreshing, setRefreshing] = useState(false)

    const reload = useCallback(async () => {
        setRefreshing(true)
        try {
            const data = await QualityIssueService.list({ regionCode: regionCode || null })
            setIssues(data)
            setError('')
        } catch (err) {
            setError(err?.message || 'Failed to load quality issues.')
        } finally {
            setRefreshing(false)
            setLoading(false)
        }
    }, [regionCode])

    useEffect(() => {
        reload()
    }, [reload])

    const counts = useMemo(() => {
        const out = { active: 0, closed: 0, follow_up: 0, holding: 0, total: issues.length }
        for (const issue of issues) {
            const s = issue.status || ''
            if (out[s] !== undefined) out[s] += 1
        }
        return out
    }, [issues])

    const visibleIssues = useMemo(() => {
        const lower = search.trim().toLowerCase()
        return issues.filter((issue) => {
            if (statusFilter !== 'all' && issue.status !== statusFilter) return false
            if (plantFilter !== 'all' && issue.plant_code !== plantFilter) return false
            if (lower) {
                const haystack =
                    `${issue.title || ''} ${issue.description || ''} ${issue.plant_code || ''}`.toLowerCase()
                if (!haystack.includes(lower)) return false
            }
            return true
        })
    }, [issues, search, statusFilter, plantFilter])

    const openCreate = () => {
        setEditingIssue(null)
        setShowModal(true)
    }

    const openEdit = (issue) => {
        setEditingIssue(issue)
        setShowModal(true)
    }

    const handleSaved = (saved) => {
        if (!saved) return
        setIssues((prev) => {
            const idx = prev.findIndex((i) => i.id === saved.id)
            if (idx === -1) return [saved, ...prev]
            const next = prev.slice()
            next[idx] = saved
            return next
        })
        setShowModal(false)
        setEditingIssue(null)
    }

    const handleDeleted = (deletedId) => {
        setIssues((prev) => prev.filter((i) => i.id !== deletedId))
        setShowModal(false)
        setEditingIssue(null)
    }

    const plantOptions = useMemo(() => {
        const codes = new Set(issues.map((i) => i.plant_code).filter(Boolean))
        ;(plants || []).forEach((p) => {
            const code = p.plant_code || p.code
            if (code) codes.add(code)
        })
        return Array.from(codes).sort()
    }, [issues, plants])

    return (
        <div className="w-full">
            <div className="w-full">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-2.5 items-start">
                    <div className="flex flex-col gap-2.5 min-w-0">
                        {/* Toolbar card — search + plant + new button */}
                        <div className="rounded p-3 flex flex-col gap-2" style={CARD_STYLE}>
                            <CardHeader
                                icon="fa-flask"
                                label="Quality"
                                title="Quality Issues"
                                sub="Active QC disputes and follow-ups, plus closed issues with the cost incurred to close."
                                right={
                                    <button
                                        type="button"
                                        onClick={openCreate}
                                        className="inline-flex items-center gap-1.5 rounded text-[12px] font-bold uppercase tracking-wider text-white px-3 py-1.5 cursor-pointer border-none"
                                        style={{ background: accentColor }}
                                    >
                                        <i className="fas fa-plus text-[10px]" />
                                        New Issue
                                    </button>
                                }
                            />
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusFilterChips
                                    activeStatus={statusFilter}
                                    counts={counts}
                                    onChange={setStatusFilter}
                                />
                                <div className="flex-1 flex items-center gap-2 min-w-[200px]">
                                    <input
                                        type="search"
                                        aria-label="Search quality issues"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search title, description, plant…"
                                        className="flex-1 rounded px-2.5 py-1.5 text-[12.5px] outline-none transition-colors duration-150 hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary placeholder:text-text-tertiary [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none"
                                        style={FIELD_STYLE}
                                    />
                                    <select
                                        value={plantFilter}
                                        onChange={(e) => setPlantFilter(e.target.value)}
                                        aria-label="Filter by plant"
                                        className={FIELD_SELECT_CLASS}
                                        style={FIELD_STYLE}
                                    >
                                        <option value="all">All plants</option>
                                        {plantOptions.map((code) => (
                                            <option key={code} value={code}>
                                                {code}
                                                {getPlantName(code, plants) ? ` · ${getPlantName(code, plants)}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Table card */}
                        <div className="rounded overflow-hidden" style={CARD_STYLE}>
                            {loading ? (
                                <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-text-tertiary">
                                    <i className="fas fa-circle-notch fa-spin text-[11px]" />
                                    Loading issues…
                                </div>
                            ) : error ? (
                                <div
                                    className="m-3 flex items-center gap-1.5 rounded-md border border-status-danger/30 bg-status-danger/10 px-2.5 py-1.5 text-[11.5px] font-medium text-text-primary animate-fade-slide-in"
                                    role="alert"
                                >
                                    <i
                                        className="fas fa-exclamation-circle text-[11px] text-status-danger"
                                        aria-hidden="true"
                                    />
                                    {error}
                                </div>
                            ) : visibleIssues.length === 0 ? (
                                <div className="m-3 rounded p-6 text-center bg-bg-secondary border border-border-medium text-text-tertiary">
                                    <i className="fas fa-flask text-[20px] block mb-1" />
                                    <div className="text-[12px]">
                                        {issues.length === 0
                                            ? 'No quality issues yet. Click "New Issue" to log the first one.'
                                            : 'No issues match the current filters.'}
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr>
                                                {[
                                                    'Title',
                                                    'Plant',
                                                    'Severity',
                                                    'Status',
                                                    'Opened',
                                                    'Closed',
                                                    'Cost'
                                                ].map((h, i) => (
                                                    <th
                                                        key={h}
                                                        className={`${SECTION_LABEL_CLASS} px-3 py-2 whitespace-nowrap bg-bg-tertiary text-text-tertiary border-b border-border-light`}
                                                        style={{ textAlign: i === 6 ? 'right' : 'left' }}
                                                    >
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleIssues.map((issue) => {
                                                const sev = SEVERITY_DEFS[issue.severity]
                                                return (
                                                    <tr
                                                        key={issue.id}
                                                        onClick={() => openEdit(issue)}
                                                        className="cursor-pointer border-t border-border-light text-text-primary"
                                                    >
                                                        <td className="px-3 py-2 align-top">
                                                            <div className="text-[12.5px] font-semibold leading-tight text-text-primary">
                                                                {issue.title || 'Untitled'}
                                                            </div>
                                                            {issue.description && (
                                                                <div
                                                                    className="text-[11px] mt-0.5 leading-snug truncate text-text-tertiary"
                                                                    style={{ maxWidth: 380 }}
                                                                    title={issue.description}
                                                                >
                                                                    {issue.description}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 align-top whitespace-nowrap">
                                                            {issue.plant_code ? (
                                                                <span
                                                                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums bg-bg-tertiary border border-border-light text-text-secondary"
                                                                    title={getPlantName(issue.plant_code, plants)}
                                                                >
                                                                    {issue.plant_code}
                                                                </span>
                                                            ) : (
                                                                <span className="text-text-tertiary">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 align-top whitespace-nowrap">
                                                            {sev ? (
                                                                <span
                                                                    className="text-[11.5px] font-semibold uppercase tracking-wider"
                                                                    style={{ color: 'var(--text-primary)' }}
                                                                >
                                                                    {sev.label}
                                                                </span>
                                                            ) : (
                                                                <span className="text-text-tertiary">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 align-top whitespace-nowrap">
                                                            <StatusPill status={issue.status} />
                                                        </td>
                                                        <td className="px-3 py-2 align-top whitespace-nowrap text-[12px] tabular-nums text-text-secondary">
                                                            {formatDate(issue.opened_at)}
                                                        </td>
                                                        <td className="px-3 py-2 align-top whitespace-nowrap text-[12px] tabular-nums text-text-secondary">
                                                            {formatDate(issue.closed_at)}
                                                        </td>
                                                        <td
                                                            className="px-3 py-2 align-top whitespace-nowrap text-[12.5px] font-bold text-right tabular-nums"
                                                            style={{
                                                                color:
                                                                    issue.status === 'closed' && issue.cost_to_close
                                                                        ? 'var(--text-primary)'
                                                                        : 'var(--text-tertiary)'
                                                            }}
                                                        >
                                                            {formatCurrency(issue.cost_to_close)}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="lg:sticky lg:top-3 self-start min-w-0">
                        <StatsSidebar issues={issues} onRefresh={reload} refreshing={refreshing} />
                    </div>
                </div>
            </div>

            {showModal && (
                <QualityIssueModal
                    issue={editingIssue}
                    onClose={() => {
                        setShowModal(false)
                        setEditingIssue(null)
                    }}
                    onDeleted={handleDeleted}
                    onSaved={handleSaved}
                    plants={plants}
                    regionCode={regionCode}
                />
            )}
        </div>
    )
}
