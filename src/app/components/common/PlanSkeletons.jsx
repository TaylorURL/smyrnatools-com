/* eslint-disable max-lines, react/forbid-dom-props */
import React from 'react'

const Bar = ({ className = '', style }) => (
    <div className={`rounded animate-pulse ${className}`} style={{ background: 'var(--bg-tertiary)', ...style }} />
)

const SectionLabel = () => (
    <div className="flex items-center gap-2 mb-2">
        <Bar className="h-2.5 w-24" />
    </div>
)

const PanelShell = ({ children, title = true, className = '' }) => (
    <div className={`mb-3 ${className}`}>
        {title && <SectionLabel />}
        <div className="rounded overflow-hidden bg-bg-primary border border-border-light">{children}</div>
    </div>
)

const StatGroupSkeleton = ({ cols = 6 }) => (
    <div
        className="grid mb-3 rounded overflow-hidden bg-bg-primary border border-border-light"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
        {Array.from({ length: cols }).map((_, i) => (
            <div
                key={i}
                className="px-3 py-2.5 flex flex-col gap-1"
                style={{
                    borderRight: i < cols - 1 ? '1px solid var(--border-light)' : 'none'
                }}
            >
                <Bar className="h-2.5 w-16" />
                <Bar className="h-5 w-20 mt-1" />
            </div>
        ))}
    </div>
)

const TableHeaderRow = ({ widths }) => (
    <div className="flex items-center gap-3 px-3 py-2 bg-bg-secondary border-b border-border-light">
        {widths.map((w, i) => (
            <Bar key={i} className="h-2.5" style={{ width: w }} />
        ))}
    </div>
)

const TableBodyRows = ({ count = 8, widths }) =>
    Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2 border-b border-border-light">
            {widths.map((w, j) => (
                <Bar key={j} className="h-3" style={{ width: w }} />
            ))}
        </div>
    ))

export function DashboardSkeleton() {
    return (
        <div className="flex flex-1 min-h-0 overflow-hidden">
            <div className="hidden lg:block shrink-0 px-3 py-4 border-r border-border-light w-[200px]">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <Bar key={i} className="h-3 w-32 mb-3" />
                ))}
            </div>
            <div className="flex-1 overflow-auto px-4 py-4 min-w-0">
                <StatGroupSkeleton cols={6} />
                <PanelShell>
                    <div className="px-3 py-3">
                        <Bar className="h-3 w-1/2 mb-2" />
                        <Bar className="h-3 w-2/3 mb-2" />
                        <Bar className="h-3 w-1/3" />
                    </div>
                </PanelShell>
                <PanelShell>
                    <TableBodyRows count={5} widths={['18%', '24%', '14%', '18%', '14%', '12%']} />
                </PanelShell>
                <PanelShell>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-border-light">
                            <Bar className="h-2.5 w-10 shrink-0" />
                            <div className="flex-1 mx-2">
                                <Bar className="h-1.5 rounded-full w-full" />
                            </div>
                            <Bar className="h-2.5 w-12 shrink-0" />
                        </div>
                    ))}
                </PanelShell>
            </div>
            <div className="hidden xl:flex flex-col shrink-0 px-3 py-4 gap-3 border-l border-border-light w-60">
                <Bar className="h-3 w-28 mb-1" />
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-border-light">
                        <Bar className="h-2.5 w-20" />
                        <Bar className="h-3 w-12" />
                    </div>
                ))}
            </div>
        </div>
    )
}

export function ScheduleSkeleton() {
    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-auto px-4 py-3">
            <div className="flex items-center gap-3 mb-3">
                <Bar className="h-4 w-32" />
                <div className="flex-1" />
                <Bar className="h-7 w-24" />
                <Bar className="h-7 w-20" />
                <Bar className="h-7 w-24" />
            </div>
            <StatGroupSkeleton cols={6} />
            <PanelShell title={false}>
                <TableHeaderRow widths={['8%', '14%', '20%', '12%', '12%', '10%', '10%', '14%']} />
                <TableBodyRows count={10} widths={['8%', '14%', '20%', '12%', '12%', '10%', '10%', '14%']} />
            </PanelShell>
        </div>
    )
}

