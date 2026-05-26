/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { ListService } from '../../../services/ListService'
import { getItemStatusIconColor, getItemStatusStyle } from '../../constants/listViewConstants'

/**
 * Single row in the grouped task list — checkbox, status pill, priority pill,
 * description, comments, plant, deadline, role, creator. Visual states:
 * selected (tinted background), completed (line-through + dimmed), overdue
 * (red bold deadline).
 */
export default function ListItemRow({ accentColor, isMobile, isSelected, item, onSelectItem, onToggleSelect }) {
    const itemStatus = item.completed ? 'completed' : item.status || 'pending'
    const isItemOverdue = (ListService.isOverdue(item) || item.status === 'overdue') && !item.completed
    const pc = ListService.getPriorityConfig(item.priority || 'none')

    return (
        <div
            onClick={() => onSelectItem(item.id)}
            className={`flex items-center gap-2 cursor-pointer border-b border-border-light transition-colors ${
                isMobile ? 'px-2 py-1.5' : 'px-3 py-1.5'
            } ${item.completed ? 'opacity-65' : ''} hover:bg-bg-tertiary`}
            style={{ background: isSelected ? 'var(--bg-tertiary)' : 'transparent' }}
        >
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    onToggleSelect(item.id)
                }}
                className="flex items-center justify-center h-4 w-4 rounded shrink-0 transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none border-none cursor-pointer active:scale-[0.97]"
                style={{
                    background: isSelected ? accentColor : 'transparent',
                    border: `1.5px solid ${isSelected ? accentColor : 'var(--border-medium)'}`
                }}
                aria-label="Select"
            >
                {isSelected && <i className="fas fa-check text-white text-[8px]" />}
            </button>
            <span
                className="inline-flex items-center shrink-0 rounded text-[9px] font-bold uppercase tracking-wider gap-1 px-1.5 py-0.5 text-text-primary"
                style={getItemStatusStyle(itemStatus)}
            >
                <i
                    className={`fas ${ListService.getStatusIcon(itemStatus)} text-[8px]`}
                    style={{ color: getItemStatusIconColor(itemStatus) }}
                />
                {ListService.getStatusLabel(itemStatus)}
            </span>
            {!isMobile && (
                <span
                    className="inline-flex items-center shrink-0 rounded text-[9px] font-bold uppercase tracking-wider gap-1 px-1.5 py-0.5 border text-text-primary"
                    style={{ background: pc.bg, borderColor: pc.border }}
                >
                    <i className={`fas ${pc.icon} text-[8px]`} style={{ color: pc.color }} />
                    {pc.label}
                </span>
            )}
            <div className="flex flex-1 min-w-0 items-baseline gap-2">
                <span
                    className="text-[12px] font-semibold truncate text-text-primary"
                    style={{ textDecoration: item.completed ? 'line-through' : 'none' }}
                    title={item.description}
                >
                    {item.description}
                </span>
                {item.comments && !isMobile && (
                    <span className="text-[11px] truncate text-text-tertiary" title={item.comments}>
                        · {item.comments}
                    </span>
                )}
            </div>
            <span
                className="hidden md:inline-flex items-center gap-1 text-[11px] shrink-0 rounded px-1.5 py-0.5 border bg-[rgba(148,163,184,0.10)] border-[rgba(148,163,184,0.25)] text-text-secondary"
                title={ListService.getPlantName(item.plant_code)}
            >
                <i className="fas fa-building text-[9px] opacity-70" />
                <span className="truncate max-w-[120px]">{ListService.getPlantName(item.plant_code)}</span>
            </span>
            <span
                className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums shrink-0"
                style={{
                    color: isItemOverdue ? '#dc2626' : 'var(--text-secondary)',
                    fontWeight: isItemOverdue ? 700 : 500
                }}
            >
                <i className="fas fa-calendar text-[9px] opacity-70" />
                {new Date(item.deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
            </span>
            {item.responsible_role && !isMobile && (
                <span className="hidden lg:inline-flex items-center gap-1 text-[11px] shrink-0 text-text-secondary">
                    <i
                        className={`fas ${ListService.getResponsibleRoleIcon(item.responsible_role)} text-[9px] opacity-70`}
                    />
                    <span className="truncate max-w-[110px]">
                        {ListService.getResponsibleRoleLabel(item.responsible_role)}
                    </span>
                </span>
            )}
            <span className="hidden lg:inline-flex items-center gap-1 text-[11px] shrink-0 text-text-tertiary">
                <i className="fas fa-user text-[9px] opacity-70" />
                {ListService.truncateText(ListService.getCreatorName(item.user_id), 12)}
            </span>
        </div>
    )
}
