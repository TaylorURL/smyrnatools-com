/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { fmtInt } from '../../../../../utils/PlanStatisticsFormatUtility'
import CustomerCard from './customer-lookup/CustomerCard'
import CustomerDetail from './customer-lookup/CustomerDetail'
import { FILTERS, SORTS } from './customer-lookup/customerLookupShared'
import { CustomerCardGridSkeleton, CustomerDetailSkeleton } from './customer-lookup/CustomerLookupSkeletons'

export default function PlanStatisticsCustomerLookupPage({
    colocationMap,
    customerLookupLoading,
    loading,
    plansLoading,
    plantNameByCode,
    serviceStats
}) {
    const { customerIndex, orderVerdicts } = serviceStats
    const isLoading = !!(loading || customerLookupLoading || plansLoading)

    const [filterText, setFilterText] = useState('')
    const [filterKey, setFilterKey] = useState('all')
    const [sortKey, setSortKey] = useState('badJobs')
    const [selectedKey, setSelectedKey] = useState(null)
    const searchRef = useRef(null)
    const detailRef = useRef(null)

    useEffect(() => {
        searchRef.current?.focus()
    }, [])

    const ordersByCustomer = useMemo(() => {
        const map = new Map()
        for (const m of orderVerdicts) {
            if (!m.customerKey) continue
            if (!map.has(m.customerKey)) map.set(m.customerKey, [])
            map.get(m.customerKey).push(m)
        }
        return map
    }, [orderVerdicts])

    const visibleCustomers = useMemo(() => {
        const activeFilter = FILTERS.find((f) => f.key === filterKey) || FILTERS[0]
        const lower = filterText.trim().toLowerCase()
        let rows = activeFilter.test ? customerIndex.filter(activeFilter.test) : customerIndex
        if (lower) rows = rows.filter((c) => c.name.toLowerCase().includes(lower))
        rows = [...rows]
        switch (sortKey) {
            case 'jobs':
                rows.sort((a, b) => b.jobs - a.jobs || a.name.localeCompare(b.name))
                break
            case 'recent':
                rows.sort((a, b) => {
                    const ad = a.lastPourDate || ''
                    const bd = b.lastPourDate || ''
                    if (ad !== bd) return bd.localeCompare(ad)
                    return a.name.localeCompare(b.name)
                })
                break
            case 'goodPctAsc':
                rows.sort((a, b) => a.goodPct - b.goodPct || a.name.localeCompare(b.name))
                break
            case 'name':
                rows.sort((a, b) => a.name.localeCompare(b.name))
                break
            case 'badJobs':
            default:
                rows.sort((a, b) => b.badJobs - a.badJobs || a.goodPct - b.goodPct || a.name.localeCompare(b.name))
        }
        return rows
    }, [customerIndex, filterKey, filterText, sortKey])

    const selectedCustomer = useMemo(
        () => customerIndex.find((c) => c.key === selectedKey) || null,
        [customerIndex, selectedKey]
    )
    const selectedOrders = useMemo(
        () => (selectedKey ? ordersByCustomer.get(selectedKey) || [] : []),
        [ordersByCustomer, selectedKey]
    )

    useEffect(() => {
        if (selectedKey && detailRef.current) {
            detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }, [selectedKey])

    /* Mutually-exclusive views: selecting a customer hides the entire
     * search / filter row and the card grid, and replaces them with the
     * detail card. Closing the detail (or unselecting via the same row)
     * restores the list. Keeps the page focused on one thing at a time
     * and removes the awkward "scroll past the grid to find the detail
     * card" rhythm of the prior layout. */
    if (selectedCustomer) {
        return (
            <div className="flex flex-col gap-3" ref={detailRef}>
                {isLoading ? (
                    <CustomerDetailSkeleton />
                ) : (
                    <CustomerDetail
                        colocationMap={colocationMap}
                        customer={selectedCustomer}
                        onClose={() => setSelectedKey(null)}
                        orders={selectedOrders}
                        plantNameByCode={plantNameByCode}
                    />
                )}
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Search + sort */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-text-tertiary pointer-events-none" />
                    <input
                        ref={searchRef}
                        type="text"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        placeholder="Search customers"
                        disabled={isLoading}
                        className="w-full rounded pl-9 pr-3 py-2 text-[13px] outline-none bg-bg-primary border border-border-light text-text-primary placeholder:text-text-tertiary disabled:opacity-60"
                    />
                </div>
                <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value)}
                    disabled={isLoading}
                    className="rounded px-2.5 py-2 text-[12px] outline-none cursor-pointer bg-bg-primary border border-border-light text-text-primary disabled:opacity-60"
                >
                    {SORTS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Filter row + count */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                    {FILTERS.map((f) => {
                        const active = filterKey === f.key
                        return (
                            <button
                                key={f.key}
                                type="button"
                                onClick={() => setFilterKey(f.key)}
                                disabled={isLoading}
                                className="bg-transparent border-none cursor-pointer p-0 text-[12px] disabled:opacity-60"
                                style={{
                                    color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                    fontWeight: active ? 600 : 400,
                                    textDecoration: active ? 'underline' : 'none',
                                    textUnderlineOffset: '4px'
                                }}
                            >
                                {f.label}
                            </button>
                        )
                    })}
                </div>
                <div className="text-[11px] text-text-tertiary tabular-nums">
                    {isLoading ? (
                        <span className="italic">Loading customers…</span>
                    ) : (
                        <>
                            {fmtInt(visibleCustomers.length)} of {fmtInt(customerIndex.length)}
                        </>
                    )}
                </div>
            </div>

            {/* Customer card grid — replaced wholesale with a skeleton while
             *  the upstream query is still resolving. Showing the previous
             *  filter's data with a tiny "refreshing" label was misleading
             *  because the visible rows didn't reflect the active filter
             *  selection yet. */}
            {isLoading ? (
                <CustomerCardGridSkeleton />
            ) : customerIndex.length === 0 ? (
                <div className="text-[12px] py-8 text-center text-text-tertiary">
                    No customer activity in this window.
                </div>
            ) : visibleCustomers.length === 0 ? (
                <div className="text-[12px] py-8 text-center text-text-tertiary">
                    No matches. Clear the search or switch filters.
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {visibleCustomers.map((customer) => (
                        <CustomerCard
                            key={customer.key || customer.name}
                            customer={customer}
                            isActive={customer.key === selectedKey}
                            onSelect={(key) => setSelectedKey((current) => (current === key ? null : key))}
                            orders={ordersByCustomer.get(customer.key) || []}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
