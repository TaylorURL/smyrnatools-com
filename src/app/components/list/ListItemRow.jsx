import React from 'react'

import { ListService } from '../../../services/ListService'
import Badge from '../common/Badge'

const STATUS_TO_TONE = {
    completed: 'success',
    in_progress: 'info',
    ordered_materials: 'info',
    overdue: 'danger',
    pending: 'warning',
    waiting: 'warning'
}

const PRIORITY_TO_TONE = {
    high: 'danger',
    low: 'neutral',
    medium: 'warning',
    none: 'neutral'
}

const stripFaPrefix = (icon) => (icon ? icon.replace(/^fa-/, '') : icon)

/**
 * Single row in the grouped task list — checkbox, status pill, priority pill,
 * description, comments, plant, deadline, role, creator. Visual states:
 * selected (tinted background), completed (line-through + dimmed), overdue
 * (red bold deadline).
 */
export default function ListItemRow({ isMobile, isSelected, item, onSelectItem, onToggleSelect }) {
    const itemStatus = item.completed ? 'completed' : item.status || 'pending'
    const isItemOverdue = (ListService.isOverdue(item) || item.status === 'overdue') && !item.completed
    const pc = ListService.getPriorityConfig(item.priority || 'none')

    return (
        <div
            onClick={() => onSelectItem(item.id)}
            className={`group flex items-center gap-2 cursor-pointer border-b border-border-light transition-colors duration-150 ${
                isMobile ? 'px-2 py-1.5' : 'px-3 py-2'
            } ${item.completed ? 'opacity-60' : ''} ${isSelected ? 'bg-accent/5' : 'hover:bg-bg-hover'}`}
        >
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    onToggleSelect(item.id)
                }}
                className={`flex items-center justify-center h-4 w-4 rounded shrink-0 transition-all duration-150 ease-out motion-reduce:transition-none cursor-pointer active:scale-[0.92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary ${
                    isSelected
                        ? 'border-accent bg-accent border-[1.5px]'
                        : 'border-[1.5px] border-border-medium bg-transparent hover:border-accent'
                }`}
                aria-label={isSelected ? 'Deselect' : 'Select'}
                aria-pressed={isSelected}
            >
                {isSelected && <i className="fas fa-check text-white text-[8px]" aria-hidden="true" />}
            </button>
            <Badge
                tone={STATUS_TO_TONE[itemStatus] ?? 'warning'}
                size="xs"
                weight="bold"
                icon={stripFaPrefix(ListService.getStatusIcon(itemStatus))}
                className="shrink-0"
            >
                {ListService.getStatusLabel(itemStatus)}
            </Badge>
            {!isMobile && (
                <Badge
                    tone={PRIORITY_TO_TONE[item.priority || 'none'] ?? 'neutral'}
                    size="xs"
                    weight="bold"
                    icon={stripFaPrefix(pc.icon)}
                    className="shrink-0"
                >
                    {pc.label}
                </Badge>
            )}
            <div className="flex flex-1 min-w-0 items-baseline gap-2">
                <span
                    className={`text-[12px] font-semibold truncate text-text-primary ${
                        item.completed ? 'line-through' : ''
                    }`}
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
            <Badge
                tone="neutral"
                variant="custom"
                size="md"
                uppercase={false}
                weight="medium"
                icon="building"
                className="!hidden md:!inline-flex bg-bg-secondary border border-border-light text-text-secondary shrink-0"
                title={ListService.getPlantName(item.plant_code)}
            >
                <span className="truncate max-w-[120px]">{ListService.getPlantName(item.plant_code)}</span>
            </Badge>
            <span
                className={`inline-flex items-center gap-1 text-[11px] font-mono tabular-nums shrink-0 ${
                    isItemOverdue ? 'font-bold text-status-danger' : 'font-medium text-text-secondary'
                }`}
            >
                <i className="fas fa-calendar text-[9px] opacity-70" aria-hidden="true" />
                {new Date(item.deadline).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
            </span>
            {item.responsible_role && !isMobile && (
                <span className="hidden lg:inline-flex items-center gap-1 text-[11px] shrink-0 text-text-secondary">
                    <i
                        className={`fas ${ListService.getResponsibleRoleIcon(item.responsible_role)} text-[9px] opacity-70`}
                        aria-hidden="true"
                    />
                    <span className="truncate max-w-[110px]">
                        {ListService.getResponsibleRoleLabel(item.responsible_role)}
                    </span>
                </span>
            )}
            <span className="hidden lg:inline-flex items-center gap-1 text-[11px] shrink-0 text-text-tertiary">
                <i className="fas fa-user text-[9px] opacity-70" aria-hidden="true" />
                {ListService.truncateText(ListService.getCreatorName(item.user_id), 12)}
            </span>
        </div>
    )
}
