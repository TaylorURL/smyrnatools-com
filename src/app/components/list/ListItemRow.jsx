/* eslint-disable react/forbid-dom-props */
import React, { useRef, useState } from 'react'

import { ListService } from '../../../services/ListService'
import { STATUS_COLORS } from '../../constants/listViewConstants'
import ListInlineMenu from './ListInlineMenu'

const STATUS_OPTIONS = [
    { color: STATUS_COLORS.pending.text, icon: 'fa-clock', label: 'Pending', value: 'pending' },
    { color: STATUS_COLORS.in_progress.text, icon: 'fa-spinner', label: 'In Progress', value: 'in_progress' },
    {
        color: STATUS_COLORS.ordered_materials.text,
        icon: 'fa-truck-loading',
        label: 'Ordered',
        value: 'ordered_materials'
    },
    { color: STATUS_COLORS.waiting.text, icon: 'fa-hourglass-half', label: 'Waiting', value: 'waiting' }
]

const PRIORITY_OPTIONS_INLINE = [
    { color: '#ef4444', icon: 'fa-fire', label: 'Urgent', value: 'urgent' },
    { color: '#f97316', icon: 'fa-arrow-up', label: 'High', value: 'high' },
    { color: '#eab308', icon: 'fa-minus', label: 'Medium', value: 'medium' },
    { color: '#60a5fa', icon: 'fa-arrow-down', label: 'Low', value: 'low' },
    { color: '#94a3b8', icon: 'fa-minus', label: 'No priority', value: 'none' }
]

