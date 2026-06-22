import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { usePreferences } from '../../../context/PreferencesContext'
import { createWorkbook, downloadWorkbook } from '../../../../utils/ExportWorkbook'

const SORT_ASC = 'asc'
const SORT_DESC = 'desc'

function toTitleCase(snakeStr) {
    return snakeStr
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
}

function SortIndicator({ direction }) {
    if (!direction) return <span className="ml-1 opacity-30 text-[10px]">⇅</span>
    return (
        <span className="ml-1 text-[10px]">
            {direction === SORT_ASC ? '▲' : '▼'}
        </span>
    )
}

function WorkbookToolbar({ accentColor, exporting, onExport, onSearch, rowCount, searchQuery, title }) {
    return (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border-light bg-bg-primary flex-wrap">
            <div className="flex items-center gap-3">
                <span className="text-[13px] font-semibold text-text-primary">{title}</span>
                <span className="text-[11px] text-text-tertiary font-medium tabular-nums">
                    {rowCount} {rowCount === 1 ? 'row' : 'rows'}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <div className="relative">
                    <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-text-tertiary pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearch(e.target.value)}
                        placeholder="Search all columns…"
                        className="pl-7 pr-3 py-1.5 text-[12px] rounded-md border border-border-light bg-bg-secondary text-text-primary placeholder:text-text-tertiary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 outline-none w-48 sm:w-56"
                    />
                </div>
                <button
                    type="button"
                    onClick={onExport}
                    disabled={exporting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold text-white border-none cursor-pointer transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: accentColor }}
                >
                    <i className={`fas ${exporting ? 'fa-spinner fa-spin' : 'fa-file-excel'} text-[11px]`} />
                    <span>{exporting ? 'Exporting…' : 'Download .xlsx'}</span>
                </button>
            </div>
        </div>
    )
}

function WorkbookHeaderCell({ column, onSort, sortDirection, style }) {
    return (
        <th
            scope="col"
            onClick={() => onSort(column.key)}
            className="px-3 py-2 text-left text-[11px] font-semibold text-text-secondary uppercase tracking-wider cursor-pointer select-none whitespace-nowrap border-b border-r border-border-light bg-bg-tertiary hover:bg-bg-secondary transition-colors duration-100 last:border-r-0"
            style={style}
        >
            <span className="inline-flex items-center">
                {column.header}
                <SortIndicator direction={sortDirection} />
            </span>
        </th>
    )
}

function WorkbookCell({ children, isFirstColumn, style }) {
    return (
        <td
            className={`px-3 py-1.5 text-[12px] text-text-primary whitespace-nowrap border-r border-border-light last:border-r-0 ${isFirstColumn ? 'font-semibold bg-bg-primary sticky left-0 z-[1]' : ''}`}
            style={style}
        >
            {children}
        </td>
    )
}

