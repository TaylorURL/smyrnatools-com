/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { ListService } from '../../../services/ListService'
import {
    ROLE_MAP,
    ROLE_OPTIONS,
    STATUS_COLORS,
    STATUS_MAP,
    STATUS_OPTIONS,
    VIEW_MODES
} from '../../constants/listViewConstants'
import Badge from '../common/Badge'
import ListQuickAdd from './ListQuickAdd'

/**
 * View definitions: the row of icon buttons at the very left of the filter
 * bar. List = grouped row layout; Board = kanban columns; Activity = the
 * change feed. Group-by only applies in List view (Board groups by status,
 * Activity is a flat timeline) — the Group segmented control disables when
 * a different view is active.
 */
const LAYOUT_OPTIONS = [
    { icon: 'fa-list-ul', id: 'list', label: 'List' },
    { icon: 'fa-table-columns', id: 'board', label: 'Board' },
    { icon: 'fa-clock-rotate-left', id: 'activity', label: 'Activity' }
]

const GROUP_OPTIONS = VIEW_MODES.filter((m) => m.id !== 'activity')

function chipBtnClass(active, isMobile) {
    return [
        'inline-flex items-center gap-1.5 rounded-md text-[11.5px] font-medium transition-[background-color,color,transform] duration-150 ease-out motion-reduce:transition-none active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        isMobile ? 'px-2 py-1' : 'px-2.5 py-1.5',
        active
            ? 'bg-text-primary text-bg-primary'
            : 'bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary'
    ].join(' ')
}

/**
 * Sticky filter bar inside the page's TopSection custom-bottom slot. Owns
 * the layout toggle (List · Board · Activity), grouping segmented control,
 * and a combined Filters popover for status + role. The overdue indicator
 * is a quiet inline chip; the total count is a subtle stat label.
 */
