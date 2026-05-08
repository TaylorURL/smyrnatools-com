import React, { useMemo, useState } from 'react'

import { formatMaintenanceDate } from '../../../utils/MaintenanceUtility'
import { ItemIcon, PlantChip, StatusBadge } from './MaintenanceFormAtoms'

/* Collapsible section header. Click toggles its open state; the count + icon
 * give an at-a-glance read on how much work the section is hiding. */
function SectionHeader({ accentColor, count, icon, isOpen, label, onToggle, tone }) {
    const accent = tone === 'danger' ? '#dc2626' : tone === 'warning' ? '#d97706' : accentColor
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            className="w-full flex items-center gap-2 px-3 py-2 cursor-pointer border-none transition-colors hover:bg-bg-tertiary"
            style={{
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-light)',
                color: 'var(--text-primary)'
            }}
        >
            <i className={`fas ${icon} text-[11px]`} style={{ color: accent, textAlign: 'center', width: 14 }} />
            <span className="text-[10.5px] font-bold uppercase tracking-wider flex-1 text-left">{label}</span>
            <span
                className="text-[10.5px] font-mono tabular-nums rounded px-1.5 py-0.5"
                style={{
                    background: count > 0 ? `${accent}1a` : 'var(--bg-tertiary)',
                    color: count > 0 ? accent : 'var(--text-tertiary)'
                }}
            >
                {count}
            </span>
            <i
                className={`fas fa-chevron-${isOpen ? 'down' : 'right'} text-[9px]`}
                style={{ color: 'var(--text-tertiary)' }}
            />
        </button>
    )
}

/** Single selectable row inside a section. Shows the form title, plant chip,
 *  meta line (due/submission date + submitter when present), and a status
 *  badge on the right. Active row highlights with the user's accent. */
function ItemRow({ accentColor, isActive, item, onClick, onDelete, statusKey }) {
    const title = item.form?.title || item.maintenance_forms?.title || 'Untitled form'
    const dateLabel = item.due_date
        ? `Due ${formatMaintenanceDate(item.due_date)}`
        : item.submitted_at
          ? `Submitted ${formatMaintenanceDate(item.submitted_at)}`
          : item.reviewed_at
            ? `Reviewed ${formatMaintenanceDate(item.reviewed_at)}`
            : null
    const submitter = item.submitted_by_name || null

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onClick?.(item)}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onClick?.(item)
                }
            }}
            className="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors hover:bg-bg-tertiary"
            style={{
                background: isActive ? `${accentColor}14` : 'transparent',
                borderBottom: '1px solid var(--border-light)',
                borderLeft: `3px solid ${isActive ? accentColor : 'transparent'}`
            }}
        >
            <ItemIcon status={statusKey} />
            <div className="min-w-0 flex-1">
                <div
                    className="text-[12px] font-semibold truncate"
                    style={{ color: isActive ? accentColor : 'var(--text-primary)' }}
                >
                    {title}
                </div>
                <div
                    className="flex items-center gap-1.5 mt-0.5 text-[10.5px] flex-wrap"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    <PlantChip code={item.plant_code} />
                    {dateLabel && <span className="font-mono tabular-nums">{dateLabel}</span>}
                    {submitter && (
                        <>
                            <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                            <span className="truncate max-w-[140px]">{submitter}</span>
                        </>
                    )}
                </div>
            </div>
            <div className="shrink-0 flex items-center gap-1">
                <StatusBadge status={statusKey} />
                {onDelete && (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation()
                            onDelete(event, item.id)
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded transition-colors hover:bg-bg-tertiary border-none bg-transparent cursor-pointer"
                        style={{ color: 'var(--text-tertiary)' }}
                        title="Delete submission"
                    >
                        <i className="fas fa-trash-alt text-[9px]" />
                    </button>
                )}
            </div>
        </div>
    )
}

/** Inline empty state shown when a section has no rows. */
function SectionEmpty({ message }) {
    return (
        <div
            className="px-3 py-3 text-[11px]"
            style={{
                background: 'var(--bg-primary)',
                borderBottom: '1px solid var(--border-light)',
                color: 'var(--text-tertiary)'
            }}
        >
            {message}
        </div>
    )
}

/** Skeleton row for the loading state — keeps the rail's layout stable. */
function SkeletonRow() {
    return (
        <div className="flex items-center gap-2.5 px-3 py-2" style={{ borderBottom: '1px solid var(--border-light)' }}>
            <div className="w-6 h-6 rounded animate-pulse shrink-0" style={{ background: 'var(--bg-tertiary)' }} />
            <div className="flex-1 min-w-0">
                <div className="h-3 w-32 rounded animate-pulse mb-1" style={{ background: 'var(--bg-tertiary)' }} />
                <div className="h-2.5 w-44 rounded animate-pulse" style={{ background: 'var(--bg-secondary)' }} />
            </div>
            <div className="h-4 w-12 rounded animate-pulse shrink-0" style={{ background: 'var(--bg-tertiary)' }} />
        </div>
    )
}