export default function AssetWorkbookView({ columns, data, loading, lookups, title }) {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'
    const [searchQuery, setSearchQuery] = useState('')
    const [sortKey, setSortKey] = useState(null)
    const [sortDirection, setSortDirection] = useState(null)
    const [exporting, setExporting] = useState(false)
    const tableContainerRef = useRef(null)

    const resolvedColumns = useMemo(() =>
        columns.map((col) => ({
            ...col,
            header: col.header || toTitleCase(col.key),
            width: col.width || 'auto'
        })),
    [columns])

    const transformedRows = useMemo(() => {
        if (!data?.length) return []
        return data.map((rawRow) => {
            const displayRow = {}
            const sortRow = {}
            for (const col of resolvedColumns) {
                const rawValue = rawRow[col.key]
                if (col.transform) {
                    const result = col.transform(rawValue, rawRow, lookups)
                    if (typeof result === 'object' && result !== null && 'display' in result) {
                        displayRow[col.key] = result.display
                        sortRow[col.key] = result.sortValue ?? result.display
                    } else {
                        displayRow[col.key] = result
                        sortRow[col.key] = result
                    }
                } else {
                    displayRow[col.key] = rawValue ?? ''
                    sortRow[col.key] = rawValue ?? ''
                }
            }
            return { _raw: rawRow, display: displayRow, sort: sortRow }
        })
    }, [data, resolvedColumns, lookups])

    const filteredRows = useMemo(() => {
        if (!searchQuery.trim()) return transformedRows
        const query = searchQuery.toLowerCase().trim()
        return transformedRows.filter((row) =>
            resolvedColumns.some((col) => {
                const val = row.display[col.key]
                return val != null && String(val).toLowerCase().includes(query)
            })
        )
    }, [transformedRows, searchQuery, resolvedColumns])

    const sortedRows = useMemo(() => {
        if (!sortKey || !sortDirection) return filteredRows
        const col = resolvedColumns.find((c) => c.key === sortKey)
        if (!col) return filteredRows

        return [...filteredRows].sort((a, b) => {
            let aVal = a.sort[sortKey]
            let bVal = b.sort[sortKey]

            if (aVal == null && bVal == null) return 0
            if (aVal == null) return 1
            if (bVal == null) return -1

            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortDirection === SORT_ASC ? aVal - bVal : bVal - aVal
            }

            const aStr = String(aVal).toLowerCase()
            const bStr = String(bVal).toLowerCase()
            const cmp = aStr.localeCompare(bStr)
            return sortDirection === SORT_ASC ? cmp : -cmp
        })
    }, [filteredRows, sortKey, sortDirection, resolvedColumns])

    const handleSort = useCallback((key) => {
        if (sortKey !== key) {
            setSortKey(key)
            setSortDirection(SORT_ASC)
        } else if (sortDirection === SORT_ASC) {
            setSortDirection(SORT_DESC)
        } else {
            setSortKey(null)
            setSortDirection(null)
        }
    }, [sortKey, sortDirection])

    const handleExport = useCallback(async () => {
        if (exporting) return
        setExporting(true)
        try {
            const { wb } = await createWorkbook()
            const ws = wb.addWorksheet(title || 'Workbook')

            ws.columns = resolvedColumns.map((col) => ({
                header: col.header,
                key: col.key,
                width: Math.max(col.header.length + 4, 14)
            }))

            const headerRow = ws.getRow(1)
            headerRow.font = { bold: true, size: 11 }
            headerRow.fill = {
                fgColor: { argb: 'FFE8EDF2' },
                pattern: 'solid',
                type: 'pattern'
            }
            headerRow.alignment = { vertical: 'middle' }
            headerRow.height = 22

            for (const row of sortedRows) {
                const rowData = {}
                for (const col of resolvedColumns) {
                    rowData[col.key] = row.display[col.key] ?? ''
                }
                ws.addRow(rowData)
            }

            ws.autoFilter = {
                from: { column: 1, row: 1 },
                to: { column: resolvedColumns.length, row: 1 }
            }

            const dateStr = new Date().toISOString().slice(0, 10)
            await downloadWorkbook(wb, `${(title || 'Workbook').replace(/\s+/g, '_')}_${dateStr}.xlsx`)
        } catch (err) {
            console.error('Export failed:', err)
        } finally {
            setExporting(false)
        }
    }, [exporting, sortedRows, resolvedColumns, title])

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center p-12">
                <div className="flex flex-col items-center gap-3">
                    <i className="fas fa-spinner fa-spin text-2xl text-text-tertiary" />
                    <span className="text-[13px] text-text-secondary">Loading workbook data…</span>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 bg-bg-primary">
            <WorkbookToolbar
                accentColor={accentColor}
                exporting={exporting}
                onExport={handleExport}
                onSearch={setSearchQuery}
                rowCount={sortedRows.length}
                searchQuery={searchQuery}
                title={title || 'Workbook'}
            />
            <div
                ref={tableContainerRef}
                className="flex-1 overflow-auto min-h-0 border-b border-border-light"
            >
                <table className="w-max min-w-full border-collapse">
                    <thead className="sticky top-0 z-[2]">
                        <tr>
                            {resolvedColumns.map((col, idx) => (
                                <WorkbookHeaderCell
                                    key={col.key}
                                    column={col}
                                    onSort={handleSort}
                                    sortDirection={sortKey === col.key ? sortDirection : null}
                                    style={{ minWidth: col.minWidth || (idx === 0 ? 120 : 100) }}
                                />
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedRows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={resolvedColumns.length}
                                    className="px-6 py-12 text-center text-[13px] text-text-tertiary"
                                >
                                    {searchQuery ? 'No rows match your search.' : 'No data available.'}
                                </td>
                            </tr>
                        ) : (
                            sortedRows.map((row, rowIdx) => (
                                <tr
                                    key={row._raw.id || rowIdx}
                                    className={`border-b border-border-light transition-colors duration-75 hover:bg-accent/5 ${rowIdx % 2 === 0 ? 'bg-bg-primary' : 'bg-bg-secondary/40'}`}
                                >
                                    {resolvedColumns.map((col, colIdx) => (
                                        <WorkbookCell
                                            key={col.key}
                                            isFirstColumn={colIdx === 0}
                                            style={{ minWidth: col.minWidth || (colIdx === 0 ? 120 : 100) }}
                                        >
                                            {col.render
                                                ? col.render(row.display[col.key], row._raw, lookups)
                                                : row.display[col.key] ?? ''}
                                        </WorkbookCell>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
