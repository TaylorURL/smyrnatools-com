/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtInt } from '../../../../utils/PlanStatisticsFormatUtility'

/** Compact operator chip used inside the spotlight callouts — name +
 *  badge + the headline number for the bucket. Whole chip is a button
 *  so clicking it filters the operator table to just this person. */
function SpotlightChip({ accent, onClick, primary, secondary, row }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={`Filter table to ${row.name}`}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-border-light bg-bg-primary text-[12px] text-left w-full hover:bg-bg-secondary transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none active:scale-[0.97]"
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-text-primary truncate">{row.name}</span>
                    {row.plantCode && (
                        <span
                            className="font-mono tabular-nums text-[10px] px-1 rounded shrink-0 text-text-primary"
                            style={{ background: `${accent}18` }}
                        >
                            {row.plantCode}
                        </span>
                    )}
                </div>
                {secondary && <div className="text-[10.5px] text-text-tertiary truncate">{secondary}</div>}
            </div>
            <span className="font-mono tabular-nums font-semibold shrink-0 text-text-primary">{primary}</span>
        </button>
    )
}

/** Spotlight column wrapper — colored header + scrollable chip list +
 *  empty fallback. Keeps the three callout panels visually balanced
 *  even when one of them has nothing to show. */
function SpotlightColumn({ accentColor, children, count, emptyMessage, hint, icon, title }) {
    return (
        <div className="flex flex-col gap-2 rounded border border-border-light bg-bg-primary p-3 min-h-0">
            <div className="flex items-center gap-2">
                <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full shrink-0"
                    style={{ background: `${accentColor}1a`, color: accentColor }}
                >
                    <i className={`fas ${icon} text-[12px]`} />
                </span>
                <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold text-text-primary truncate">{title}</div>
                    {hint && <div className="text-[10.5px] text-text-tertiary truncate">{hint}</div>}
                </div>
                <span className="font-mono tabular-nums text-[12.5px] font-bold shrink-0 text-text-primary">
                    {fmtInt(count)}
                </span>
            </div>
            {count === 0 ? (
                <div className="text-[11.5px] text-text-tertiary px-1 py-2">{emptyMessage}</div>
            ) : (
                <div className="flex flex-col gap-1.5">{children}</div>
            )}
        </div>
    )
}

export { SpotlightChip }
export default SpotlightColumn
