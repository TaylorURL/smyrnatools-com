/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { ListService } from '../../../services/ListService'
import {
    BULK_ACTION_COLORS,
    BULK_STATUS_OPTIONS,
    getBulkButtonStyle,
    STATUS_COLORS
} from '../../constants/listViewConstants'

const actionButtonClass = (isMobile) =>
    `flex items-center border-none cursor-pointer font-semibold outline-none transition-all duration-200 ${
        isMobile
            ? 'flex-1 flex-col gap-1 py-2 rounded-lg text-[11px] min-h-[52px] justify-center'
            : 'gap-2 px-4 py-2 rounded text-sm'
    }`

const dropdownItemClass = (isMobile) =>
    `flex items-center w-full rounded font-medium cursor-pointer transition-all duration-100 border-none ${
        isMobile ? 'gap-3 px-3 py-3 text-sm' : 'gap-2.5 px-3 py-2 text-xs'
    } bg-transparent text-text-primary`

const setHoverBg = (color) => (e) => (e.currentTarget.style.background = color)

const setActionHover = (type, hovered) => (e) => {
    e.currentTarget.style.background = hovered ? BULK_ACTION_COLORS[type].hover : BULK_ACTION_COLORS[type].bg
}

function BulkDropdownPanel({ children, isMobile, minWidth }) {
    return (
        <div
            role="menu"
            className={`absolute bottom-full mb-2 z-50 rounded shadow-lg overflow-hidden animate-filter-fade ${
                isMobile ? 'left-1/2 -translate-x-1/2 w-[min(220px,90vw)]' : 'left-0'
            } bg-bg-primary border border-border-light`}
            style={isMobile ? undefined : { minWidth }}
        >
            <div className="p-1.5">{children}</div>
        </div>
    )
}

/**
 * Floating multi-select action bar (desktop: bottom-center; mobile: bottom
 * sheet). Exposes complete / set-status / set-priority / delete / cancel
 * actions. Status + priority dropdowns are managed locally via the refs and
 * open/close booleans passed in from the parent so click-outside detection
 * still works.
 */
