/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { useConfirm } from '../../../../../app/context/ConfirmContext'
import { usePreferences } from '../../../../../app/context/PreferencesContext'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 9999]

const STATUS_PILL_BASE =
    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-wider shrink-0'

/** Compact paginator select — appearance-none + inline chevron so the
 *  affordance survives, plus theme-aware tokens and color-scheme so the
 *  option list paints correctly in dark / light / gray. */
const PAGE_SIZE_SELECT_CLASS = `rounded pl-2 pr-7 py-1 text-[11px] cursor-pointer appearance-none bg-bg-primary border border-border-light text-text-primary hover:border-border-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:border-[var(--accent)] [color-scheme:light] dark:[color-scheme:dark] bg-no-repeat bg-[right_6px_center] bg-[length:12px] bg-[url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='%2394a3b8'%20stroke-linecap='round'%20stroke-linejoin='round'%20stroke-width='2'%3E%3Cpath%20d='M19%209l-7%207-7-7'/%3E%3C/svg%3E")]`

const PageSizeSelect = ({ value, onChange }) => (
    <div className="flex items-center gap-2 text-[11px] text-text-secondary">
        <label htmlFor="lost-loads-page-size" className="hidden sm:inline uppercase tracking-wider text-[10px]">
            Show
        </label>
        <select
            id="lost-loads-page-size"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className={PAGE_SIZE_SELECT_CLASS}
        >
            {PAGE_SIZE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                    {opt === 9999 ? 'All' : opt}
                </option>
            ))}
        </select>
    </div>
)

const PageButton = ({ disabled, onClick, children }) => (
    <button
        type="button"
        className="px-2.5 py-1 text-[11px] font-semibold rounded uppercase tracking-wider border border-border-light transition-colors duration-150 hover:enabled:bg-bg-tertiary hover:enabled:border-border-medium disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
        style={{
            background: disabled ? 'var(--bg-secondary)' : 'var(--bg-primary)',
            color: disabled ? 'var(--text-tertiary)' : 'var(--text-primary)'
        }}
        onClick={onClick}
        disabled={disabled}
    >
        {children}
    </button>
)

const Pagination = ({ currentPage, totalPages, pageSize, onPageSizeChange, onPageChange }) => (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1 py-2 mt-3">
        <PageSizeSelect value={pageSize} onChange={onPageSizeChange} />
        <div className="flex items-center gap-2">
            <PageButton disabled={currentPage === 1} onClick={() => onPageChange(Math.max(1, currentPage - 1))}>
                Prev
            </PageButton>
            <span className="text-[11px] font-mono tabular-nums text-text-secondary">
                {currentPage} / {totalPages}
            </span>
            <PageButton
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            >
                Next
            </PageButton>
        </div>
    </div>
)

const LostLoadRow = ({ report, getUserName, accentColor, canDelete, onDelete, onClick }) => {
    const confirm = useConfirm()
    const lostDate = report.data?.lost_load_date
        ? new Date(report.data.lost_load_date + 'T12:00:00')
        : report.submitted_at
          ? new Date(report.submitted_at)
          : null
    const dateLabel = lostDate ? lostDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''
    const submitterName = getUserName(report.userId) || 'Unknown'
    const title = report.data?.truck_number
        ? `Truck ${report.data.truck_number}${report.data?.yardage != null ? ` — ${report.data.yardage} yds` : ''}`
        : 'Lost Load'

    return (
        <div
            className="flex items-center px-3 py-2 cursor-pointer transition-colors hover:bg-bg-tertiary border-b border-border-light"
            onClick={() => onClick?.(report)}
        >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 bg-red-100 text-text-primary">
                    <i className="fas fa-truck text-[10px]" />
                </div>
                <div className="min-w-0">
                    <span className="text-[12px] font-semibold block truncate text-text-primary">{title}</span>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px] text-text-secondary">
                        <span className="truncate">{submitterName}</span>
                        {dateLabel && (
                            <>
                                <span className="text-text-tertiary">·</span>
                                <span className="font-mono tabular-nums">{dateLabel}</span>
                            </>
                        )}
                        {report.data?.plant && (
                            <>
                                <span className="text-text-tertiary">·</span>
                                <span>{report.data.plant}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <span className={`${STATUS_PILL_BASE} bg-green-100 text-text-primary`}>Submitted</span>
            <button
                className="ml-2 px-2 py-1 rounded text-white text-[10.5px] font-semibold shrink-0 hidden sm:inline-flex uppercase tracking-wider"
                style={{ background: accentColor }}
                onClick={(e) => {
                    e.stopPropagation()
                    onClick?.(report)
                }}
            >
                View
            </button>
            {canDelete && (
                <button
                    type="button"
                    onClick={async (e) => {
                        e.stopPropagation()
                        if (await confirm({ title: 'Delete this lost load report?', confirmLabel: 'Delete' })) {
                            onDelete(report.id)
                        }
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded shrink-0 ml-1.5 hidden sm:flex transition-colors hover:bg-bg-tertiary text-text-tertiary"
                    title="Delete"
                >
                    <i className="fas fa-trash-alt text-[10px]" />
                </button>
            )}
            <i className="fas fa-chevron-right text-[10px] ml-2 sm:hidden text-text-tertiary" />
        </div>
    )
}

function LostLoadsList({
    isLoading,
    items,
    pageSize,
    currentPage,
    totalPages,
    onPageSizeChange,
    onPageChange,
    getUserName,
    canDelete,
    onDelete,
    onRowClick
}) {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'

    if (items.length === 0 && !isLoading) {
        return (
            <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
                <div className="flex flex-col items-center justify-center py-10 px-4 text-text-tertiary">
                    <i className="fas fa-truck text-2xl mb-2" />
                    <div className="text-[12px]">No loss reports</div>
                </div>
            </div>
        )
    }

    return (
        <div>
            <div className="mb-3">
                <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                        Loss Reports
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider font-mono tabular-nums bg-bg-tertiary text-text-secondary">
                        {items.length}
                    </span>
                </div>
                <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
                    {isLoading
                        ? [1, 2, 3, 4, 5].map((i) => (
                              <div key={i} className="flex items-center gap-2.5 px-3 py-2 border-b border-border-light">
                                  <div className="w-6 h-6 rounded animate-pulse shrink-0 bg-bg-tertiary" />
                                  <div className="flex-1 min-w-0">
                                      <div className="h-3 w-40 rounded animate-pulse mb-1 bg-bg-tertiary" />
                                      <div className="h-2.5 w-56 rounded animate-pulse bg-bg-secondary" />
                                  </div>
                                  <div className="h-4 w-16 rounded animate-pulse shrink-0 bg-bg-tertiary" />
                              </div>
                          ))
                        : items.map((report) => (
                              <LostLoadRow
                                  key={report.id}
                                  report={report}
                                  getUserName={getUserName}
                                  accentColor={accentColor}
                                  canDelete={canDelete}
                                  onDelete={onDelete}
                                  onClick={onRowClick}
                              />
                          ))}
                </div>
            </div>
            {items.length > 0 && totalPages > 1 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    onPageSizeChange={onPageSizeChange}
                    onPageChange={onPageChange}
                />
            )}
        </div>
    )
}
export default LostLoadsList
