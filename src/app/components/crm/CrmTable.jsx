/* eslint-disable react/forbid-dom-props */
import React, { useMemo, useState } from 'react'

/** Stable per-row entrance stagger, capped so long lists don't crawl in. */
function rowDelay(i) {
    return Math.min(i * 16, 320)
}

/** Generic comparator: nulls last, numbers (and numeric strings) numerically,
 *  everything else case-insensitive with natural number ordering. */
function compareValues(a, b) {
    if (a == null && b == null) return 0
    if (a == null) return 1
    if (b == null) return -1
    if (typeof a === 'number' && typeof b === 'number') return a - b
    const na = Number(a)
    const nb = Number(b)
    if (a !== '' && b !== '' && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

/**
 * Shared CRM data table — mirrors the Operations → Schedule table so CRM
 * list views read identically to the rest of the site: a flat rounded
 * container with its own scroll viewport, a sticky uppercase header on a
 * `bg-bg-tertiary` strip, and dense 12.5px rows with hover highlight.
 *
 * Every column header is a sort control: click to sort ascending, again for
 * descending, a third time to restore the caller's order. Sort value defaults
 * to `row[col.key]`; pass `col.sortValue(row)` for columns whose display value
 * differs from the underlying data, or `col.sortable === false` to opt out.
 *
 * `columns`: `[{ key, label, align?: 'right', mono?: boolean, render?: (row) => node,
 *               sortable?: boolean, sortValue?: (row) => string|number }]`
 * Rows are clickable (keyboard-accessible) when `onRowClick` is provided.
 *
 * @param {Object} props
 * @param {Array}  props.columns
 * @param {Array}  props.rows
 * @param {(row) => string} props.rowKey
 * @param {(row) => void} [props.onRowClick]
 * @param {string} [props.emptyMessage]
 * @param {string} [props.maxHeight] - CSS height cap for the sticky-header viewport.
 */
export function CrmTable({
    columns,
    emptyMessage = 'Nothing to show.',
    maxHeight = 'calc(100dvh - 300px)',
    onRowClick,
    rowKey,
    rows
}) {
    // null = caller's order; otherwise sort by one column asc/desc.
    const [sort, setSort] = useState(null)

    const sortedRows = useMemo(() => {
        if (!sort) return rows
        const col = columns.find((c) => c.key === sort.key)
        if (!col) return rows
        const accessor = col.sortValue || ((row) => row[col.key])
        const direction = sort.dir === 'asc' ? 1 : -1
        return [...rows].sort((a, b) => direction * compareValues(accessor(a), accessor(b)))
    }, [rows, sort, columns])

    const cycleSort = (col) => {
        if (col.sortable === false) return
        setSort((prev) => {
            if (!prev || prev.key !== col.key) return { dir: 'asc', key: col.key }
            if (prev.dir === 'asc') return { dir: 'desc', key: col.key }
            return null
        })
    }

    if (!rows.length) {
        return (
            <div className="rounded-md p-6 text-center text-[12.5px] bg-bg-primary border border-border-light text-text-secondary">
                {emptyMessage}
            </div>
        )
    }

    return (
        <div className="rounded-md overflow-auto bg-bg-primary border border-border-light" style={{ maxHeight }}>
            <table className="w-full text-[12.5px] border-collapse">
                <thead>
                    <tr>
                        {columns.map((col) => {
                            const sortable = col.sortable !== false
                            const active = sort?.key === col.key
                            const ariaSort = !sortable
                                ? undefined
                                : active
                                  ? sort.dir === 'asc'
                                      ? 'ascending'
                                      : 'descending'
                                  : 'none'
                            return (
                                <th
                                    key={col.key}
                                    aria-sort={ariaSort}
                                    className={`px-3 py-2 whitespace-nowrap bg-bg-tertiary border-b border-border-light sticky top-0 z-10 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                                    style={{ boxShadow: '0 1px 0 0 var(--border-light)' }}
                                >
                                    {sortable ? (
                                        <button type="button"
                                            onClick={() => cycleSort(col)}
                                            className={`group -mx-1 inline-flex items-center gap-1.5 rounded px-1 py-0.5 cursor-pointer select-none border-none bg-transparent uppercase tracking-wider text-[10.5px] font-bold transition-colors duration-150 ${active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_35%,transparent)]`}
                                        >
                                            <span>{col.label}</span>
                                            <i
                                                className={`fas text-[9px] transition-opacity duration-150 ${
                                                    active
                                                        ? sort.dir === 'asc'
                                                            ? 'fa-sort-up text-text-primary'
                                                            : 'fa-sort-down text-text-primary'
                                                        : 'fa-sort text-text-tertiary opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
                                                }`}
                                                aria-hidden="true"
                                            />
                                        </button>
                                    ) : (
                                        <span className="uppercase tracking-wider text-[10.5px] font-bold text-text-secondary">
                                            {col.label}
                                        </span>
                                    )}
                                </th>
                            )
                        })}
                    </tr>
                </thead>
                <tbody>
                    {sortedRows.map((row, i) => {
                        const clickable = Boolean(onRowClick)
                        return (
                            <tr
                                key={rowKey(row)}
                                onClick={clickable ? () => onRowClick(row) : undefined}
                                onKeyDown={
                                    clickable
                                        ? (e) => {
                                              if (e.key === 'Enter' || e.key === ' ') {
                                                  e.preventDefault()
                                                  onRowClick(row)
                                              }
                                          }
                                        : undefined
                                }
                                role={clickable ? 'button' : undefined}
                                tabIndex={clickable ? 0 : undefined}
                                className={`border-b border-border-light last:border-b-0 animate-fade-in-fast motion-reduce:animate-none ${clickable ? 'cursor-pointer transition-colors duration-150 hover:bg-bg-hover focus-visible:bg-bg-hover focus-visible:outline-none' : ''}`}
                                style={{ animationDelay: `${rowDelay(i)}ms` }}
                            >
                                {columns.map((col) => (
                                    <td
                                        key={col.key}
                                        className={`px-3 py-2 align-middle text-text-primary ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.mono ? 'font-mono tabular-nums' : ''}`}
                                    >
                                        {col.render ? col.render(row) : row[col.key]}
                                    </td>
                                ))}
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
