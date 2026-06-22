/* eslint-disable react/forbid-dom-props */
import React from 'react'
import ReactDOM from 'react-dom'

import { ListService } from '../../../services/ListService'
import { BULK_STATUS_OPTIONS, STATUS_COLORS } from '../../constants/listViewConstants'

const TONE_CONFIG = {
    complete: { bg: 'rgba(22,163,74,0.14)', hoverBg: 'rgba(22,163,74,0.24)', textClass: 'text-status-active' },
    delete: { bg: 'rgba(220,38,38,0.14)', hoverBg: 'rgba(220,38,38,0.24)', textClass: 'text-status-danger' },
    neutral: { bg: 'rgba(59,130,246,0.14)', hoverBg: 'rgba(59,130,246,0.24)', textClass: 'text-status-shop' },
    secondary: {
        bg: undefined,
        hoverBg: undefined,
        textClass: 'text-text-secondary bg-bg-secondary hover:bg-bg-tertiary'
    }
}

function ActionButton({ ariaProps, children, icon, isMobile, onClick, tone = 'neutral' }) {
    const base = isMobile
        ? 'flex-1 flex-col gap-0.5 py-2.5 rounded-lg text-[11px] min-h-[52px] justify-center'
        : 'gap-2 px-3.5 py-2 rounded-md text-[13px]'
    const cfg = TONE_CONFIG[tone] || TONE_CONFIG.neutral
    const inlineStyle = cfg.bg ? { background: cfg.bg } : undefined
    return (
        <button type="button"
            onClick={onClick}
            type="button"
            className={`flex items-center font-semibold border-none outline-none cursor-pointer transition-[background-color,transform] duration-150 ease-out motion-reduce:transition-none active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-accent ${base} ${cfg.textClass}`}
            style={inlineStyle}
            onMouseEnter={cfg.hoverBg ? (e) => (e.currentTarget.style.background = cfg.hoverBg) : undefined}
            onMouseLeave={cfg.bg ? (e) => (e.currentTarget.style.background = cfg.bg) : undefined}
            {...ariaProps}
        >
            <i className={`fas ${icon} ${isMobile ? 'text-base' : ''}`} aria-hidden="true" />
            <span>{children}</span>
        </button>
    )
}

function BulkDropdownPanel({ children, isMobile, minWidth }) {
    return (
        <div
            role="menu"
            className={`absolute bottom-full mb-2 z-50 rounded-lg shadow-[0_12px_32px_rgba(0,0,0,0.18)] overflow-hidden animate-filter-fade ${
                isMobile ? 'left-1/2 -translate-x-1/2 w-[min(240px,90vw)]' : 'left-0'
            } bg-bg-primary border border-border-light`}
            style={isMobile ? undefined : { minWidth }}
        >
            <div className="p-1">{children}</div>
        </div>
    )
}

function MenuItem({ children, icon, iconBg, iconColor, isMobile, onClick }) {
    return (
        <button type="button"
            role="menuitem"
            onClick={onClick}
            className={`flex w-full items-center rounded font-medium border-none bg-transparent text-text-primary transition-colors duration-100 hover:bg-bg-secondary cursor-pointer ${
                isMobile ? 'gap-3 px-3 py-2.5 text-[13px]' : 'gap-2.5 px-2.5 py-2 text-[12.5px]'
            }`}
        >
            <span
                className="flex h-5 w-5 items-center justify-center rounded-md text-[10px]"
                style={{ background: iconBg, color: iconColor }}
            >
                <i className={`fas ${icon}`} aria-hidden="true" />
            </span>
            {children}
        </button>
    )
}

