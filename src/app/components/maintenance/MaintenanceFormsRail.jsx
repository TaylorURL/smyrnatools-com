/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import { formatMaintenanceDate } from '../../../utils/MaintenanceUtility'
import { ItemIcon, PlantChip, StatusBadge } from './MaintenanceFormAtoms'

/* ── Per-plant rollup ─────────────────────────────────────────────────────
 *  Each plant location appears exactly once. The row state tells the user
 *  at a glance whether that plant has submitted its current-period form:
 *
 *    Not submitted   — there's an open due item with no submission yet.
 *    Pending review  — they submitted; reviewer hasn't decided yet.
 *    Approved        — submission was accepted.
 *    Rejected        — needs to resubmit.
 *    No activity     — neither a due item nor a submission was found for
 *                      this plant in the visible window.
 *
 *  Clicking a row routes to the most appropriate detail mode: SubmitMode
 *  when the plant still needs to upload, ReviewMode when a reviewer is
 *  the user and the submission is pending, ViewOnlyMode otherwise.
 */

const STATUS_PRIORITY = {
    rejected: 5, // most urgent: needs resubmit
    overdue: 4, // past due_date with no matching submission
    submitted: 3, // waiting on a reviewer
    approved: 2,
    completed: 1,
    upcoming: 0 // future due_date — surfaces only when no submission exists
}

const ROW_KIND = {
    due: 'due',
    pending: 'pending',
    reviewed: 'reviewed',
    mine: 'mine'
}

/** YYYY-MM-DD for "today" so future/overdue checks ignore the clock. */
function todayIso() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Period key used to match a submission against its due item — both
 *  carry the same `due_date` for the same form-period, so equal keys
 *  mean the worker has already satisfied that due slot. */
function itemPeriodKey(item) {
    const formId = item?.form_id || item?.maintenance_forms?.id || ''
    const dueDate = item?.due_date || ''
    if (!formId || !dueDate) return null
    return `${formId}|${dueDate}`
}

const STATUS_LABELS = {
    approved: { description: 'Submitted and approved for the period.', label: 'Submitted · approved' },
    notSubmitted: { description: 'No upload yet for this period.', label: 'Not submitted' },
    pending: { description: 'Submitted — reviewer hasn’t decided yet.', label: 'Pending review' },
    rejected: { description: 'Submission was rejected; needs to be resubmitted.', label: 'Rejected · resubmit' }
}

function itemEffectiveDate(item) {
    return item?.submitted_at || item?.reviewed_at || item?.due_date || null
}

function rowStatusKey(row) {
    if (!row) return 'notSubmitted'
    if (row.kind === ROW_KIND.due) return 'notSubmitted'
    const s = (row.item?.status || '').toLowerCase()
    if (s === 'rejected') return 'rejected'
    if (s === 'approved') return 'approved'
    if (s === 'submitted') return 'pending'
    return 'pending'
}

function priorityScore(row, todayKey) {
    if (!row) return 0
    if (row.kind === ROW_KIND.due) {
        const due = row.item?.due_date || ''
        return due && due < todayKey ? STATUS_PRIORITY.overdue : STATUS_PRIORITY.upcoming
    }
    const s = (row.item?.status || '').toLowerCase()
    return STATUS_PRIORITY[s] ?? STATUS_PRIORITY.completed
}

/** Pick the single most relevant item for a plant.
 *
 *  Step 1: drop any due item whose `(form_id, due_date)` matches an
 *  existing submission — that period has been satisfied even if the
 *  upstream loader still ships the due placeholder. This fixes the
 *  "shows 'Not submitted' right after a submit" bug.
 *
 *  Step 2: a remaining due item with a future due_date scores LOWER
 *  than any submission, so a recent approved/pending submission keeps
 *  the plant green/yellow instead of being shadowed by next month's
 *  upcoming form. A remaining due item that's PAST due (overdue) still
 *  outranks an approved submission so the plant doesn't read as "done"
 *  while an older period is unsatisfied.
 *
 *  Step 3: ties break on the effective date — most recent wins. */
