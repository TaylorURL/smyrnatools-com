/* eslint-disable react/forbid-dom-props */
import React, { useRef, useState } from 'react'

import { ListService } from '../../../services/ListService'
import ListInlineMenu from './ListInlineMenu'

const PRIORITY_OPTIONS_INLINE = [
    { color: '#ef4444', icon: 'fa-fire', label: 'Urgent', value: 'urgent' },
    { color: '#f97316', icon: 'fa-arrow-up', label: 'High', value: 'high' },
    { color: '#eab308', icon: 'fa-minus', label: 'Medium', value: 'medium' },
    { color: '#60a5fa', icon: 'fa-arrow-down', label: 'Low', value: 'low' },
    { color: '#94a3b8', icon: 'fa-minus', label: 'No priority', value: 'none' }
]

function PriorityChip({ item, onChange }) {
    const ref = useRef(null)
    const [open, setOpen] = useState(false)
    const pc = ListService.getPriorityConfig(item.priority || 'none')
    return (
        <>
            <button type="button"
                ref={ref}
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    setOpen((o) => !o)
                }}
                className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider transition-[transform,box-shadow] duration-150 ease-out active:scale-[0.97] hover:shadow-[0_0_0_3px_var(--bg-secondary)] motion-reduce:transition-none"
                style={{ background: pc.bg, borderColor: pc.border, color: pc.color }}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={`Priority: ${pc.label}. Click to change.`}
            >
                <i className={`fas ${pc.icon} text-[8.5px]`} aria-hidden="true" />
                {pc.label}
            </button>
            <ListInlineMenu
                open={open}
                onClose={() => setOpen(false)}
                triggerRef={ref}
                options={PRIORITY_OPTIONS_INLINE}
                selectedValue={item.priority || 'none'}
                onSelect={onChange}
                title="Set priority"
            />
        </>
    )
}

/**
 * Compact card used inside a Cards-view column. Shows description, an
 * inline priority chip, deadline, plant, and (when assigned) the responsible
 * role. Status is implied by the column the card sits in. Clicking the body
 * opens the detail view; clicking the priority chip opens an inline change
 * menu; hovering reveals quick Edit / Delete actions in the corner.
 */
export default function ListCardItem({ accentColor, isSelected, item, onSelectItem, onToggleSelect }) {
    const isItemOverdue = (ListService.isOverdue(item) || item.status === 'overdue') && !item.completed
    const deadlineLabel = item.deadline
        ? new Date(item.deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
        : '—'
    const isOptimistic = item._optimistic === true

    const handlePriorityChange = async (newPriority) => {
        if (!newPriority || newPriority === item.priority) return
        try {
            await ListService.updateListItem({ ...item, priority: newPriority })
        } catch {}
    }

    const handleDelete = async (e) => {
        e.stopPropagation()
        try {
            await ListService.deleteListItem(item.id)
        } catch {}
    }

    const handleEdit = (e) => {
        e.stopPropagation()
        onSelectItem?.(item.id)
    }

    return (
        <div
            onClick={() => onSelectItem?.(item.id)}
            className={`group relative flex cursor-pointer flex-col gap-2 rounded-lg border border-border-light bg-bg-primary px-3 py-2.5 transition-[border-color,background-color,transform] duration-150 ease-out hover:-translate-y-[1px] hover:border-border-medium hover:bg-bg-secondary active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:transform-none ${
                item.completed ? 'opacity-60' : ''
            } ${isOptimistic ? 'animate-pulse' : ''}`}
            style={{
                background: isSelected ? 'var(--bg-secondary)' : undefined,
                borderColor: isSelected ? accentColor : undefined
            }}
        >
            <div className="flex items-start gap-2">
                <button type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        onToggleSelect?.(item.id)
                    }}
                    className={`mt-[2px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-[1.5px] transition-[transform,background-color] duration-150 ease-out active:scale-[0.9] motion-reduce:transition-none ${
                        isSelected
                            ? 'border-accent bg-accent'
                            : 'border-border-medium bg-transparent hover:border-accent'
                    }`}
                    aria-label={isSelected ? 'Deselect' : 'Select'}
                    aria-pressed={isSelected}
                >
                    {isSelected && <i className="fas fa-check text-white text-[9px]" aria-hidden="true" />}
                </button>
                <span
                    className={`flex-1 text-[13.5px] font-medium leading-snug transition-colors duration-200 line-clamp-2 ${
                        item.completed ? 'line-through text-text-tertiary' : 'text-text-primary'
                    }`}
                    title={item.description}
                >
                    {item.description}
                </span>
            </div>
            {item.comments && (
                <p className="m-0 text-[11.5px] text-text-tertiary line-clamp-2 leading-snug" title={item.comments}>
                    {item.comments}
                </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
                <PriorityChip item={item} onChange={handlePriorityChange} />
                <span
                    className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-mono tabular-nums ${
                        isItemOverdue
                            ? 'font-bold text-status-danger'
                            : 'border-border-light bg-bg-tertiary text-text-secondary'
                    }`}
                    style={
                        isItemOverdue
                            ? { background: 'rgba(220,38,38,0.12)', borderColor: 'rgba(220,38,38,0.4)' }
                            : undefined
                    }
                >
                    <i className="fas fa-calendar text-[9px] opacity-70" aria-hidden="true" />
                    {deadlineLabel}
                </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px] text-text-tertiary">
                <span
                    className="inline-flex items-center gap-1 truncate"
                    title={ListService.getPlantName(item.plant_code)}
                >
                    <i className="fas fa-building text-[9px] opacity-70" aria-hidden="true" />
                    <span className="font-mono tracking-wider">{item.plant_code}</span>
                </span>
                {item.responsible_role && (
                    <span className="inline-flex shrink-0 items-center gap-1">
                        <i
                            className={`fas ${ListService.getResponsibleRoleIcon(item.responsible_role)} text-[9px] opacity-70`}
                            aria-hidden="true"
                        />
                        <span className="truncate max-w-[90px]">
                            {ListService.getResponsibleRoleLabel(item.responsible_role)}
                        </span>
                    </span>
                )}
            </div>
            {!isOptimistic && (
                <div
                    className="pointer-events-none absolute right-2 top-2 flex items-center gap-0.5 opacity-0 translate-x-1 transition-[opacity,transform] duration-150 ease-out group-hover:pointer-events-auto group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:translate-x-0 motion-reduce:transition-none"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button type="button"
                        onClick={handleEdit}
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-bg-primary text-text-tertiary border border-border-light hover:bg-bg-secondary hover:text-text-primary active:scale-[0.92] transition-[transform,colors] duration-150 ease-out"
                        aria-label="Edit task"
                        title="Open task"
                    >
                        <i className="fas fa-pen text-[10px]" aria-hidden="true" />
                    </button>
                    <button type="button"
                        onClick={handleDelete}
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-bg-primary text-text-tertiary border border-border-light hover:bg-bg-tertiary hover:text-status-danger active:scale-[0.92] transition-[transform,colors] duration-150 ease-out"
                        aria-label="Delete task"
                        title="Delete"
                    >
                        <i className="fas fa-trash text-[10px]" aria-hidden="true" />
                    </button>
                </div>
            )}
        </div>
    )
}