const itemMatchesQuery = (item, query) => {
    if (!query) return true
    const q = query.trim().toLowerCase()
    const haystack = [item.form?.title, item.maintenance_forms?.title, item.plant_code, item.submitted_by_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
    return haystack.includes(q)
}

const itemMatchesPlant = (item, selectedPlant) => {
    if (!selectedPlant || selectedPlant === 'All') return true
    if (selectedPlant.startsWith('DISTRICT:')) return true // district filtering handled upstream
    return (item.plant_code || '').toUpperCase() === selectedPlant.toUpperCase()
}

const dedupeById = (items) => {
    const seen = new Set()
    return items.filter((item) => {
        if (!item?.id || seen.has(item.id)) return false
        seen.add(item.id)
        return true
    })
}

/**
 * Sectioned forms rail — left column of the combined Maintenance Log workflow.
 * Groups every form-related item the user has access to (Due / Pending Review /
 * Submissions) into collapsible sections so upload, review, and history all
 * live next to each other and feed a single right-hand detail pane.
 */
export function MaintenanceFormsRail({
    accentColor,
    canReview,
    dueItems,
    formLoading,
    mySubmissions,
    onDeleteSubmission,
    onSelectItem,
    pendingReviews,
    reviewedSubmissions,
    searchText,
    selectedItemId,
    selectedPlant
}) {
    const [openSections, setOpenSections] = useState({ due: true, history: false, review: true })
    const toggle = (key) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))

    const filterItems = (items) =>
        items.filter((item) => itemMatchesPlant(item, selectedPlant) && itemMatchesQuery(item, searchText))

    const filteredDue = useMemo(
        () => filterItems(dueItems || []).sort((a, b) => (a.plant_code || '').localeCompare(b.plant_code || '')),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [dueItems, searchText, selectedPlant]
    )
    const filteredPendingReviews = useMemo(
        () => filterItems(pendingReviews || []),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [pendingReviews, searchText, selectedPlant]
    )
    const submissionHistory = useMemo(() => {
        const merged = dedupeById([...(reviewedSubmissions || []), ...(mySubmissions || [])])
        return filterItems(merged).sort(
            (a, b) => new Date(b.submitted_at || b.reviewed_at || 0) - new Date(a.submitted_at || a.reviewed_at || 0)
        )
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reviewedSubmissions, mySubmissions, searchText, selectedPlant])

    if (formLoading) {
        return (
            <div className="flex flex-col">
                <div
                    className="px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider"
                    style={{
                        background: 'var(--bg-secondary)',
                        borderBottom: '1px solid var(--border-light)',
                        color: 'var(--text-tertiary)'
                    }}
                >
                    Loading forms…
                </div>
                {Array.from({ length: 6 }, (_, i) => (
                    <SkeletonRow key={i} />
                ))}
            </div>
        )
    }

    const handleSelectDue = (item) => onSelectItem?.({ ...item, __kind: 'form-due' })
    const handleSelectReview = (item) =>
        onSelectItem?.({ ...item, __kind: 'form-review', form: item.maintenance_forms, isReview: true })
    const handleSelectHistory = (item) => {
        const isPending = item.status === 'submitted'
        onSelectItem?.({
            ...item,
            __kind: isPending && canReview ? 'form-review' : 'form-history',
            form: item.maintenance_forms,
            isReview: isPending && canReview,
            isViewOnly: !isPending || !canReview
        })
    }

    return (
        <div className="flex flex-col">
            <SectionHeader
                accentColor={accentColor}
                count={filteredDue.length}
                icon="fa-clipboard-list"
                isOpen={openSections.due}
                label="Forms to upload"
                onToggle={() => toggle('due')}
                tone="warning"
            />
            {openSections.due &&
                (filteredDue.length === 0 ? (
                    <SectionEmpty message="No recurring forms are due right now." />
                ) : (
                    filteredDue.map((item) => (
                        <ItemRow
                            key={`due-${item.id}`}
                            accentColor={accentColor}
                            isActive={selectedItemId === item.id}
                            item={item}
                            onClick={handleSelectDue}
                            statusKey={item.status || 'pending'}
                        />
                    ))
                ))}

            {canReview && (
                <>
                    <SectionHeader
                        accentColor={accentColor}
                        count={filteredPendingReviews.length}
                        icon="fa-clipboard-check"
                        isOpen={openSections.review}
                        label="Awaiting review"
                        onToggle={() => toggle('review')}
                        tone="danger"
                    />
                    {openSections.review &&
                        (filteredPendingReviews.length === 0 ? (
                            <SectionEmpty message="Nothing to review — submissions land here when teams upload." />
                        ) : (
                            filteredPendingReviews.map((item) => (
                                <ItemRow
                                    key={`review-${item.id}`}
                                    accentColor={accentColor}
                                    isActive={selectedItemId === item.id}
                                    item={item}
                                    onClick={handleSelectReview}
                                    onDelete={onDeleteSubmission}
                                    statusKey={item.status || 'submitted'}
                                />
                            ))
                        ))}
                </>
            )}

            <SectionHeader
                accentColor={accentColor}
                count={submissionHistory.length}
                icon="fa-clock-rotate-left"
                isOpen={openSections.history}
                label="Submission history"
                onToggle={() => toggle('history')}
            />
            {openSections.history &&
                (submissionHistory.length === 0 ? (
                    <SectionEmpty message="Reviewed submissions and your past uploads appear here." />
                ) : (
                    submissionHistory.map((item) => (
                        <ItemRow
                            key={`history-${item.id}`}
                            accentColor={accentColor}
                            isActive={selectedItemId === item.id}
                            item={item}
                            onClick={handleSelectHistory}
                            onDelete={onDeleteSubmission}
                            statusKey={item.status || 'completed'}
                        />
                    ))
                ))}
        </div>
    )
}