/**
 * Floating multi-select action bar (desktop: bottom-center; mobile: bottom
 * sheet with safe-area inset). Springs in from below with an ease-out curve
 * and scales subtly on press to feel responsive. The status + priority
 * dropdowns lift above their triggers and clamp to the viewport edges.
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

    const containerClass = isMobile
        ? 'bottom-0 inset-x-0 flex flex-col border-t border-border-light shadow-[0_-12px_32px_rgba(0,0,0,0.18)] pb-[env(safe-area-inset-bottom)]'
        : 'bottom-6 left-1/2 -translate-x-1/2 flex items-center flex-nowrap gap-3 justify-start px-4 py-2.5 border border-border-light rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.22)]'

    if (typeof document === 'undefined' || !document.body) return null

    return ReactDOM.createPortal(
        <div
            role="region"
            aria-label={`${selectedCount} task${selectedCount === 1 ? '' : 's'} selected`}
            className={`fixed z-[1000] bg-bg-primary animate-slide-up motion-reduce:animate-none ${containerClass}`}
        >
            {isMobile && (
                <div
                    className="border-b border-border-light py-1.5 text-center text-[12px] font-bold"
                    style={{ color: accentColor }}
                >
                    {selectedCount} selected
                </div>
            )}
            {!isMobile && (
                <div className="shrink-0 text-[13.5px] font-bold" style={{ color: accentColor }}>
                    {selectedCount} selected
                </div>
            )}
            <div className={`flex ${isMobile ? 'w-full gap-1.5 px-1.5 py-2' : 'gap-1.5'}`}>
                <ActionButton
                    icon="fa-check"
                    isMobile={isMobile}
                    onClick={onBulkComplete}
                    tone="complete"
                    ariaProps={{ 'aria-label': 'Mark selected as complete' }}
                >
                    Complete
                </ActionButton>
                <div className={`relative ${isMobile ? 'flex-1 flex' : ''}`} ref={bulkStatusRef}>
                    <ActionButton
                        icon="fa-layer-group"
                        isMobile={isMobile}
                        onClick={onToggleStatus}
                        tone="neutral"
                        ariaProps={{
                            'aria-expanded': bulkStatusOpen,
                            'aria-haspopup': 'menu',
                            'aria-label': 'Set status for selected tasks'
                        }}
                    >
                        Status
                    </ActionButton>
                    {bulkStatusOpen && (
                        <BulkDropdownPanel isMobile={isMobile} minWidth={180}>
                            {BULK_STATUS_OPTIONS.map((opt) => {
                                const color = STATUS_COLORS[opt.value] || STATUS_COLORS.pending
                                return (
                                    <MenuItem
                                        key={opt.value}
                                        icon={ListService.getStatusIcon(opt.value)}
                                        iconBg={color.bg}
                                        iconColor={color.text}
                                        isMobile={isMobile}
                                        onClick={() => onBulkUpdateStatus(opt.value)}
                                    >
                                        {opt.label}
                                    </MenuItem>
                                )
                            })}
                        </BulkDropdownPanel>
                    )}
                </div>
                <div className={`relative ${isMobile ? 'flex-1 flex' : ''}`} ref={bulkPriorityRef}>
                    <ActionButton
                        icon="fa-flag"
                        isMobile={isMobile}
                        onClick={onTogglePriority}
                        tone="neutral"
                        ariaProps={{
                            'aria-expanded': bulkPriorityOpen,
                            'aria-haspopup': 'menu',
                            'aria-label': 'Set priority for selected tasks'
                        }}
                    >
                        Priority
                    </ActionButton>
                    {bulkPriorityOpen && (
                        <BulkDropdownPanel isMobile={isMobile} minWidth={170}>
                            {ListService.getPriorityOptions().map((opt) => {
                                const pc = ListService.getPriorityConfig(opt.value)
                                return (
                                    <MenuItem
                                        key={opt.value}
                                        icon={pc.icon}
                                        iconBg={pc.bg}
                                        iconColor={pc.color}
                                        isMobile={isMobile}
                                        onClick={() => onBulkUpdatePriority(opt.value)}
                                    >
                                        {opt.label}
                                    </MenuItem>
                                )
                            })}
                        </BulkDropdownPanel>
                    )}
                </div>
                <ActionButton
                    icon="fa-trash"
                    isMobile={isMobile}
                    onClick={onBulkDelete}
                    tone="delete"
                    ariaProps={{ 'aria-label': 'Delete selected tasks' }}
                >
                    Delete
                </ActionButton>
                <ActionButton
                    icon="fa-xmark"
                    isMobile={isMobile}
                    onClick={onCancel}
                    tone="secondary"
                    ariaProps={{ 'aria-label': 'Clear selection' }}
                >
                    Cancel
                </ActionButton>
            </div>
        </div>,
        document.body
    )
}