export default function ListFilterBar({
    accentColor,
    isMobile,
    layout,
    onClearRoleFilter,
    onClearStatusFilter,
    onLayoutChange,
    onRoleFilterChange,
    onStatusFilterChange,
    onViewModeChange,
    quickAddProps,
    roleFilter,
    statusFilter,
    summaryStats,
    viewMode
}) {
    const filtersBtnRef = useRef(null)
    const filtersMenuRef = useRef(null)
    const [filtersOpen, setFiltersOpen] = useState(false)

    useEffect(() => {
        const onDoc = (e) => {
            if (filtersMenuRef.current?.contains(e.target)) return
            if (filtersBtnRef.current?.contains(e.target)) return
            setFiltersOpen(false)
        }
        if (filtersOpen) document.addEventListener('mousedown', onDoc)
        return () => document.removeEventListener('mousedown', onDoc)
    }, [filtersOpen])

    const isBoard = layout === 'board'
    const isActivity = layout === 'activity'
    const groupingDisabled = isBoard || isActivity
    const activeFilterCount = useMemo(() => (statusFilter ? 1 : 0) + (roleFilter ? 1 : 0), [statusFilter, roleFilter])

    const statusDisplay = STATUS_MAP[statusFilter]
    const roleDisplay = ROLE_MAP[roleFilter]

    const onSelectStatus = (label) => {
        if (label === statusDisplay) {
            onClearStatusFilter?.()
        } else {
            onStatusFilterChange?.(label)
        }
    }

    const onSelectRole = (label) => {
        if (label === roleDisplay) {
            onClearRoleFilter?.()
        } else {
            onRoleFilterChange?.(label)
        }
    }

    return (
        <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-border-light bg-bg-secondary px-3 py-2">
            <div
                role="group"
                aria-label="View"
                className="inline-flex items-center gap-0.5 rounded-md border border-border-light bg-bg-primary p-0.5"
            >
                {LAYOUT_OPTIONS.map((opt) => {
                    const active = layout === opt.id
                    return (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => onLayoutChange?.(opt.id)}
                            aria-pressed={active}
                            className={chipBtnClass(active, isMobile)}
                            title={`${opt.label} view`}
                        >
                            <i className={`fas ${opt.icon} text-[11px]`} aria-hidden="true" />
                            {!isMobile && <span>{opt.label}</span>}
                        </button>
                    )
                })}
            </div>

            {!groupingDisabled && (
                <div
                    role="group"
                    aria-label="Group by"
                    className="inline-flex items-center gap-0.5 rounded-md border border-border-light bg-bg-primary p-0.5"
                >
                    {GROUP_OPTIONS.map((opt) => {
                        const active = viewMode === opt.id
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => onViewModeChange?.(opt.id)}
                                aria-pressed={active}
                                className={chipBtnClass(active, isMobile)}
                                title={`Group by ${opt.label.toLowerCase()}`}
                            >
                                <i className={`fas ${opt.icon} text-[11px]`} aria-hidden="true" />
                                {!isMobile && <span>{opt.label}</span>}
                            </button>
                        )
                    })}
                </div>
            )}

            <div className="relative">
                <button
                    ref={filtersBtnRef}
                    type="button"
                    onClick={() => setFiltersOpen((o) => !o)}
                    aria-haspopup="menu"
                    aria-expanded={filtersOpen}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        activeFilterCount > 0
                            ? 'text-accent'
                            : 'border-border-light bg-bg-primary text-text-secondary hover:bg-bg-hover'
                    }`}
                    style={
                        activeFilterCount > 0
                            ? {
                                  background: `${accentColor}1a`,
                                  borderColor: `${accentColor}66`
                              }
                            : undefined
                    }
                >
                    <i className="fas fa-filter text-[10px] opacity-80" aria-hidden="true" />
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                        <span
                            className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9.5px] font-bold tabular-nums"
                            style={{ background: 'var(--accent)', color: 'white' }}
                        >
                            {activeFilterCount}
                        </span>
                    )}
                    <i
                        className={`fas fa-chevron-down text-[8px] opacity-60 transition-transform duration-150 ${filtersOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                    />
                </button>
                {filtersOpen && (
                    <div
                        ref={filtersMenuRef}
                        role="menu"
                        className="absolute left-0 top-full z-50 mt-1.5 w-[280px] origin-top-left rounded-lg border border-border-light bg-bg-primary p-3 shadow-[0_12px_32px_rgba(0,0,0,0.18)] animate-filter-fade"
                        style={{ transformOrigin: 'top left' }}
                    >
                        <div className="space-y-3">
                            <div>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                                        Status
                                    </span>
                                    {statusFilter && (
                                        <button
                                            type="button"
                                            onClick={() => onClearStatusFilter?.()}
                                            className="text-[10.5px] font-medium text-text-tertiary hover:text-text-primary"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {STATUS_OPTIONS.map((label) => {
                                        const key = Object.keys(STATUS_MAP).find((k) => STATUS_MAP[k] === label)
                                        const color = STATUS_COLORS[key] || STATUS_COLORS.pending
                                        const active = statusDisplay === label
                                        return (
                                            <button
                                                key={label}
                                                type="button"
                                                onClick={() => onSelectStatus(label)}
                                                aria-pressed={active}
                                                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider transition-[transform,box-shadow] duration-150 active:scale-[0.97]`}
                                                style={{
                                                    background: active ? color.bg : 'var(--bg-tertiary)',
                                                    borderColor: active ? color.border : 'var(--border-light)',
                                                    color: active ? color.text : 'var(--text-secondary)'
                                                }}
                                            >
                                                <i
                                                    className={`fas ${ListService.getStatusIcon(key)} text-[8px]`}
                                                    aria-hidden="true"
                                                />
                                                {label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                                        Assigned to
                                    </span>
                                    {roleFilter && (
                                        <button
                                            type="button"
                                            onClick={() => onClearRoleFilter?.()}
                                            className="text-[10.5px] font-medium text-text-tertiary hover:text-text-primary"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {ROLE_OPTIONS.map((label) => {
                                        const active = roleDisplay === label
                                        return (
                                            <button
                                                key={label}
                                                type="button"
                                                onClick={() => onSelectRole(label)}
                                                aria-pressed={active}
                                                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider transition-[transform,box-shadow] duration-150 active:scale-[0.97]`}
                                                style={{
                                                    background: active ? `${accentColor}1a` : 'var(--bg-tertiary)',
                                                    borderColor: active ? `${accentColor}55` : 'var(--border-light)',
                                                    color: active ? accentColor : 'var(--text-secondary)'
                                                }}
                                            >
                                                <i className="fas fa-user text-[8px]" aria-hidden="true" />
                                                {label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {quickAddProps && (
                <div className="order-last basis-full min-w-0 lg:order-none lg:basis-auto lg:flex-1 lg:min-w-[220px] lg:max-w-[480px]">
                    <ListQuickAdd dense {...quickAddProps} />
                </div>
            )}

            <div className="ml-auto flex items-center gap-3">
                {summaryStats.overdue > 0 && (
                    <Badge
                        tone="danger"
                        size={isMobile ? 'xs' : 'sm'}
                        icon="circle-exclamation"
                        onClick={() => onStatusFilterChange?.('Overdue')}
                        title={`${summaryStats.overdue} overdue — click to filter`}
                    >
                        {isMobile ? summaryStats.overdue : `${summaryStats.overdue} overdue`}
                    </Badge>
                )}
                <span className={`text-text-tertiary ${isMobile ? 'text-[10.5px]' : 'text-[11.5px]'}`}>
                    <span className="font-semibold text-text-primary tabular-nums">{summaryStats.total}</span>
                    {!isMobile && ' tasks'}
                </span>
            </div>
        </div>
    )
}
