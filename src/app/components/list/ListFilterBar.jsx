/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { ListService } from '../../../services/ListService'
import {
    ROLE_MAP,
    ROLE_OPTIONS,
    STATUS_COLORS,
    STATUS_MAP,
    STATUS_OPTIONS,
    VIEW_MODES
} from '../../constants/listViewConstants'

const dropdownTrigger = (isMobile) =>
    `flex items-center rounded cursor-pointer font-medium transition-all duration-150 ${
        isMobile ? 'text-[11px] gap-1 px-2 py-[5px]' : 'text-xs gap-1.5 px-2.5 py-1.5'
    } text-text-secondary`

const dropdownItemClass =
    'flex items-center gap-2.5 w-full rounded px-3 py-2 text-xs font-medium cursor-pointer transition-all duration-100 border-none bg-transparent text-text-primary'

const setHoverBg = (color) => (e) => (e.currentTarget.style.background = color)

/**
 * Sticky filter bar inside TopSection's custom bottom slot: view-mode toggles,
 * status + role chip filters with searchable dropdowns, overdue badge, and a
 * total task count. All state lives in the parent — this component is purely
 * presentational and lifts callbacks for every interaction.
 */
export default function ListFilterBar({
    accentColor,
    isMobile,
    onClearRoleFilter,
    onClearStatusFilter,
    onRoleDropdownToggle,
    onRoleFilterChange,
    onStatusDropdownToggle,
    onStatusFilterChange,
    onViewModeChange,
    roleDropdownOpen,
    roleDropdownRef,
    roleFilter,
    statusDropdownOpen,
    statusDropdownRef,
    statusFilter,
    summaryStats,
    viewMode
}) {
    const statusDisplayValue = STATUS_MAP[statusFilter] || 'All Statuses'
    const roleDisplayValue = ROLE_MAP[roleFilter] || 'All Roles'

    return (
        <div className="flex items-center flex-wrap gap-2 bg-bg-secondary border border-border-light rounded-[10px] px-3.5 py-2.5">
            <div className="flex items-center gap-1.5">
                {VIEW_MODES.map((mode) => (
                    <button
                        key={mode.id}
                        onClick={() => onViewModeChange(mode.id)}
                        className={`flex items-center rounded-md text-xs font-medium gap-1.5 px-3 py-1.5 cursor-pointer ${
                            viewMode === mode.id
                                ? 'bg-gray-900 text-white border-none'
                                : 'bg-transparent text-gray-500 border border-border-light'
                        }`}
                    >
                        <i className={`fas ${mode.icon} text-[11px]`} />
                        {mode.label}
                    </button>
                ))}
            </div>
            <div className="h-5 w-px bg-[var(--border-light)]" />
            {statusFilter ? (
                <button
                    onClick={onClearStatusFilter}
                    className="flex items-center rounded-md text-xs font-medium gap-1.5 px-2.5 py-1.5 cursor-pointer"
                    style={{
                        background: `${accentColor}10`,
                        border: `1px solid ${accentColor}30`,
                        color: accentColor
                    }}
                >
                    {statusDisplayValue}
                    <i className="fas fa-times text-[10px] opacity-70" />
                </button>
            ) : (
                <div className="relative" ref={statusDropdownRef}>
                    <button
                        onClick={onStatusDropdownToggle}
                        className={dropdownTrigger(isMobile)}
                        style={{
                            background: statusDropdownOpen ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                            border: statusDropdownOpen ? `1px solid ${accentColor}50` : '1px solid var(--border-light)'
                        }}
                    >
                        <i className="fas fa-filter text-[9px] opacity-60" />
                        {isMobile ? '+Status' : '+ Status'}
                        <i
                            className={`fas fa-chevron-down text-[8px] opacity-50 transition-transform duration-150 ${
                                statusDropdownOpen ? 'rotate-180' : ''
                            }`}
                        />
                    </button>
                    {statusDropdownOpen && (
                        <div className="absolute top-full left-0 mt-1.5 z-50 rounded shadow-lg overflow-hidden min-w-[180px] animate-filter-fade bg-bg-primary border border-border-light">
                            <div className="p-1.5">
                                {STATUS_OPTIONS.map((opt) => {
                                    const key = Object.keys(STATUS_MAP).find((k) => STATUS_MAP[k] === opt)
                                    const color = STATUS_COLORS[key] || STATUS_COLORS.pending
                                    return (
                                        <button
                                            key={opt}
                                            onClick={() => onStatusFilterChange(opt)}
                                            className={dropdownItemClass}
                                            onMouseEnter={setHoverBg('var(--bg-secondary)')}
                                            onMouseLeave={setHoverBg('transparent')}
                                        >
                                            <span
                                                className="flex items-center justify-center h-5 w-5 rounded-md text-[9px]"
                                                style={{ background: color.bg, color: color.text }}
                                            >
                                                <i className={`fas ${ListService.getStatusIcon(key)}`} />
                                            </span>
                                            {opt}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
            {roleFilter ? (
                <button
                    onClick={onClearRoleFilter}
                    className="flex items-center rounded-md text-xs font-medium gap-1.5 px-2.5 py-1.5 cursor-pointer"
                    style={{
                        background: `${accentColor}10`,
                        border: `1px solid ${accentColor}30`,
                        color: accentColor
                    }}
                >
                    {roleDisplayValue}
                    <i className="fas fa-times text-[10px] opacity-70" />
                </button>
            ) : (
                <div className="relative" ref={roleDropdownRef}>
                    <button
                        onClick={onRoleDropdownToggle}
                        className={dropdownTrigger(isMobile)}
                        style={{
                            background: roleDropdownOpen ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                            border: roleDropdownOpen ? `1px solid ${accentColor}50` : '1px solid var(--border-light)'
                        }}
                    >
                        <i className="fas fa-user text-[9px] opacity-60" />
                        {isMobile ? '+Role' : '+ Assigned'}
                        <i
                            className={`fas fa-chevron-down text-[8px] opacity-50 transition-transform duration-150 ${
                                roleDropdownOpen ? 'rotate-180' : ''
                            }`}
                        />
                    </button>
                    {roleDropdownOpen && (
                        <div className="absolute top-full left-0 mt-1.5 z-50 rounded shadow-lg overflow-hidden min-w-[170px] animate-filter-fade bg-bg-primary border border-border-light">
                            <div className="p-1.5">
                                {ROLE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt}
                                        onClick={() => onRoleFilterChange(opt)}
                                        className={dropdownItemClass}
                                        onMouseEnter={setHoverBg('var(--bg-secondary)')}
                                        onMouseLeave={setHoverBg('transparent')}
                                    >
                                        <span className="flex items-center justify-center h-5 w-5 rounded-md text-[9px] bg-bg-tertiary text-text-secondary">
                                            <i className="fas fa-user" />
                                        </span>
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            {!isMobile && <div className="flex-1" />}
            <div className={`flex items-center ${isMobile ? 'gap-2 ml-auto' : 'gap-3'}`}>
                {summaryStats.overdue > 0 && (
                    <div
                        className={`flex items-center animate-pulse bg-red-50 rounded-md text-red-600 font-semibold ${
                            isMobile ? 'text-[10px] gap-1 px-1.5 py-1' : 'text-xs gap-1.5 px-2.5 py-1.5'
                        }`}
                    >
                        <i className={`fas fa-exclamation-circle ${isMobile ? 'text-[9px]' : 'text-[11px]'}`} />
                        {summaryStats.overdue}
                        {isMobile ? '' : ' overdue'}
                    </div>
                )}
                <span className={`text-gray-400 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
                    <span className="text-gray-900 font-semibold">{summaryStats.total}</span> {isMobile ? '' : 'tasks'}
                </span>
            </div>
        </div>
    )
}
