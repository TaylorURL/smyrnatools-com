/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { fmtInt, fmtRange } from '../../../../../../utils/PlanStatisticsFormatUtility'
import { Panel } from '../../../../ui/Panel'
import { RankedList } from '../PlanStatisticsTables'
import { EmptySection, isEmptyAfterLoad, RefreshingHint } from './planStatsShared'

/* ──────────────────────────────────────────────────────────────────────────
 * Customers + products sub-page.
 * ────────────────────────────────────────────────────────────────────────── */

export function PlanStatisticsCustomersPage({
    accentColor,
    currentDays,
    currentSummary,
    loading,
    range,
    topCustomers,
    topProducts
}) {
    const isEmpty = isEmptyAfterLoad(loading, currentDays)
    if (loading && currentDays.length === 0) {
        return (
            <div className="flex flex-col gap-4 animate-pulse">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {[0, 1].map((i) => (
                        <div key={i} className="rounded bg-bg-secondary border border-border-light h-[260px]" />
                    ))}
                </div>
            </div>
        )
    }
    if (isEmpty) {
        return (
            <Panel title="Customers & products" innerClassName="p-0">
                <EmptySection
                    icon="fa-handshake"
                    message={`No saved schedules in ${fmtRange(range.start, range.end)}.`}
                />
            </Panel>
        )
    }
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <Panel
                title="Customer concentration"
                innerClassName="p-3"
                right={
                    loading ? (
                        <RefreshingHint when />
                    ) : currentSummary.topCustomerShare ? (
                        <span className="text-[11px] text-text-tertiary">
                            Top {(currentSummary.topCustomerShare.share * 100).toFixed(0)}%
                        </span>
                    ) : null
                }
            >
                {topCustomers.length === 0 ? (
                    <EmptySection
                        loading={loading}
                        message={loading ? 'Loading customers…' : 'No customer data in this window.'}
                    />
                ) : (
                    <RankedList
                        accent={accentColor}
                        emptyLabel="No customer data in this range."
                        items={topCustomers}
                        labelKey="customer"
                        secondaryFmt={(item) => `${item.orders} ord`}
                    />
                )}
            </Panel>
            <Panel title="Top product mixes" innerClassName="p-3" right={loading ? <RefreshingHint when /> : null}>
                {topProducts.length === 0 ? (
                    <EmptySection
                        loading={loading}
                        message={loading ? 'Loading products…' : 'No product data in this window.'}
                    />
                ) : (
                    <RankedList
                        accent={accentColor}
                        emptyLabel="No product data in this range."
                        items={topProducts}
                        labelKey="product"
                        secondaryFmt={(item) => `${fmtInt(item.loads)} loads`}
                    />
                )}
            </Panel>
        </div>
    )
}