export function FlowSkeleton() {
    return (
        <div className="flex flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 relative bg-bg-secondary">
                <div className="absolute top-0 left-0 right-0 flex items-center gap-2 px-3 py-2 z-10 bg-bg-primary border-b border-border-light">
                    <Bar className="h-3 w-24" />
                    <div className="flex-1" />
                    <Bar className="h-6 w-16" />
                    <Bar className="h-6 w-16" />
                </div>
                <div className="absolute top-12 left-0 right-0 px-3 py-2 z-10 bg-bg-primary border-b border-border-light">
                    <Bar className="h-2 w-full rounded-full" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center pt-20">
                    <div className="grid grid-cols-3 gap-12">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div
                                key={i}
                                className="rounded-full animate-pulse bg-bg-tertiary"
                                style={{ height: 70 + (i % 3) * 12, width: 70 + (i % 3) * 12 }}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <div className="hidden lg:flex flex-col shrink-0 px-3 py-3 gap-3 bg-bg-primary border-l border-border-light w-[360px]">
                <Bar className="h-3 w-32" />
                <div className="rounded p-3 bg-bg-secondary border border-border-light">
                    <Bar className="h-3 w-1/2 mb-2" />
                    <Bar className="h-3 w-3/4 mb-2" />
                    <Bar className="h-3 w-2/3" />
                </div>
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="rounded p-2 border border-border-light">
                        <div className="flex items-center gap-2 mb-1.5">
                            <Bar className="h-3 w-12" />
                            <Bar className="h-3 w-3" />
                            <Bar className="h-3 w-12" />
                        </div>
                        <Bar className="h-2.5 w-2/3" />
                    </div>
                ))}
            </div>
        </div>
    )
}

export function DemandSkeleton() {
    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-auto px-4 py-3">
            <div className="flex items-center gap-3 mb-3">
                <Bar className="h-4 w-24" />
                <div className="flex-1" />
                <Bar className="h-7 w-32" />
                <Bar className="h-7 w-20" />
                <Bar className="h-7 w-24" />
            </div>
            <StatGroupSkeleton cols={8} />
            <PanelShell title={false}>
                <div className="px-3 py-2.5">
                    <Bar className="h-3 w-32 mb-2" />
                    <Bar className="h-3 w-full rounded-full" />
                    <div className="flex items-center gap-3 mt-2">
                        {[1, 2, 3].map((i) => (
                            <Bar key={i} className="h-2.5 w-16" />
                        ))}
                    </div>
                </div>
            </PanelShell>
            <div className="flex flex-wrap items-center gap-2 mb-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <Bar key={i} className="h-7 w-24" />
                ))}
            </div>
            <PanelShell title={false}>
                <div className="px-3 py-3 h-[360px]">
                    <div className="flex items-end gap-2 h-full">
                        {Array.from({ length: 14 }).map((_, i) => (
                            <Bar key={i} className="flex-1" style={{ height: `${30 + ((i * 13) % 60)}%` }} />
                        ))}
                    </div>
                </div>
            </PanelShell>
            <PanelShell title={false}>
                <TableHeaderRow widths={['12%', '12%', '14%', '12%', '12%', '12%', '14%', '12%']} />
                <TableBodyRows count={8} widths={['12%', '12%', '14%', '12%', '12%', '12%', '14%', '12%']} />
            </PanelShell>
        </div>
    )
}

/** Statistics tab — controls bar, KPI strip, horizontal section tabs, then a
 *  left rail + main content split that mirrors the real layout. Sub-pages
 *  expect a single panel + bar chart so the placeholder shows that shape. */
export function StatisticsSkeleton() {
    return (
        <div className="flex-1 min-h-0 overflow-auto px-3 sm:px-4 md:px-6 py-4 flex flex-col gap-4">
            <div className="flex items-center flex-wrap gap-2">
                <Bar className="h-7 w-24" />
                <Bar className="h-7 w-24" />
                <Bar className="h-7 w-32" />
                <div className="flex-1" />
                <Bar className="h-7 w-28" />
                <Bar className="h-7 w-24" />
            </div>
            <StatGroupSkeleton cols={6} />
            <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Bar key={i} className="h-7 w-28" />
                ))}
            </div>
            <div className="flex gap-4 items-start">
                <div className="hidden md:flex flex-col gap-2 shrink-0 rounded p-3 bg-bg-primary border border-border-light w-[200px]">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Bar key={i} className="h-3 w-32" />
                    ))}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-3">
                    <div className="flex items-baseline gap-2">
                        <Bar className="h-4 w-32" />
                        <Bar className="h-3 w-48" />
                    </div>
                    <PanelShell title={false} className="mb-0">
                        <div className="px-3 py-3 flex flex-col gap-2.5">
                            <Bar className="h-3 w-1/3" />
                            <Bar className="h-3 w-2/3" />
                            <Bar className="h-3 w-1/2" />
                        </div>
                    </PanelShell>
                    <PanelShell title={false} className="mb-0">
                        <div className="px-3 py-3 h-[280px]">
                            <div className="flex items-end gap-2 h-full">
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <Bar key={i} className="flex-1" style={{ height: `${30 + ((i * 17) % 60)}%` }} />
                                ))}
                            </div>
                        </div>
                    </PanelShell>
                    <PanelShell title={false} className="mb-0">
                        <TableHeaderRow widths={['20%', '15%', '15%', '15%', '20%', '15%']} />
                        <TableBodyRows count={6} widths={['20%', '15%', '15%', '15%', '20%', '15%']} />
                    </PanelShell>
                </div>
            </div>
        </div>
    )
}

