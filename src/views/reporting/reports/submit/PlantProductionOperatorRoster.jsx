/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import { FORM_FIELD_BASE_CLASS, FORM_FIELD_STYLE } from './formStyles'

/**
 * Side menu for the Plant Efficiency report — the one place to manage WHO is
 * on the report and WHY anyone's off. Lists every active operator for the
 * plant with an include/exclude toggle; an excluded operator reveals an inline
 * reason field. Keeping this in a side rail lets the main column stay focused
 * on timing entry while exclusions + reasons live in a single, scannable list.
 *
 * @param {Object}   props
 * @param {string}   props.accentColor                    - Brand accent (checkbox tint).
 * @param {string}   [props.className]                    - Layout hook (e.g. sticky on lg).
 * @param {Array<{assigned_operator?: string, truck_number?: string}>} props.mixers
 * @param {(operatorId: string) => void} props.onExclude  - Remove the operator's row.
 * @param {(operatorId: string) => void} props.onInclude  - Add the operator's row back.
 * @param {(operatorId: string, reason: string) => void} props.onReasonChange
 * @param {Array<{value: string, label: string}>} props.operatorOptions
 * @param {boolean}  props.readOnly
 * @param {Object<string, string>} props.reasons          - operatorId → exclusion reason.
 * @param {Array<{name: string}>} props.rows              - Current (included) report rows.
 */
const PlantProductionOperatorRoster = ({
    accentColor,
    className = '',
    mixers,
    onExclude,
    onInclude,
    onReasonChange,
    operatorOptions,
    readOnly,
    reasons,
    rows
}) => {
    const includedIds = useMemo(() => new Set((rows || []).map((r) => r.name)), [rows])
    const truckByOperator = useMemo(() => {
        const map = new Map()
        for (const m of mixers || []) {
            if (m?.assigned_operator && m.truck_number) map.set(m.assigned_operator, m.truck_number)
        }
        return map
    }, [mixers])

    const total = operatorOptions?.length || 0
    const includedCount = (operatorOptions || []).reduce((n, opt) => n + (includedIds.has(opt.value) ? 1 : 0), 0)
    const excludedCount = total - includedCount

    return (
        <aside
            className={`flex flex-col gap-2 rounded-md p-2.5 bg-bg-secondary border border-border-light ${className}`}
            aria-label="Operator roster"
        >
            <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <i className="fas fa-user-group text-[11px] text-text-tertiary" aria-hidden="true" />
                    <span className="text-[12px] font-semibold text-text-primary">Operators</span>
                </div>
                <span className="text-[10.5px] text-text-tertiary tabular-nums shrink-0">
                    {includedCount} on report{excludedCount > 0 ? ` · ${excludedCount} off` : ''}
                </span>
            </div>

            <p className="m-0 text-[10.5px] leading-snug text-text-tertiary">
                Uncheck an operator to leave them off this report, then note why.
            </p>

            <div className="flex flex-col gap-1">
                {(operatorOptions || []).map((opt) => {
                    const operatorId = opt.value
                    const included = includedIds.has(operatorId)
                    const truck = truckByOperator.get(operatorId)
                    const reason = reasons?.[operatorId] || ''
                    const needsReason = !included && !reason.trim()
                    return (
                        <div
                            key={operatorId}
                            className="flex flex-col gap-1 rounded-md p-2 bg-bg-primary border border-border-light"
                            data-included={included}
                        >
                            <label className="flex items-center gap-2 min-h-[28px] cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={included}
                                    disabled={readOnly}
                                    onChange={() => (included ? onExclude(operatorId) : onInclude(operatorId))}
                                    aria-label={`${included ? 'Exclude' : 'Include'} ${opt.label}`}
                                    className="h-4 w-4 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                                    style={{ accentColor }}
                                />
                                <span className="min-w-0 flex-1">
                                    <span
                                        className={`block text-[12px] font-semibold truncate ${included ? 'text-text-primary' : 'text-text-tertiary line-through'}`}
                                    >
                                        {opt.label}
                                    </span>
                                    {truck && (
                                        <span className="block text-[10px] text-text-tertiary tabular-nums">
                                            Truck {truck}
                                        </span>
                                    )}
                                </span>
                                {needsReason && (
                                    <span
                                        className="h-2 w-2 rounded-sm shrink-0 bg-status-warning"
                                        title="Add a reason for excluding this operator"
                                        aria-hidden="true"
                                    />
                                )}
                            </label>
                            {!included && (
                                <input
                                    type="text"
                                    value={reason}
                                    onChange={(e) => onReasonChange(operatorId, e.target.value)}
                                    disabled={readOnly}
                                    placeholder="Reason for exclusion…"
                                    aria-label={`Exclusion reason for ${opt.label}`}
                                    className={FORM_FIELD_BASE_CLASS}
                                    style={FORM_FIELD_STYLE}
                                />
                            )}
                        </div>
                    )
                })}
            </div>
        </aside>
    )
}

export default PlantProductionOperatorRoster
