/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { ListService } from '../../../services/ListService'
import Badge from '../common/Badge'

/**
 * Compact card used inside a Cards-view column. Shows description, priority
 * pill, deadline, plant, and (when assigned) the responsible role. Status is
 * implied by the column the card sits in, so no status pill is rendered.
 */
export default function ListCardItem({ accentColor, isSelected, item, onSelectItem, onToggleSelect }) {
    const isItemOverdue = (ListService.isOverdue(item) || item.status === 'overdue') && !item.completed
    const pc = ListService.getPriorityConfig(item.priority || 'none')
    const deadlineLabel = item.deadline
        ? new Date(item.deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
        : '—'

    return (
        <div
            onClick={() => onSelectItem(item.id)}
            className={`group flex flex-col gap-2 cursor-pointer rounded-md px-2.5 py-2 transition-colors bg-bg-primary border border-border-light hover:border-[var(--border-medium)] hover:bg-bg-tertiary ${
                item.completed ? 'opacity-65' : ''
            }`}
            style={{
                background: isSelected ? 'var(--bg-tertiary)' : undefined,
                borderColor: isSelected ? accentColor : undefined
            }}
        >
            <div className="flex items-start gap-2">
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        onToggleSelect(item.id)
                    }}
                    className="flex items-center justify-center h-4 w-4 mt-[1px] rounded shrink-0 transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none border-none cursor-pointer active:scale-[0.97]"
                    style={{
                        background: isSelected ? accentColor : 'transparent',
                        border: `1.5px solid ${isSelected ? accentColor : 'var(--border-medium)'}`
                    }}
                    aria-label="Select"
                >
                    {isSelected && <i className="fas fa-check text-white text-[8px]" />}
                </button>
                <span
                    className="flex-1 text-[12px] font-semibold leading-snug text-text-primary line-clamp-2"
                    style={{ textDecoration: item.completed ? 'line-through' : 'none' }}
                    title={item.description}
                >
                    {item.description}
                </span>
            </div>
            {item.comments && (
                <span className="text-[11px] text-text-tertiary line-clamp-2 leading-snug" title={item.comments}>
                    {item.comments}
                </span>
            )}
            <div className="flex items-center flex-wrap gap-1.5">
                <Badge
                    variant="custom"
                    bg={pc.bg}
                    fg="var(--text-primary)"
                    size="xs"
                    weight="bold"
                    icon={<i className={`fas ${pc.icon} text-[8px]`} style={{ color: pc.color }} />}
                    className="border"
                    style={{ background: pc.bg, borderColor: pc.border, color: 'var(--text-primary)' }}
                >
                    {pc.label}
                </Badge>
                <Badge
                    variant="custom"
                    size="sm"
                    weight={isItemOverdue ? 'bold' : 'medium'}
                    uppercase={false}
                    icon={<i className="fas fa-calendar text-[9px] opacity-70" />}
                    className="font-mono tabular-nums"
                    style={{
                        background: isItemOverdue ? 'rgba(220,38,38,0.08)' : 'var(--bg-tertiary)',
                        color: isItemOverdue ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}
                >
                    {deadlineLabel}
                </Badge>
            </div>
            <div className="flex items-center justify-between gap-2 text-[10.5px] text-text-tertiary">
                <span
                    className="inline-flex items-center gap-1 truncate"
                    title={ListService.getPlantName(item.plant_code)}
                >
                    <i className="fas fa-building text-[9px] opacity-70" />
                    <span className="truncate">{ListService.getPlantName(item.plant_code)}</span>
                </span>
                {item.responsible_role && (
                    <span className="inline-flex items-center gap-1 shrink-0">
                        <i
                            className={`fas ${ListService.getResponsibleRoleIcon(item.responsible_role)} text-[9px] opacity-70`}
                        />
                        <span className="truncate max-w-[90px]">
                            {ListService.getResponsibleRoleLabel(item.responsible_role)}
                        </span>
                    </span>
                )}
            </div>
        </div>
    )
}
