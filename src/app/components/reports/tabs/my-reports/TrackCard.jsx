/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { usePreferences } from '../../../../context/PreferencesContext'

/* Status drives the left-edge stripe, status badge tone, and primary
 * button color. Replaces the previous per-report-type rainbow of icon
 * tiles (`bg-cyan-600`, `bg-purple-600`, `bg-slate-700`, etc.) which
 * carried no information — the report TYPE is in the title, the STATUS
 * is what the user actually needs to act on. */
const STATUS = {
    in_progress: { label: 'Draft', stripe: 'var(--status-warning)', tone: 'warning' },
    not_started: { label: 'Not started', stripe: 'var(--border-medium)', tone: 'neutral' },
    overdue: { label: 'Overdue', stripe: 'var(--status-danger)', tone: 'danger' },
    submitted: { label: 'Submitted', stripe: 'var(--status-success)', tone: 'success' }
}

const HISTORY_COLOR = {
    done: 'var(--status-success)',
    due: 'var(--border-medium)',
    late: 'var(--status-warning)',
    miss: 'var(--status-danger)'
}

const BADGE_TONE_BG = {
    danger: 'color-mix(in srgb, var(--status-danger) 12%, transparent)',
    neutral: 'var(--bg-tertiary)',
    success: 'color-mix(in srgb, var(--status-success) 12%, transparent)',
    warning: 'color-mix(in srgb, var(--status-warning) 14%, transparent)'
}

const BADGE_TONE_FG = {
    danger: 'var(--status-danger)',
    neutral: 'var(--text-secondary)',
    success: 'var(--status-success)',
    warning: 'var(--status-warning)'
}

/**
 * Single weekly-report card. Status is the only colored signal — carried
 * by a 3px stripe on the left edge and the status badge in the title row.
 * No per-report-type icon coloring; the report TYPE lives in the title.
 * History strip is inline with the title row so the card is one block
 * instead of three stacked rows.
 */
function TrackCard({ item, history = [], onStart, onContinue, onView, plantLabel }) {
    const { preferences } = usePreferences()
    const accent = preferences.accentColor || '#1e3a5f'
    if (!item) return null
    const { completed, name: _name, title, report, weekIso, subLabel } = item
    const hasSavedData = !!report?.data
    const status = completed
        ? 'submitted'
        : item.status === 'overdue'
          ? 'overdue'
          : hasSavedData
            ? 'in_progress'
            : 'not_started'
    const cfg = STATUS[status]
    const handleAction = () => {
        if (status === 'submitted') return onView?.(item)
        if (status === 'in_progress') return onContinue?.(item)
        return onStart?.(item)
    }
    const buttonLabel =
        status === 'submitted'
            ? 'View'
            : status === 'in_progress'
              ? 'Continue'
              : status === 'overdue'
                ? 'Submit'
                : 'Start'
    const isViewMode = status === 'submitted'
    const contextLine =
        subLabel ||
        (completed
            ? `${plantLabel ? plantLabel + ' · ' : ''}Submitted`
            : `${plantLabel ? plantLabel + ' · ' : ''}due Mon 7:00 AM CST`)

    return (
        <article className="rounded-lg flex overflow-hidden border bg-bg-primary border-border-light">
            <div className="w-[3px] shrink-0" style={{ background: cfg.stripe }} aria-hidden="true" />
            <div className="flex-1 min-w-0 px-3.5 py-3 flex flex-col gap-2">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[13.5px] leading-tight text-text-primary font-heading truncate">
                            {title}
                        </div>
                        <div className="text-[11.5px] mt-0.5 text-text-secondary truncate">{contextLine}</div>
                    </div>
                    <span
                        className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide"
                        style={{ background: BADGE_TONE_BG[cfg.tone], color: BADGE_TONE_FG[cfg.tone] }}
                    >
                        {cfg.label}
                    </span>
                </div>

                {history.length > 0 && (
                    <div className="flex items-center gap-1">
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-text-tertiary mr-1">
                            {history.length}w
                        </span>
                        {history.map((seg, idx) => (
                            <span
                                key={`${weekIso}-h-${idx}`}
                                className="flex-1 h-1 rounded-sm"
                                style={{ background: HISTORY_COLOR[seg] || HISTORY_COLOR.due }}
                                title={seg}
                            />
                        ))}
                        <span
                            className="flex-1 h-1.5 rounded-sm"
                            style={{ background: cfg.stripe }}
                            title="this week"
                        />
                    </div>
                )}

                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={handleAction}
                        className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-md border-none cursor-pointer active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                        style={
                            isViewMode
                                ? {
                                      background: 'var(--bg-tertiary)',
                                      color: 'var(--text-primary)'
                                  }
                                : {
                                      background: status === 'overdue' ? 'var(--status-danger)' : accent,
                                      color: '#fff'
                                  }
                        }
                    >
                        {isViewMode && <i className="far fa-eye text-[10px]" />}
                        {buttonLabel}
                        {!isViewMode && <i className="fas fa-arrow-right text-[10px]" />}
                    </button>
                </div>
            </div>
        </article>
    )
}

export default TrackCard
