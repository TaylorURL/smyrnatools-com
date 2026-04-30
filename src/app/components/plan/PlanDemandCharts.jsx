import React, { useMemo } from 'react'
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts'

import { PRODUCT_COLORS } from '../../../utils/PlanDemandUtility'
import { plantBadgeColor } from '../../../utils/PlanUtility'

/** Default daytime trim window — 06:00–18:00. Charts widen this when the
 *  plan extends earlier or later, so dispatchers see the full active span. */
const DAY_START_HOUR = 6
const DAY_END_HOUR = 18

const tooltipStyle = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-medium)',
    borderRadius: 8,
    color: 'var(--text-primary)'
}
const tooltipLabelStyle = { color: 'var(--text-secondary)' }

/** Trim hourly rows to the active span — if any hour has activity, expand
 *  out to whichever is wider: the daytime baseline or the active span. */
const useTrimmedHourlyRows = (rows, hasActivity) =>
    useMemo(() => {
        const firstActive = rows.findIndex(hasActivity)
        const lastActive = rows.length - 1 - [...rows].reverse().findIndex(hasActivity)
        if (firstActive === -1) return rows.slice(DAY_START_HOUR, DAY_END_HOUR + 1)
        const start = Math.min(firstActive, DAY_START_HOUR)
        const end = Math.max(lastActive, DAY_END_HOUR)
        return rows.slice(start, end + 1)
    }, [rows, hasActivity])

/** Empty-state placeholder used by every chart when the underlying data
 *  set has no rows worth charting. */
export function PlanDemandEmptyState() {
    return (
        <div
            className="flex flex-col items-center justify-center py-10 gap-2 text-center"
            style={{ color: 'var(--text-tertiary)' }}
        >
            <i className="fas fa-chart-column text-[28px] opacity-50" />
            <div className="text-[13px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                No demand to chart yet
            </div>
            <div className="text-[11.5px] max-w-[320px]">
                Once orders with truck counts land in the plan, demand charts for every plant will render here.
            </div>
        </div>
    )
}