function pickPlantRow(rows) {
    if (!rows?.length) return null
    const submissionKeys = new Set()
    rows.forEach((row) => {
        if (row.kind === ROW_KIND.due) return
        const key = itemPeriodKey(row.item)
        if (key) submissionKeys.add(key)
    })
    const filtered = rows.filter((row) => {
        if (row.kind !== ROW_KIND.due) return true
        const key = itemPeriodKey(row.item)
        return !key || !submissionKeys.has(key)
    })
    if (!filtered.length) return null
    const today = todayIso()
    return [...filtered].sort((a, b) => {
        const dp = priorityScore(b, today) - priorityScore(a, today)
        if (dp !== 0) return dp
        const ad = new Date(itemEffectiveDate(a.item) || 0).getTime()
        const bd = new Date(itemEffectiveDate(b.item) || 0).getTime()
        return bd - ad
    })[0]
}

function itemMatchesQuery(item, query) {
    if (!query) return true
    const q = query.trim().toLowerCase()
    if (!q) return true
    const haystack = [item.form?.title, item.maintenance_forms?.title, item.plant_code, item.submitted_by_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
    return haystack.includes(q)
}

function itemMatchesPlant(item, selectedPlant) {
    if (!selectedPlant || selectedPlant === 'All') return true
    if (selectedPlant.startsWith('DISTRICT:')) return true
    return (item.plant_code || '').toUpperCase() === selectedPlant.toUpperCase()
}

/** One plant row: status icon · plant chip · current form title · status
 *  pill. The whole row is clickable; the trash button is only enabled for
 *  submission-backed rows (workers can delete their own uploads). */
function PlantRow({ accentColor, isActive, onClick, onDelete, row }) {
    const statusKey = rowStatusKey(row)
    const status = STATUS_LABELS[statusKey] || STATUS_LABELS.notSubmitted
    const item = row.item
    const title = item.form?.title || item.maintenance_forms?.title || 'Maintenance form'
    const dateLabel =
        row.kind === ROW_KIND.due && item.due_date
            ? `Due ${formatMaintenanceDate(item.due_date)}`
            : item.submitted_at
              ? `Submitted ${formatMaintenanceDate(item.submitted_at)}`
              : item.reviewed_at
                ? `Reviewed ${formatMaintenanceDate(item.reviewed_at)}`
                : null

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onClick?.(row)}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onClick?.(row)
                }
            }}
            className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors hover:bg-bg-tertiary border-b border-border-light"
            style={{
                background: isActive ? `${accentColor}14` : 'transparent',
                borderLeft: `3px solid ${isActive ? accentColor : 'transparent'}`
            }}
            title={status.description}
        >
            <ItemIcon
                status={
                    statusKey === 'notSubmitted'
                        ? 'pending'
                        : statusKey === 'pending'
                          ? 'submitted'
                          : statusKey === 'approved'
                            ? 'approved'
                            : statusKey === 'rejected'
                              ? 'rejected'
                              : 'pending'
                }
            />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <PlantChip code={row.plantCode} />
                    <div
                        className="text-[12.5px] font-semibold truncate"
                        style={{ color: isActive ? accentColor : 'var(--text-primary)' }}
                    >
                        {title}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px] flex-wrap text-text-secondary">
                    {dateLabel && <span className="font-mono tabular-nums">{dateLabel}</span>}
                </div>
            </div>
            <div className="shrink-0 flex items-center gap-1">
                <StatusBadge status={status.label.replace(/\s/g, ' ').toLowerCase()} />
                {onDelete && row.kind !== ROW_KIND.due && (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation()
                            onDelete(event, item.id)
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded transition-colors hover:bg-bg-tertiary border-none bg-transparent cursor-pointer text-text-tertiary"
                        title="Delete submission"
                    >
                        <i className="fas fa-trash-alt text-[9px]" />
                    </button>
                )}
            </div>
        </div>
    )
}

/** Skeleton row while form data is loading — keeps rail height stable. */
function SkeletonRow() {
    return (
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border-light">
            <div className="w-6 h-6 rounded animate-pulse shrink-0 bg-bg-tertiary" />
            <div className="flex-1 min-w-0">
                <div className="h-3 w-32 rounded animate-pulse mb-1 bg-bg-tertiary" />
                <div className="h-2.5 w-44 rounded animate-pulse bg-bg-secondary" />
            </div>
            <div className="h-4 w-20 rounded animate-pulse shrink-0 bg-bg-tertiary" />
        </div>
    )
}

