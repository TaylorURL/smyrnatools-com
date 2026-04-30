import React from 'react'

import { formatMinutesClock, formatRelativeMinutes } from '../../../utils/PlanRuntimeUtility'
import { PlantPill } from './PlantPill'

const TABLE_HEADER_STYLE = {
    background: 'var(--bg-tertiary)',
    borderBottom: '1px solid var(--border-light)',
    color: 'var(--text-secondary)'
}

/** Header row builder shared across the realtime tables. Cells default
 *  to left-aligned; pass `align: 'right'` per cell if needed. */
function TableHeader({ headers }) {
    return (
        <thead>
            <tr>
                {headers.map((header) => (
                    <th
                        key={header.label || header}
                        className={`px-3 py-2 text-${header.align || 'left'} font-bold uppercase tracking-wider text-[10.5px] whitespace-nowrap`}
                        style={TABLE_HEADER_STYLE}
                    >
                        {header.label || header}
                    </th>
                ))}
            </tr>
        </thead>
    )
}

/** Orders that should be loading more yards by now than the bridge has
 *  recorded. */
export function PlanRealtimeRunningBehindTable({ accentColor, nowMin, plantNameByCode, rows }) {
    return (
        <div className="overflow-auto">
            <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
                <TableHeader headers={['Plant', 'Order', 'Customer', 'Started', 'Loaded', 'Expected', 'Behind']} />
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.orderKey} style={{ borderTop: '1px solid var(--border-light)' }}>
                            <td className="px-3 py-2 whitespace-nowrap">
                                <PlantPill
                                    accentColor={accentColor}
                                    code={row.plantCode}
                                    name={plantNameByCode?.[row.plantCode] || ''}
                                />
                            </td>
                            <td
                                className="px-3 py-2 whitespace-nowrap font-semibold"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                {row.orderNum ? `#${row.orderNum}` : '—'}
                            </td>
                            <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                                {row.customer || '—'}
                            </td>
                            <td
                                className="px-3 py-2 font-mono whitespace-nowrap"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                {formatMinutesClock(row.startMin)}{' '}
                                <span style={{ color: 'var(--text-tertiary)' }}>
                                    ({formatRelativeMinutes(nowMin - row.startMin)} ago)
                                </span>
                            </td>
                            <td
                                className="px-3 py-2 font-mono text-right whitespace-nowrap"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                <span className="font-bold">
                                    {Number.isInteger(row.loaded) ? row.loaded : row.loaded.toFixed(1)}
                                </span>
                                <span style={{ color: 'var(--text-tertiary)' }}> / {row.total}</span>
                            </td>
                            <td
                                className="px-3 py-2 font-mono text-right whitespace-nowrap"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                {row.expected.toFixed(1)}
                            </td>
                            <td
                                className="px-3 py-2 font-mono font-bold text-right whitespace-nowrap"
                                style={{ color: '#dc2626' }}
                            >
                                {row.behindMinutes}m
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

/** Scheduled orders for which no truck has loaded a ticket yet — pours
 *  the dispatcher needs to follow up on. */
export function PlanRealtimeNotStartedTable({ accentColor, nowMin, plantNameByCode, rows }) {
    return (
        <div className="overflow-auto">
            <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
                <TableHeader headers={['Plant', 'Order', 'Customer', 'Scheduled start', 'Yards', 'Trucks']} />
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.orderKey} style={{ borderTop: '1px solid var(--border-light)' }}>
                            <td className="px-3 py-2 whitespace-nowrap">
                                <PlantPill
                                    accentColor={accentColor}
                                    code={row.plantCode}
                                    name={plantNameByCode?.[row.plantCode] || ''}
                                />
                            </td>
                            <td
                                className="px-3 py-2 whitespace-nowrap font-semibold"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                {row.orderNum ? `#${row.orderNum}` : '—'}
                            </td>
                            <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                                {row.customer || '—'}
                            </td>
                            <td
                                className="px-3 py-2 font-mono whitespace-nowrap"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                {formatMinutesClock(row.startMin)}{' '}
                                <span style={{ color: '#d97706' }}>
                                    ({formatRelativeMinutes(nowMin - row.startMin)} ago)
                                </span>
                            </td>
                            <td
                                className="px-3 py-2 font-mono text-right whitespace-nowrap"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                {row.yardage || '—'}
                            </td>
                            <td
                                className="px-3 py-2 font-mono text-right whitespace-nowrap"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                {row.truckCount || '—'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

/** Currently active pours — start time, plant, customer, yards/trucks,
 *  progress bar and ETA. */
export function PlanRealtimeActivePoursTable({ accentColor, nowMin, orders, plantNameByCode }) {
    return (
        <div className="overflow-auto">
            <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
                <TableHeader headers={['Start', 'Plant', 'Customer', 'Yards', 'Trucks', 'Progress', 'Wraps']} />
                <tbody>
                    {orders.map((order) => {
                        const eta = order.endMin - nowMin
                        const pct = Math.round(order.progress)
                        const progressColor = pct < 33 ? '#0ea5e9' : pct < 66 ? '#d97706' : '#16a34a'
                        return (
                            <tr key={order.orderKey} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                <td
                                    className="px-3 py-2 font-mono font-bold whitespace-nowrap"
                                    style={{ color: accentColor }}
                                >
                                    {formatMinutesClock(order.startMin)}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    <PlantPill
                                        accentColor={accentColor}
                                        code={order.plantCode}
                                        name={plantNameByCode?.[order.plantCode]}
                                    />
                                </td>
                                <td
                                    className="px-3 py-2 max-w-[260px] truncate font-semibold"
                                    style={{ color: 'var(--text-primary)' }}
                                    title={order.customer || ''}
                                >
                                    {order.customer || '—'}
                                </td>
                                <td
                                    className="px-3 py-2 text-right font-mono font-bold whitespace-nowrap tabular-nums"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    {order.yardage > 0 ? order.yardage : '—'}
                                </td>
                                <td
                                    className="px-3 py-2 text-right font-mono whitespace-nowrap tabular-nums"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    {order.truckCount > 0 ? order.truckCount : '—'}
                                </td>
                                <td className="px-3 py-2 min-w-[140px]">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="flex-1 h-1.5 overflow-hidden"
                                            style={{ background: 'var(--bg-tertiary)', borderRadius: 2 }}
                                        >
                                            <div
                                                className="h-full"
                                                style={{ background: progressColor, width: `${pct}%` }}
                                            />
                                        </div>
                                        <span
                                            className="font-mono font-bold tabular-nums w-9 text-right"
                                            style={{ color: 'var(--text-primary)', fontSize: 11 }}
                                        >
                                            {pct}%
                                        </span>
                                    </div>
                                </td>
                                <td
                                    className="px-3 py-2 text-right font-mono whitespace-nowrap tabular-nums"
                                    style={{ color: '#16a34a', fontWeight: 600 }}
                                >
                                    {formatMinutesClock(order.endMin)}{' '}
                                    <span style={{ color: 'var(--text-tertiary)' }}>{formatRelativeMinutes(eta)}</span>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

/** Per-plant capacity snapshot — colored status dot, free trucks, dispatched,
 *  active pour count, and next-up scheduled time. */
export function PlanRealtimeCapacityTable({ accentColor, nowMin, plantNameByCode, snapshots }) {
    return (
        <div className="overflow-auto">
            <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
                <TableHeader
                    headers={[
                        { align: 'left', label: 'Plant' },
                        { align: 'right', label: 'Free' },
                        { align: 'right', label: 'Out' },
                        { align: 'right', label: 'Active' },
                        { align: 'right', label: 'Next' }
                    ]}
                />
                <tbody>
                    {snapshots.map((snapshot) => {
                        const { nextOrder } = snapshot
                        const eta = nextOrder ? nextOrder.startMin - nowMin : null
                        return (
                            <tr key={snapshot.code} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-2">
                                        <span
                                            className="inline-block w-2 h-2 rounded-full"
                                            style={{ background: snapshot.statusColor }}
                                        />
                                        <PlantPill
                                            accentColor={accentColor}
                                            code={snapshot.code}
                                            name={plantNameByCode?.[snapshot.code]}
                                        />
                                    </span>
                                </td>
                                <td
                                    className="px-3 py-2 text-right font-mono font-bold whitespace-nowrap tabular-nums"
                                    style={{ color: snapshot.statusColor, fontSize: 14 }}
                                >
                                    {snapshot.poolNow != null ? snapshot.poolNow : '—'}
                                </td>
                                <td
                                    className="px-3 py-2 text-right font-mono whitespace-nowrap tabular-nums"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    {snapshot.dispatched}
                                </td>
                                <td
                                    className="px-3 py-2 text-right font-mono whitespace-nowrap tabular-nums"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    {snapshot.poolingNow.length}
                                </td>
                                <td
                                    className="px-3 py-2 text-right font-mono whitespace-nowrap tabular-nums"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    {nextOrder ? (
                                        <>
                                            {formatMinutesClock(nextOrder.startMin)}{' '}
                                            <span style={{ color: 'var(--text-tertiary)' }}>
                                                {formatRelativeMinutes(eta)}
                                            </span>
                                        </>
                                    ) : (
                                        <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

/** Upcoming-event stream — start, wrap, help, and clock-out events for
 *  the next 90 minutes. */
export function PlanRealtimeUpcomingStream({ accentColor, events, nowMin, plantNameByCode }) {
    return (
        <div className="flex flex-col">
            {events.map((event) => {
                const eta = event.time - nowMin
                return (
                    <div
                        key={event.id}
                        className="px-3 py-2 flex items-baseline gap-3 text-[12.5px]"
                        style={{ borderBottom: '1px solid var(--border-light)' }}
                    >
                        <span
                            className="font-mono tabular-nums font-bold whitespace-nowrap"
                            style={{ color: event.color, minWidth: 48 }}
                        >
                            {formatMinutesClock(event.time)}
                        </span>
                        <span
                            className="font-semibold whitespace-nowrap"
                            style={{ color: 'var(--text-primary)', minWidth: 60 }}
                        >
                            {event.kind}
                        </span>
                        {event.plantCode && (
                            <PlantPill
                                accentColor={accentColor}
                                code={event.plantCode}
                                name={plantNameByCode?.[event.plantCode]}
                            />
                        )}
                        <span
                            className="truncate flex-1"
                            style={{ color: 'var(--text-secondary)' }}
                            title={event.detail}
                        >
                            {event.detail}
                        </span>
                        <span
                            className="font-mono tabular-nums whitespace-nowrap"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            {formatRelativeMinutes(eta)}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}
