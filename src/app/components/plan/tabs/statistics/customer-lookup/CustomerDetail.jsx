import React, { useMemo } from 'react'

import { fmtDate, fmtInt } from '../../../../../../utils/PlanStatisticsFormatUtility'
import ScorePercent from '../ScorePercent'
import ServiceTierBreakdown from '../ServiceTierBreakdown'
import { fmtMinutes } from './customerLookupShared'
import CustomerOrdersTable from './CustomerOrdersTable'

function StatBlock({ label, sub, value }) {
    return (
        <div className="flex flex-col gap-0.5">
            <div className="text-[11px] text-text-tertiary">{label}</div>
            <div className="text-[18px] font-semibold tabular-nums leading-tight text-text-primary">{value}</div>
            {sub && <div className="text-[10.5px] text-text-tertiary">{sub}</div>}
        </div>
    )
}

export default function CustomerDetail({ colocationMap, customer, onClose, orders, plantNameByCode }) {
    const sortedOrders = useMemo(
        () =>
            [...orders].sort((a, b) => {
                if (a.date !== b.date) return b.date.localeCompare(a.date)
                return b.latenessMin - a.latenessMin
            }),
        [orders]
    )
    const lateAndSlow = orders.filter((m) => m.isLate && m.isSlow).length
    return (
        <div className="rounded-md p-4 bg-bg-primary border border-border-light">
            <div className="flex items-baseline justify-between gap-3 mb-4">
                <div className="min-w-0">
                    <h3 className="text-[17px] font-semibold m-0 truncate text-text-primary" title={customer.name}>
                        {customer.name || '(unnamed)'}
                    </h3>
                    <div className="text-[11.5px] text-text-tertiary tabular-nums mt-0.5">
                        {fmtInt(customer.jobs)} measured order{customer.jobs === 1 ? '' : 's'} in the active window
                        {customer.lastPourDate && <> · last pour {fmtDate(customer.lastPourDate)}</>}
                    </div>
                </div>
                <button type="button"
                    onClick={onClose}
                    className="text-[11.5px] text-text-secondary cursor-pointer bg-transparent border-none p-1 active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                    title="Clear selection"
                >
                    Close
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-5 pb-4 border-b border-border-light">
                <StatBlock
                    label="Good service"
                    value={<ScorePercent value={customer.goodPct} />}
                    sub={`${fmtInt(customer.goodJobs)} of ${fmtInt(customer.jobs)}`}
                />
                <StatBlock
                    label="Late"
                    value={fmtInt(customer.lateJobs)}
                    sub={
                        customer.lateJobs > 0
                            ? `Avg ${fmtMinutes(customer.avgLateMin)} · worst ${fmtMinutes(customer.worstLateMin)}`
                            : null
                    }
                />
                <StatBlock
                    label="Slow"
                    value={fmtInt(customer.slowJobs)}
                    sub={lateAndSlow > 0 ? `${fmtInt(lateAndSlow)} also late` : null}
                />
                <StatBlock label="Bad total" value={fmtInt(customer.badJobs)} />
            </div>

            {customer.tierCounts && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
                    <span className="font-semibold uppercase tracking-wider">Bad-service severity:</span>
                    <ServiceTierBreakdown tierCounts={customer.tierCounts} showZero />
                </div>
            )}

            <CustomerOrdersTable
                orders={sortedOrders}
                plantNameByCode={plantNameByCode}
                colocationMap={colocationMap}
            />
        </div>
    )
}
