import React from 'react'

/**
 * Expandable/collapsible table with a toggle header. Theme-aware surfaces.
 * Shows "None" placeholder when rows are empty and expanded.
 * @param {Object} props
 * @param {string} props.title - Header label with optional count.
 * @param {boolean} props.collapsed - Controls the collapsed state.
 * @param {Function} props.onToggle - Toggles collapse.
 * @param {boolean} props.disabled - Disables the toggle button.
 * @param {string[]} props.headers - Column header labels.
 * @param {Array} props.rows - Data rows to render.
 * @param {Function} props.renderRow - Returns an array of cell values for a row.
 * @param {string} [props.accentColor='#1e3a5f'] - Toggle button text color.
 */
export function CollapsibleTable({
    title,
    collapsed,
    onToggle,
    disabled,
    headers,
    rows,
    renderRow,
    accentColor = '#1e3a5f'
}) {
    return (
        <div className="border border-border-light rounded-lg mb-3 overflow-hidden bg-bg-primary">
            <div
                className={`flex items-center justify-between px-4 py-3 bg-bg-tertiary ${!collapsed ? 'border-b border-border-light' : ''}`}
            >
                <span className="text-sm font-semibold text-text-primary">{title}</span>
                <button
                    type="button"
                    onClick={onToggle}
                    disabled={disabled}
                    className={`text-xs font-semibold rounded-md px-2.5 py-1 border transition ${disabled ? 'cursor-default opacity-50' : 'cursor-pointer hover:brightness-95'}`}
                    style={{
                        background: disabled ? 'transparent' : `${accentColor}14`,
                        borderColor: disabled ? 'var(--border-light)' : `${accentColor}30`,
                        color: disabled ? 'var(--text-secondary)' : accentColor
                    }}
                >
                    <i className={`fas ${collapsed ? 'fa-chevron-down' : 'fa-chevron-up'} text-[10px] mr-1`} />
                    {collapsed ? 'Expand' : 'Collapse'}
                </button>
            </div>
            {!collapsed &&
                (rows.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-bg-secondary">
                                    {headers.map((header, idx) => (
                                        <th
                                            key={idx}
                                            className="px-2 py-2 md:px-4 md:py-3 text-left text-[10px] md:text-xs font-semibold uppercase tracking-wider text-text-secondary border-b border-border-light"
                                        >
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, idx) => (
                                    <tr
                                        key={row.id || idx}
                                        className="border-b border-border-light last:border-b-0 hover:bg-bg-tertiary transition-colors"
                                    >
                                        {renderRow(row).map((cell, cellIdx) => (
                                            <td
                                                key={cellIdx}
                                                className="px-2 py-2 md:px-4 md:py-3 text-xs md:text-sm text-text-primary"
                                            >
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-5 text-text-secondary text-sm">None</div>
                ))}
        </div>
    )
}