export function HourlyTrucksLineChart({ accent, rows }) {
    const trimmed = useTrimmedHourlyRows(rows, (row) => row.total > 0)
    return (
        <div style={{ height: 320, width: '100%' }}>
            <ResponsiveContainer>
                <LineChart data={trimmed} margin={{ bottom: 4, left: 0, right: 12, top: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={11} />
                    <YAxis stroke="var(--text-secondary)" fontSize={11} allowDecimals={false} />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                        formatter={(val) => [`${val} trucks`, 'Active']}
                    />
                    <Line
                        type="monotone"
                        dataKey="total"
                        stroke={accent}
                        strokeWidth={2.5}
                        dot={{ fill: accent, r: 3 }}
                        activeDot={{ r: 5 }}
                        name="Trucks"
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

export function ByPlantBarChart({ accent, rows }) {
    return (
        <div style={{ height: 320, width: '100%' }}>
            <ResponsiveContainer>
                <BarChart data={rows} margin={{ bottom: 4, left: 0, right: 12, top: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="code" stroke="var(--text-secondary)" fontSize={11} />
                    <YAxis stroke="var(--text-secondary)" fontSize={11} allowDecimals={false} />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                        formatter={(val) => [`${val} trucks`, 'Required']}
                    />
                    <Bar dataKey="totalTrucks" fill={accent} radius={[6, 6, 0, 0]} name="Trucks">
                        {rows.map((row) => (
                            <Cell key={row.code} fill={plantBadgeColor(row.code, accent)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

export function StackedHourlyAreaChart({ plantColor, plants, rows }) {
    const hasAnyActivity = (row) => plants.some((plant) => (row[plant.code] || 0) > 0)
    const trimmed = useTrimmedHourlyRows(rows, hasAnyActivity)
    return (
        <div style={{ height: 360, width: '100%' }}>
            <ResponsiveContainer>
                <AreaChart data={trimmed} margin={{ bottom: 4, left: 0, right: 12, top: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={11} />
                    <YAxis stroke="var(--text-secondary)" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    {plants.map((plant) => (
                        <Area
                            key={plant.code}
                            type="monotone"
                            dataKey={plant.code}
                            name={plant.code}
                            stackId="plants"
                            stroke={plantColor[plant.code]}
                            fill={plantColor[plant.code]}
                            fillOpacity={0.6}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}

export function YardageSharePieChart({ plantColor, plants, total }) {
    const rows = useMemo(
        () =>
            plants
                .filter((plant) => plant.totalYardage > 0)
                .map((plant) => ({ code: plant.code, name: plant.code, value: Math.round(plant.totalYardage) })),
        [plants]
    )
    if (rows.length === 0) return <PlanDemandEmptyState />
    return (
        <div style={{ height: 360, width: '100%' }}>
            <ResponsiveContainer>
                <PieChart>
                    <Pie
                        data={rows}
                        dataKey="value"
                        nameKey="code"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={1}
                        label={({ code, percent }) => `${code} · ${(percent * 100).toFixed(0)}%`}
                    >
                        {rows.map((row) => (
                            <Cell key={row.code} fill={plantColor[row.code]} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(val, name) => [
                            `${val.toLocaleString()} yd (${total > 0 ? ((val / total) * 100).toFixed(1) : '0'}%)`,
                            name
                        ]}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    )
}

export function CumulativeYardageChart({ accent, rows }) {
    const trimmed = useMemo(() => {
        const firstActive = rows.findIndex((row) => row.yardage > 0)
        if (firstActive === -1) return rows.slice(DAY_START_HOUR, DAY_END_HOUR + 1)
        return rows.slice(Math.max(0, firstActive - 1))
    }, [rows])
    return (
        <div style={{ height: 320, width: '100%' }}>
            <ResponsiveContainer>
                <AreaChart data={trimmed} margin={{ bottom: 4, left: 0, right: 12, top: 12 }}>
                    <defs>
                        <linearGradient id="cumulative-grad" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={accent} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={11} />
                    <YAxis stroke="var(--text-secondary)" fontSize={11} />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                        formatter={(val) => [`${val.toLocaleString()} yd`, 'Running total']}
                    />
                    <Area
                        type="monotone"
                        dataKey="yardage"
                        name="Cumulative yardage"
                        stroke={accent}
                        strokeWidth={2.5}
                        fill="url(#cumulative-grad)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}

export function CapacityVsPeakChart({ accent, rows }) {
    if (rows.length === 0) return <PlanDemandEmptyState />
    return (
        <div style={{ height: 360, width: '100%' }}>
            <ResponsiveContainer>
                <BarChart data={rows} margin={{ bottom: 4, left: 0, right: 12, top: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={11} />
                    <YAxis stroke="var(--text-secondary)" fontSize={11} allowDecimals={false} />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                        formatter={(val, name) => [`${val} trucks`, name]}
                    />
                    <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="base" name="Assigned mixers" fill={accent} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="peak" name="Peak demand" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

const TOP_CUSTOMERS_LABEL_TRIM = 22
const TOP_CUSTOMERS_BASE_HEIGHT = 240
const TOP_CUSTOMERS_ROW_HEIGHT = 32

export function TopCustomersBarChart({ accent, rows }) {
    if (rows.length === 0) return <PlanDemandEmptyState />
    const height = Math.max(TOP_CUSTOMERS_BASE_HEIGHT, TOP_CUSTOMERS_ROW_HEIGHT * rows.length + 40)
    return (
        <div style={{ height, width: '100%' }}>
            <ResponsiveContainer>
                <BarChart data={rows} layout="vertical" margin={{ bottom: 4, left: 80, right: 20, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis type="number" stroke="var(--text-secondary)" fontSize={11} />
                    <YAxis
                        type="category"
                        dataKey="customer"
                        stroke="var(--text-secondary)"
                        fontSize={11}
                        width={160}
                        tickFormatter={(value) =>
                            value.length > TOP_CUSTOMERS_LABEL_TRIM
                                ? `${value.slice(0, TOP_CUSTOMERS_LABEL_TRIM)}…`
                                : value
                        }
                    />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                        formatter={(val) => [`${val.toLocaleString()} yd`, 'Yardage']}
                    />
                    <Bar dataKey="yardage" fill={accent} radius={[0, 6, 6, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

const PRODUCT_MIX_MAX_SLICES = 12
const PRODUCT_MIX_LABEL_THRESHOLD = 0.04

export function ProductMixPieChart({ rows, total }) {
    if (rows.length === 0) return <PlanDemandEmptyState />
    const data = rows.slice(0, PRODUCT_MIX_MAX_SLICES)
    return (
        <div style={{ height: 360, width: '100%' }}>
            <ResponsiveContainer>
                <PieChart>
                    <Pie
                        data={data}
                        dataKey="yardage"
                        nameKey="product"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={1}
                        label={({ product, percent }) =>
                            percent > PRODUCT_MIX_LABEL_THRESHOLD ? `${product} · ${(percent * 100).toFixed(0)}%` : ''
                        }
                    >
                        {data.map((row, i) => (
                            <Cell key={row.product} fill={PRODUCT_COLORS[i % PRODUCT_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(val, name) => [
                            `${val.toLocaleString()} yd (${total > 0 ? ((val / total) * 100).toFixed(1) : '0'}%)`,
                            name
                        ]}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    )
}