export default function ListBulkActionsBar({
    accentColor,
    bulkPriorityOpen,
    bulkPriorityRef,
    bulkStatusOpen,
    bulkStatusRef,
    isMobile,
    onBulkComplete,
    onBulkDelete,
    onBulkUpdatePriority,
    onBulkUpdateStatus,
    onCancel,
    onTogglePriority,
    onToggleStatus,
    selectedCount
}) {
    if (!selectedCount) return null

    return (
        <div
            className={`fixed z-[1000] ${
                isMobile
                    ? 'bottom-0 inset-x-0 flex flex-col border-t border-border-light shadow-[0_-8px_24px_rgba(0,0,0,0.15)] pb-[env(safe-area-inset-bottom)]'
                    : 'bottom-8 left-1/2 -translate-x-1/2 flex items-center flex-nowrap gap-4 justify-start px-6 py-4 border border-border-light rounded shadow-[0_8px_24px_rgba(0,0,0,0.15)]'
            } bg-bg-primary`}
        >
            {isMobile && (
                <div
                    className="text-xs font-bold text-center py-1.5 border-b border-border-light"
                    style={{ color: accentColor }}
                >
                    {selectedCount} selected
                </div>
            )}
            {!isMobile && (
                <div className="text-[0.9375rem] font-bold shrink-0" style={{ color: accentColor }}>
                    {selectedCount} selected
                </div>
            )}
            <div className={`flex ${isMobile ? 'w-full px-1 py-1.5 gap-1' : 'gap-2'}`}>
                <button
                    onClick={onBulkComplete}
                    className={actionButtonClass(isMobile)}
                    style={getBulkButtonStyle('complete')}
                    onMouseEnter={setActionHover('complete', true)}
                    onMouseLeave={setActionHover('complete', false)}
                    aria-label="Complete"
                >
                    <i className={`fas fa-check ${isMobile ? 'text-base' : ''}`} />
                    <span>Complete</span>
                </button>
                <div className={`relative ${isMobile ? 'flex-1 flex' : ''}`} ref={bulkStatusRef}>
                    <button
                        type="button"
                        onClick={onToggleStatus}
                        className={actionButtonClass(isMobile)}
                        style={getBulkButtonStyle('neutral')}
                        onMouseEnter={setActionHover('neutral', true)}
                        onMouseLeave={setActionHover('neutral', false)}
                        aria-label="Status"
                        aria-haspopup="menu"
                        aria-expanded={bulkStatusOpen}
                    >
                        <i className={`fas fa-layer-group ${isMobile ? 'text-base' : ''}`} />
                        <span className={isMobile ? '' : 'flex items-center gap-2'}>
                            Status
                            {!isMobile && (
                                <i
                                    className={`fas fa-chevron-down text-[8px] opacity-60 transition-transform duration-150 ${
                                        bulkStatusOpen ? 'rotate-180' : ''
                                    }`}
                                />
                            )}
                        </span>
                    </button>
                    {bulkStatusOpen && (
                        <BulkDropdownPanel isMobile={isMobile} minWidth={180}>
                            {BULK_STATUS_OPTIONS.map((opt) => {
                                const color = STATUS_COLORS[opt.value] || STATUS_COLORS.pending
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        role="menuitem"
                                        onClick={() => onBulkUpdateStatus(opt.value)}
                                        className={dropdownItemClass(isMobile)}
                                        onMouseEnter={setHoverBg('var(--bg-secondary)')}
                                        onMouseLeave={setHoverBg('transparent')}
                                    >
                                        <span
                                            className="flex items-center justify-center h-5 w-5 rounded-md text-[9px]"
                                            style={{ background: color.bg, color: color.text }}
                                        >
                                            <i className={`fas ${ListService.getStatusIcon(opt.value)}`} />
                                        </span>
                                        {opt.label}
                                    </button>
                                )
                            })}
                        </BulkDropdownPanel>
                    )}
                </div>
                <div className={`relative ${isMobile ? 'flex-1 flex' : ''}`} ref={bulkPriorityRef}>
                    <button
                        type="button"
                        onClick={onTogglePriority}
                        className={actionButtonClass(isMobile)}
                        style={getBulkButtonStyle('neutral')}
                        onMouseEnter={setActionHover('neutral', true)}
                        onMouseLeave={setActionHover('neutral', false)}
                        aria-label="Priority"
                        aria-haspopup="menu"
                        aria-expanded={bulkPriorityOpen}
                    >
                        <i className={`fas fa-flag ${isMobile ? 'text-base' : ''}`} />
                        <span className={isMobile ? '' : 'flex items-center gap-2'}>
                            Priority
                            {!isMobile && (
                                <i
                                    className={`fas fa-chevron-down text-[8px] opacity-60 transition-transform duration-150 ${
                                        bulkPriorityOpen ? 'rotate-180' : ''
                                    }`}
                                />
                            )}
                        </span>
                    </button>
                    {bulkPriorityOpen && (
                        <BulkDropdownPanel isMobile={isMobile} minWidth={170}>
                            {ListService.getPriorityOptions().map((opt) => {
                                const pc = ListService.getPriorityConfig(opt.value)
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        role="menuitem"
                                        onClick={() => onBulkUpdatePriority(opt.value)}
                                        className={dropdownItemClass(isMobile)}
                                        onMouseEnter={setHoverBg('var(--bg-secondary)')}
                                        onMouseLeave={setHoverBg('transparent')}
                                    >
                                        <span
                                            className="flex items-center justify-center h-5 w-5 rounded-md text-[9px]"
                                            style={{ background: pc.bg, color: pc.color }}
                                        >
                                            <i className={`fas ${pc.icon}`} />
                                        </span>
                                        {opt.label}
                                    </button>
                                )
                            })}
                        </BulkDropdownPanel>
                    )}
                </div>
                <button
                    onClick={onBulkDelete}
                    className={actionButtonClass(isMobile)}
                    style={getBulkButtonStyle('delete')}
                    onMouseEnter={setActionHover('delete', true)}
                    onMouseLeave={setActionHover('delete', false)}
                    aria-label="Delete"
                >
                    <i className={`fas fa-trash ${isMobile ? 'text-base' : ''}`} />
                    <span>Delete</span>
                </button>
                <button
                    onClick={onCancel}
                    className={actionButtonClass(isMobile)}
                    style={getBulkButtonStyle('cancel')}
                    onMouseEnter={setActionHover('cancel', true)}
                    onMouseLeave={setActionHover('cancel', false)}
                    aria-label="Cancel"
                >
                    <i className={`fas fa-times ${isMobile ? 'text-base' : ''}`} />
                    <span>Cancel</span>
                </button>
            </div>
        </div>
    )
}
