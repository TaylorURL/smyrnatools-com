import React, { useMemo, useState } from 'react'

import Badge from '../../../app/components/common/Badge'
import { useAccentColor } from '../../../app/hooks/useAccentColor'
import releaseEntries from '../../../data/releases.json'

const GITHUB_URL = 'https://github.com/bradley-t-t'

/**
 * Displays a timeline of application releases derived from git release commits at build time.
 * Each version shows as a collapsible card that expands to show its bullet-pointed changes.
 *
 * @param {Function} onBack - Callback to return to the previous view.
 */
function ChangelogView({ onBack }) {
    const entries = useMemo(() => releaseEntries ?? [], [])
    const [expandedVersion, setExpandedVersion] = useState(() => entries[0]?.version ?? null)
    const accentColor = useAccentColor()
    const parseLocalDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-').map(Number)
        return new Date(year, month - 1, day)
    }
    const formatDate = (dateStr) => {
        try {
            return parseLocalDate(dateStr).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            })
        } catch {
            return dateStr
        }
    }
    const getRelativeTime = (dateStr) => {
        try {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const date = parseLocalDate(dateStr)
            const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24))
            if (diffDays <= 0) return 'Today'
            if (diffDays === 1) return 'Yesterday'
            if (diffDays < 7) return `${diffDays} days ago`
            if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
            return formatDate(dateStr)
        } catch {
            return dateStr
        }
    }
    const currentVersion = entries[0]?.version || '-'
    const totalUpdates = entries.length
    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50">
            {/* Header */}
            <div className="shrink-0 px-5 pt-4 pb-5 bg-white border-b border-slate-200">
                <div className="flex items-center justify-between mb-5">
                    <button
                        onClick={onBack}
                        aria-label="Back"
                        className="flex items-center justify-center w-9 h-9 bg-slate-100 rounded-xl text-slate-600 border-none cursor-pointer hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                    >
                        <i className="fas fa-arrow-left text-sm" />
                    </button>
                    <a
                        href={GITHUB_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open GitHub repository"
                        className="flex items-center justify-center w-9 h-9 bg-slate-100 rounded-xl text-slate-600 no-underline hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                    >
                        <i className="fab fa-github" />
                    </a>
                </div>
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <h1 className="text-[22px] font-bold text-slate-800 m-0 leading-tight">Release Notes</h1>
                        <p className="text-slate-400 text-[12px] mt-1.5 mb-0">
                            {totalUpdates} releases · updated {getRelativeTime(entries[0]?.date)}
                        </p>
                    </div>
                    <div className="text-right shrink-0">
                        <div
                            className="text-[30px] font-extrabold leading-none tracking-tight"
                            style={{ color: accentColor }}
                        >
                            v{currentVersion}
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="text-[11px] text-slate-400">Latest</span>
                        </div>
                    </div>
                </div>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="flex flex-col gap-3 pb-4">
                    {entries.map((entry, idx) => {
                        const isLatest = idx === 0
                        const isExpanded = expandedVersion === entry.version
                        const relative = getRelativeTime(entry.date)
                        const formatted = formatDate(entry.date)
                        const showBoth = relative !== formatted
                        return (
                            <div
                                key={entry.version}
                                className={`bg-white rounded-2xl overflow-hidden ${
                                    isLatest ? 'ring-2 shadow-sm' : 'border border-slate-200'
                                }`}
                                style={isLatest ? { '--tw-ring-color': accentColor } : undefined}
                            >
                                <div
                                    onClick={() => setExpandedVersion(isExpanded ? null : entry.version)}
                                    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-slate-50/80 transition-colors"
                                >
                                    <div
                                        className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                                            isLatest ? '' : 'bg-slate-100'
                                        }`}
                                        style={isLatest ? { backgroundColor: accentColor } : undefined}
                                    >
                                        <i
                                            className={`fas fa-code-branch text-[13px] ${
                                                isLatest ? 'text-white' : 'text-slate-400'
                                            }`}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="text-[14px] font-bold tabular-nums"
                                                style={{ color: accentColor }}
                                            >
                                                v{entry.version}
                                            </span>
                                            {isLatest && (
                                                <Badge
                                                    tone="success"
                                                    variant="outline"
                                                    size="xs"
                                                    shape="pill"
                                                    weight="bold"
                                                >
                                                    Latest
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[11px] text-slate-400">
                                                {relative}
                                                {showBoth ? ` · ${formatted}` : ''}
                                                {' · '}
                                                {entry.changes.length} change
                                                {entry.changes.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </div>
                                    <i
                                        className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-slate-300 text-[10px]`}
                                    />
                                </div>
                                {isExpanded && (
                                    <div className="border-t border-slate-100 px-4 pt-3 pb-4">
                                        <div className="flex flex-col gap-1.5">
                                            {entry.changes.map((change, i) => (
                                                <div key={i} className="flex items-start gap-2.5">
                                                    <div className="shrink-0 w-[18px] h-[18px] rounded-md flex items-center justify-center mt-[2px] bg-slate-100">
                                                        <i className="fas fa-check text-[8px] text-slate-400" />
                                                    </div>
                                                    <span className="text-[13px] text-slate-600 leading-relaxed">
                                                        {change}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
export default ChangelogView
