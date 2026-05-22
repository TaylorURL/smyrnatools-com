/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useState } from 'react'

import OrderInfoModal from '../../../schedule/OrderInfoModal'
import OrderTicketsModal from '../../../schedule/OrderTicketsModal'

const norm = (value) => String(value || '').trim()

/** Walk every day's detail map looking for a ticket whose `ticketNum`
 *  matches the user's query. Returns the matching `{ planDate, detail,
 *  match }` triple on first hit — searching stops at the first match
 *  because ticket numbers are globally unique within Buzzsprout. */
function findTicket(detailByDay, query) {
    const q = norm(query)
    if (!q) return null
    for (const [planDate, byOrderId] of Object.entries(detailByDay || {})) {
        for (const detail of Object.values(byOrderId || {})) {
            const tickets = Array.isArray(detail?.tickets) ? detail.tickets : []
            const match = tickets.find((t) => norm(t?.ticketNum) === q)
            if (match) return { detail, match, planDate }
        }
    }
    return null
}

/**
 * Ticket Lookup page in the Statistics tab. Lets a dispatcher punch in a
 * dispatch ticket number, find the order it belongs to, and inspect the
 * same View-Order + View-Tickets surfaces that the Schedule tab's
 * right-click menu opens — but rendered inline within the page instead
 * of as floating modals. The matched ticket is highlighted in the table.
 *
 * Coverage / flag data isn't available for arbitrary historical orders
 * (those metrics require an active filtered schedule), so the inline
 * Order Info card gracefully degrades to "No coverage data" / "Nothing
 * flagged" in its Coverage and Flags tabs.
 */
export default function PlanStatisticsTicketLookupPage({
    accentColor = '#2563eb',
    detailByDay,
    flatOrders,
    loading,
    plantNameByCode
}) {
    const [query, setQuery] = useState('')
    const [submittedQuery, setSubmittedQuery] = useState('')

    /** Index orders by `orderId` once per data refresh so each lookup
     *  is O(1) instead of re-scanning `flatOrders` every keystroke. */
    const orderById = useMemo(() => {
        const map = new Map()
        for (const entry of flatOrders || []) {
            const orderId = entry?.order?.orderId
            if (orderId) map.set(orderId, entry)
        }
        return map
    }, [flatOrders])

    const result = useMemo(() => {
        const hit = findTicket(detailByDay, submittedQuery)
        if (!hit) return null
        const orderEntry = orderById.get(hit.detail?.orderId)
        return {
            detail: hit.detail,
            match: hit.match,
            order: orderEntry?.order || null,
            planDate: hit.planDate,
            plantCode: orderEntry?.plantCode || orderEntry?.order?.plantCode || ''
        }
    }, [detailByDay, orderById, submittedQuery])

    /** Auto-submit after a brief debounce so the result updates while the
     *  user types without re-scanning detail maps on every keystroke. */
    useEffect(() => {
        const trimmed = norm(query)
        if (!trimmed) {
            setSubmittedQuery('')
            return undefined
        }
        const id = window.setTimeout(() => setSubmittedQuery(trimmed), 250)
        return () => window.clearTimeout(id)
    }, [query])

    const onSubmit = (e) => {
        e.preventDefault()
        setSubmittedQuery(norm(query))
    }

    return (
        <div className="flex flex-col gap-4">
            <form
                onSubmit={onSubmit}
                className="flex items-center gap-2 rounded-lg border border-border-light bg-bg-primary px-3 py-2"
            >
                <i className="fas fa-receipt text-[12px] text-text-tertiary" />
                <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by ticket number"
                    aria-label="Ticket number"
                    className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[13px] font-mono tabular-nums text-text-primary"
                    autoFocus
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="text-[11px] text-text-tertiary hover:text-text-primary border-0 bg-transparent cursor-pointer"
                        aria-label="Clear"
                    >
                        Clear
                    </button>
                )}
            </form>

            {!submittedQuery && (
                <div className="rounded-lg border border-border-light bg-bg-primary px-4 py-10 text-center">
                    <div className="text-[13px] font-semibold text-text-secondary">
                        Enter a ticket number to look it up.
                    </div>
                    <div className="text-[12px] text-text-tertiary mt-1 leading-snug max-w-md mx-auto">
                        Matches load tickets across every plant in the active date window. The order it belongs to will
                        open here, with the ticket highlighted in the load list.
                    </div>
                </div>
            )}

            {submittedQuery && loading && !result && (
                <div className="rounded-lg border border-border-light bg-bg-primary px-4 py-6 text-[12px] text-text-tertiary text-center">
                    Searching…
                </div>
            )}

            {submittedQuery && !loading && !result && (
                <div className="rounded-lg border border-border-light bg-bg-primary px-4 py-8 text-center">
                    <div className="text-[13px] font-semibold text-text-secondary">
                        No ticket matches “{submittedQuery}”.
                    </div>
                    <div className="text-[12px] text-text-tertiary mt-1 leading-snug max-w-md mx-auto">
                        Try widening the date range in the controls bar — only tickets from the active window are
                        searchable.
                    </div>
                </div>
            )}

            {result?.order && (
                <>
                    <OrderInfoModal
                        accentColor={accentColor}
                        coverage={null}
                        inline
                        order={result.order}
                        plantName={plantNameByCode?.[result.plantCode]}
                        ticketCount={Array.isArray(result.detail?.tickets) ? result.detail.tickets.length : 0}
                    />
                    <OrderTicketsModal
                        accentColor={accentColor}
                        detail={result.detail}
                        highlightedTicketNum={submittedQuery}
                        inline
                        order={result.order}
                        plantNameByCode={plantNameByCode}
                    />
                </>
            )}

            {result && !result.order && (
                <div className="rounded-lg border border-border-light bg-bg-primary px-4 py-6 text-[12px] text-text-tertiary leading-snug">
                    Found ticket “{submittedQuery}” in plan <span className="font-mono">{result.planDate}</span>, but
                    the matching order isn’t in the active schedule cache. Open the day’s schedule directly to see full
                    details.
                </div>
            )}
        </div>
    )
}