function StatusChip({ accentColor, isOverdue, item, onChange }) {
    const triggerRef = useRef(null)
    const [open, setOpen] = useState(false)
    const status = item.completed ? 'completed' : item.status || 'pending'
    const config = STATUS_COLORS[status === 'overdue' || isOverdue ? 'overdue' : status] || STATUS_COLORS.pending
    const label = ListService.getStatusLabel(status === 'overdue' || isOverdue ? 'overdue' : status)
    const icon = ListService.getStatusIcon(status === 'overdue' || isOverdue ? 'overdue' : status)
    void accentColor
    const interactive = !item.completed
    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                disabled={!interactive}
                onClick={(e) => {
                    e.stopPropagation()
                    if (interactive) setOpen((o) => !o)
                }}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider transition-[transform,box-shadow] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none ${
                    interactive ? 'cursor-pointer hover:shadow-[0_0_0_3px_var(--bg-secondary)]' : 'cursor-default'
                }`}
                style={{
                    background: config.bg,
                    border: `1px solid ${config.border}`,
                    color: config.text
                }}
                aria-label={`Status: ${label}${interactive ? '. Click to change.' : ''}`}
                aria-haspopup={interactive ? 'listbox' : undefined}
                aria-expanded={interactive ? open : undefined}
            >
                <i className={`fas ${icon} text-[8.5px]`} aria-hidden="true" />
                {label}
            </button>
            <ListInlineMenu
                open={open}
                onClose={() => setOpen(false)}
                triggerRef={triggerRef}
                options={STATUS_OPTIONS}
                selectedValue={item.status}
                onSelect={onChange}
                title="Set status"
            />
        </>
    )
}

function PriorityChip({ item, onChange }) {
    const triggerRef = useRef(null)
    const [open, setOpen] = useState(false)
    const pc = ListService.getPriorityConfig(item.priority || 'none')
    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    setOpen((o) => !o)
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider transition-[transform,box-shadow] duration-150 ease-out active:scale-[0.97] cursor-pointer hover:shadow-[0_0_0_3px_var(--bg-secondary)] motion-reduce:transition-none"
                style={{
                    background: pc.bg,
                    borderColor: pc.border,
                    color: pc.color
                }}
                aria-label={`Priority: ${pc.label}. Click to change.`}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <i className={`fas ${pc.icon} text-[8.5px]`} aria-hidden="true" />
                {pc.label}
            </button>
            <ListInlineMenu
                open={open}
                onClose={() => setOpen(false)}
                triggerRef={triggerRef}
                options={PRIORITY_OPTIONS_INLINE}
                selectedValue={item.priority || 'none'}
                onSelect={onChange}
                title="Set priority"
            />
        </>
    )
}

/**
 * Single row in the grouped task list. Clicking the row body opens the detail
 * view; the checkbox toggles completion optimistically; the status and
 * priority chips open inline popovers for fast changes; hover reveals
 * Edit / Delete quick actions on the right.
 *
 * @param {object} item - The list item record.
 * @param {boolean} isSelected - Multi-select state.
 * @param {Function} onSelectItem - Called with `item.id` to open the detail view.
 * @param {Function} onToggleSelect - Toggles the row's multi-select state.
 * @param {Function} [onDelete] - Optional confirmation-bypass single-row delete (used by hover action).
 */
export default function ListItemRow({
    accentColor,
    isMobile,
    isSelected,
    item,
    onDelete,
    onSelectItem,
    onToggleSelect
}) {
    const isItemOverdue = (ListService.isOverdue(item) || item.status === 'overdue') && !item.completed
    const deadline = item.deadline ? new Date(item.deadline) : null
    const isOptimistic = item._optimistic === true

    const handleSelect = (e) => {
        e.stopPropagation()
        onToggleSelect?.(item.id)
    }

    const handleStatusChange = async (newStatus) => {
        if (!newStatus || newStatus === item.status) return
        try {
            await ListService.updateListItem({ ...item, status: newStatus })
        } catch {
            // optimistic rollback already happened
        }
    }

    const handlePriorityChange = async (newPriority) => {
        if (!newPriority || newPriority === item.priority) return
        try {
            await ListService.updateListItem({ ...item, priority: newPriority })
        } catch {}
    }

    const handleEditClick = (e) => {
        e.stopPropagation()
        onSelectItem?.(item.id)
    }

    const handleDeleteClick = async (e) => {
        e.stopPropagation()
        if (onDelete) {
            onDelete(item)
            return
        }
        try {
            await ListService.deleteListItem(item.id)
        } catch {}
    }

    return (
        <div
            onClick={() => onSelectItem?.(item.id)}
            className={`group relative flex items-center gap-2.5 cursor-pointer border-b border-border-light last:border-b-0 transition-[background-color,opacity] duration-200 ${
                isMobile ? 'px-2.5 py-2' : 'px-3.5 py-2.5'
            } ${item.completed ? 'opacity-55' : ''} ${
                isSelected ? 'bg-bg-hover' : 'hover:bg-bg-hover'
            } ${isOptimistic ? 'animate-pulse' : ''}`}
            style={
                isSelected
                    ? { borderLeft: `3px solid ${accentColor}`, paddingLeft: isMobile ? '7px' : '11px' }
                    : undefined
            }
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectItem?.(item.id)
                }
            }}
        >
            <button
                type="button"
                onClick={handleSelect}
                className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md transition-[transform,background-color,border-color] duration-150 ease-out motion-reduce:transition-none active:scale-[0.9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary ${
                    isSelected
                        ? 'bg-accent border-[1.5px] border-accent'
                        : 'border-[1.5px] border-border-medium bg-transparent hover:border-accent'
                }`}
                aria-label={isSelected ? 'Deselect task' : 'Select task'}
                aria-pressed={isSelected}
            >
                {isSelected && <i className="fas fa-check text-white text-[9px]" aria-hidden="true" />}
            </button>

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                    className={`truncate text-[14px] font-medium leading-snug transition-colors duration-200 ${
                        item.completed ? 'line-through text-text-tertiary' : 'text-text-primary'
                    }`}
                    title={item.description}
                >
                    {item.description}
                </span>
                {item.comments && !isMobile && (
                    <span className="truncate text-[11.5px] text-text-tertiary" title={item.comments}>
                        {item.comments}
                    </span>
                )}
            </div>

            <StatusChip accentColor={accentColor} isOverdue={isItemOverdue} item={item} onChange={handleStatusChange} />

            {!isMobile && <PriorityChip item={item} onChange={handlePriorityChange} />}

            {!isMobile && (
                <span
                    className="hidden md:inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border-light bg-bg-secondary px-2 py-0.5 text-[11px] font-medium text-text-secondary"
                    title={ListService.getPlantName(item.plant_code)}
                >
                    <i className="fas fa-building text-[9px] opacity-60" aria-hidden="true" />
                    <span className="font-mono tracking-wider">{item.plant_code}</span>
                </span>
            )}

            {deadline && (
                <span
                    className={`inline-flex shrink-0 items-center gap-1 text-[11.5px] font-mono tabular-nums transition-colors duration-200 ${
                        isItemOverdue ? 'font-bold text-status-danger' : 'font-medium text-text-secondary'
                    }`}
                >
                    <i className="fas fa-calendar text-[9px] opacity-60" aria-hidden="true" />
                    {deadline.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                </span>
            )}

            {!isMobile && !isOptimistic && (
                <div
                    className="ml-1 flex shrink-0 items-center gap-0.5 opacity-0 translate-x-1 transition-[opacity,transform] duration-150 ease-out group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:translate-x-0 motion-reduce:transition-none"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        onClick={handleEditClick}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary active:scale-[0.92] transition-[transform,colors] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        aria-label="Edit task"
                        title="Open task details"
                    >
                        <i className="fas fa-pen text-[11px]" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={handleDeleteClick}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:bg-bg-tertiary hover:text-status-danger active:scale-[0.92] transition-[transform,colors] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-danger"
                        aria-label="Delete task"
                        title="Delete task"
                    >
                        <i className="fas fa-trash text-[11px]" aria-hidden="true" />
                    </button>
                </div>
            )}
        </div>
    )
}