/** Call List tab — 4-stat strip on top, 2-column body matching the real
 *  layout: left = dormant list (search + sort + rows), right = detail panel
 *  (header + KPI strip + 2x2 outcome grid + textarea + history). */
export function CallListSkeleton() {
    return (
        <div className="flex-1 min-h-0 flex flex-col gap-3 px-3 sm:px-4 lg:px-6 py-4 sm:py-5 overflow-hidden">
            <StatGroupSkeleton cols={4} />
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3">
                <section className="lg:col-span-5 flex flex-col gap-2 min-h-0">
                    <div className="flex items-center gap-2">
                        <Bar className="h-4 w-44" />
                        <div className="flex-1" />
                        <Bar className="h-6 w-20" />
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col rounded overflow-hidden bg-bg-primary border border-border-light">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-light">
                            <Bar className="h-7 flex-1" />
                            <Bar className="h-7 w-32" />
                        </div>
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-2.5 px-3 py-2 border-b border-border-light">
                                <div className="flex-1 min-w-0">
                                    <Bar className="h-3 w-2/3 mb-1.5" />
                                    <Bar className="h-2.5 w-1/2" />
                                </div>
                                <Bar className="h-5 w-12 rounded-full" />
                            </div>
                        ))}
                    </div>
                </section>
                <section className="lg:col-span-7 flex flex-col gap-2 min-h-0">
                    <div className="flex items-center gap-2">
                        <Bar className="h-4 w-20" />
                    </div>
                    <div className="flex-1 min-h-0 rounded flex flex-col bg-bg-primary border border-border-light">
                        <div className="px-4 py-2.5 border-b border-border-light">
                            <div className="flex items-center gap-2">
                                <Bar className="h-4 w-44" />
                                <div className="flex-1" />
                                <Bar className="h-3 w-32" />
                            </div>
                            <Bar className="h-3 w-32 mt-1.5" />
                        </div>
                        <div className="px-4 py-2 flex items-center gap-3 border-b border-border-light">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Bar key={i} className="h-3 w-20" />
                            ))}
                        </div>
                        <div className="px-4 py-3 flex flex-col gap-2.5 border-b border-border-light">
                            <div className="grid grid-cols-2 gap-2">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <Bar key={i} className="h-9" />
                                ))}
                            </div>
                            <Bar className="h-14 rounded-md" />
                            <div className="flex justify-end">
                                <Bar className="h-7 w-24" />
                            </div>
                        </div>
                        <div className="px-4 py-1.5 border-b border-border-light">
                            <Bar className="h-2.5 w-32" />
                        </div>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="px-3 py-2 flex flex-col gap-1.5 border-b border-border-light">
                                <div className="flex items-center gap-2">
                                    <Bar className="h-4 w-16 rounded-full" />
                                    <div className="flex-1" />
                                    <Bar className="h-2.5 w-24" />
                                </div>
                                <Bar className="h-2.5 w-3/4" />
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    )
}

export function PlanTabSkeleton({ mode }) {
    switch (mode) {
        case 'schedule':
            return <ScheduleSkeleton />
        case 'flow':
            return <FlowSkeleton />
        case 'demand':
            return <DemandSkeleton />
        case 'statistics':
            return <StatisticsSkeleton />
        case 'call-list':
            return <CallListSkeleton />
        case 'dashboard':
        default:
            return <DashboardSkeleton />
    }
}
