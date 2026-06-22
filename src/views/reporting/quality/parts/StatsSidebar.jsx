/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
const CARD_STYLE = { background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }

const STATUS_DEFS = {
    active: { color: '#dc2626', icon: 'fa-fire', label: 'Active' },
    closed: { color: '#16a34a', icon: 'fa-circle-check', label: 'Closed' },
    follow_up: { color: '#0ea5e9', icon: 'fa-arrow-rotate-right', label: 'Follow Up' },
    holding: { color: '#d97706', icon: 'fa-pause', label: 'Holding' }
}
const STATUS_ORDER = ['active', 'follow_up', 'holding', 'closed']

function formatCurrency(value) {
    if (value === null || value === undefined || value === '') return '—'
    const n = Number(value)
    if (!Number.isFinite(n)) return '—'
    return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: n % 1 === 0 ? 0 : 2 })}`
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

function StatTile({ hint, label, value }) {
    return (
        <div className="rounded p-2.5 flex flex-col gap-0.5 bg-bg-secondary border border-border-light">
            <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                {label}
            </span>
            <span className="text-[16px] font-bold leading-tight tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {value}
            </span>
            {hint && <span className="text-[10.5px] text-text-tertiary">{hint}</span>}
        </div>
    )
}

export default function StatsSidebar({ issues, onRefresh, refreshing }) {
    const counts = useMemo(() => {
        const out = { active: 0, closed: 0, follow_up: 0, holding: 0, total: issues.length }
        for (const issue of issues) {
            const s = issue.status || ''
            if (out[s] !== undefined) out[s] += 1
        }
        return out
    }, [issues])

    const closedIssues = useMemo(() => issues.filter((i) => i.status === 'closed'), [issues])

    const totalCost = useMemo(
        () => closedIssues.reduce((sum, i) => sum + (Number(i.cost_to_close) || 0), 0),
        [closedIssues]
    )

    const avgCost = closedIssues.length ? totalCost / closedIssues.length : 0

    const monthCost = useMemo(() => {
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth()
        return closedIssues.reduce((sum, i) => {
            if (!i.closed_at) return sum
            const d = new Date(i.closed_at)
            return d.getFullYear() === year && d.getMonth() === month ? sum + (Number(i.cost_to_close) || 0) : sum
        }, 0)
    }, [closedIssues])

    const avgDaysToClose = useMemo(() => {
        if (closedIssues.length === 0) return null
        const totalDays = closedIssues.reduce((sum, i) => {
            if (!i.opened_at || !i.closed_at) return sum
            const days = (new Date(i.closed_at) - new Date(i.opened_at)) / 86400000
            return sum + Math.max(0, days)
        }, 0)
        return totalDays / closedIssues.length
    }, [closedIssues])

    return (
        <div className="rounded p-3 flex flex-col gap-2.5" style={CARD_STYLE}>
            <CardHeader
                icon="fa-chart-pie"
                label="Quality"
                title="Issue stats"
                sub="Live counts and cost rollups across the visible scope."
                right={
                    <button type="button"
                        onClick={onRefresh}
                        disabled={refreshing}
                        className="inline-flex items-center gap-1 rounded text-[10.5px] font-semibold cursor-pointer border-none px-2 py-1 bg-bg-secondary border border-border-light text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
                        title="Refresh"
                        aria-label="Refresh"
                    >
                        <i
                            className={`fas ${refreshing ? 'fa-circle-notch fa-spin' : 'fa-rotate-right'} text-[10px]`}
                        />
                    </button>
                }
            />
            <div className="grid grid-cols-2 gap-2">
                {STATUS_ORDER.map((status) => (
                    <StatTile key={status} label={STATUS_DEFS[status].label} value={counts[status] || 0} />
                ))}
            </div>
            <div className="h-px bg-[var(--border-light)]" />
            <div className="grid grid-cols-1 gap-2">
                <StatTile
                    label="Total cost incurred"
                    value={formatCurrency(totalCost)}
                    hint={`${closedIssues.length} closed issue${closedIssues.length === 1 ? '' : 's'}`}
                />
                <StatTile label="This month" value={formatCurrency(monthCost)} hint="Closed in current month" />
                <StatTile label="Avg cost / closed" value={formatCurrency(avgCost)} />
                <StatTile
                    label="Avg time to close"
                    value={avgDaysToClose !== null ? `${avgDaysToClose.toFixed(1)} d` : '—'}
                />
            </div>
        </div>
    )
}