/**
 * Per-plant maintenance forms rail — left column of the combined log.
 * Each plant location appears exactly once with its current submission
 * status surfaced as a badge. Click a row to open the form detail panel
 * in the appropriate mode (submit / review / view-only) for that plant.
 *
 * The prior implementation grouped by item-type (Due / Pending Review /
 * Submission history) which duplicated a plant across sections whenever
 * it had both a due form and a submission, and added extra rows for
 * every historical submission. The new layout collapses all of that
 * into a single row per plant; full submission history for a plant
 * remains accessible via the "Previous submissions" card in the
 * detail panel.
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
    /* Group every form item we know about by plant_code, tagged with its
     * source kind so the click router can pick the right detail mode. */
    const plantRows = useMemo(() => {
        const passes = (item) => itemMatchesPlant(item, selectedPlant) && itemMatchesQuery(item, searchText)
        const byPlant = new Map()
        const push = (item, kind) => {
            if (!item || !item.plant_code || !passes(item)) return
            const list = byPlant.get(item.plant_code) || []
            list.push({ item, kind, plantCode: item.plant_code })
            byPlant.set(item.plant_code, list)
        }
        ;(dueItems || []).forEach((i) => push(i, ROW_KIND.due))
        ;(pendingReviews || []).forEach((i) => push(i, ROW_KIND.pending))
        ;(mySubmissions || []).forEach((i) => push(i, ROW_KIND.mine))
        ;(reviewedSubmissions || []).forEach((i) => push(i, ROW_KIND.reviewed))

        const rows = []
        byPlant.forEach((items, plantCode) => {
            const pick = pickPlantRow(items)
            if (pick) rows.push({ ...pick, plantCode })
        })
        return rows.sort((a, b) => a.plantCode.localeCompare(b.plantCode))
    }, [dueItems, pendingReviews, mySubmissions, reviewedSubmissions, searchText, selectedPlant])

    if (formLoading) {
        return (
            <div className="flex flex-col">
                <div className="px-3 py-2 text-[10.5px] font-bold uppercase tracking-wider bg-bg-secondary border-b border-border-light text-text-tertiary">
                    Loading plants…
                </div>
                {Array.from({ length: 6 }, (_, i) => (
                    <SkeletonRow key={i} />
                ))}
            </div>
        )
    }

    const handleSelect = (row) => {
        if (!row) return
        if (row.kind === ROW_KIND.due) {
            onSelectItem?.({ ...row.item, __kind: 'form-due' })
            return
        }
        const isPending = (row.item.status || '').toLowerCase() === 'submitted'
        onSelectItem?.({
            ...row.item,
            __kind: isPending && canReview ? 'form-review' : 'form-history',
            form: row.item.maintenance_forms,
            isReview: isPending && canReview,
            isViewOnly: !(isPending && canReview)
        })
    }

    const notSubmittedCount = plantRows.filter((r) => rowStatusKey(r) === 'notSubmitted').length
    const submittedCount = plantRows.length - notSubmittedCount

    return (
        <div className="flex flex-col">
            <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border-b border-border-light">
                <i className="fas fa-industry text-[11px] text-text-tertiary" />
                <span className="text-[10.5px] font-bold uppercase tracking-wider flex-1 text-text-primary">
                    Plants
                </span>
                <span
                    className="text-[10.5px] font-mono tabular-nums rounded px-1.5 py-0.5 bg-bg-tertiary text-text-tertiary"
                    title={`${submittedCount} submitted · ${notSubmittedCount} not submitted`}
                >
                    {submittedCount}/{plantRows.length}
                </span>
            </div>
            {plantRows.length === 0 ? (
                <div className="px-3 py-6 text-[12px] text-center text-text-tertiary">
                    No maintenance activity for the active filter.
                </div>
            ) : (
                plantRows.map((row) => (
                    <PlantRow
                        key={row.plantCode}
                        accentColor={accentColor}
                        isActive={selectedItemId === row.item.id}
                        onClick={handleSelect}
                        onDelete={onDeleteSubmission}
                        row={row}
                    />
                ))
            )}
        </div>
    )
}
