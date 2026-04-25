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
        <div
            className="rounded overflow-hidden"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            {children}
        </div>
    </div>
)

const StatGroupSkeleton = ({ cols = 6 }) => (
    <div
        className="grid mb-3 rounded overflow-hidden"
        style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-light)',
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`
        }}
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
    <div
        className="flex items-center gap-3 px-3 py-2"
        style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)' }}
    >
        {widths.map((w, i) => (
            <Bar key={i} className="h-2.5" style={{ width: w }} />
        ))}
    </div>
)

const TableBodyRows = ({ count = 8, widths }) =>
    Array.from({ length: count }).map((_, i) => (
        <div
            key={i}
            className="flex items-center gap-3 px-3 py-2"
            style={{ borderBottom: '1px solid var(--border-light)' }}
        >
            {widths.map((w, j) => (
                <Bar key={j} className="h-3" style={{ width: w }} />
            ))}
        </div>
    ))

export function DashboardSkeleton() {
    return (
        <div className="flex flex-1 min-h-0 overflow-hidden">
            <div
                className="hidden lg:block shrink-0 px-3 py-4"
                style={{ borderRight: '1px solid var(--border-light)', width: 200 }}
            >
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
                        <div
                            key={i}
                            className="flex items-center gap-2 px-3 py-2"
                            style={{ borderBottom: '1px solid var(--border-light)' }}
                        >
                            <Bar className="h-2.5 w-10 shrink-0" />
                            <div className="flex-1 mx-2">
                                <Bar className="h-1.5 rounded-full w-full" />
                            </div>
                            <Bar className="h-2.5 w-12 shrink-0" />
                        </div>
                    ))}
                </PanelShell>
            </div>
            <div
                className="hidden xl:flex flex-col shrink-0 px-3 py-4 gap-3"
                style={{ borderLeft: '1px solid var(--border-light)', width: 240 }}
            >
                <Bar className="h-3 w-28 mb-1" />
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div
                        key={i}
                        className="flex items-center justify-between py-1.5"
                        style={{ borderBottom: '1px solid var(--border-light)' }}
                    >
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
            <div className="flex-1 relative" style={{ background: 'var(--bg-secondary)' }}>
                <div
                    className="absolute top-0 left-0 right-0 flex items-center gap-2 px-3 py-2 z-10"
                    style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-light)' }}
                >
                    <Bar className="h-3 w-24" />
                    <div className="flex-1" />
                    <Bar className="h-6 w-16" />
                    <Bar className="h-6 w-16" />
                </div>
                <div
                    className="absolute top-12 left-0 right-0 px-3 py-2 z-10"
                    style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-light)' }}
                >
                    <Bar className="h-2 w-full rounded-full" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center pt-20">
                    <div className="grid grid-cols-3 gap-12">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div
                                key={i}
                                className="rounded-full animate-pulse"
                                style={{
                                    background: 'var(--bg-tertiary)',
                                    height: 70 + (i % 3) * 12,
                                    width: 70 + (i % 3) * 12
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <div
                className="hidden lg:flex flex-col shrink-0 px-3 py-3 gap-3"
                style={{ background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-light)', width: 360 }}
            >
                <Bar className="h-3 w-32" />
                <div
                    className="rounded p-3"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                >
                    <Bar className="h-3 w-1/2 mb-2" />
                    <Bar className="h-3 w-3/4 mb-2" />
                    <Bar className="h-3 w-2/3" />
                </div>
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="rounded p-2" style={{ border: '1px solid var(--border-light)' }}>
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
                <div className="px-3 py-3" style={{ height: 360 }}>
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

export function RealtimeSkeleton() {
    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-auto px-4 py-3">
            <div className="flex items-center gap-3 mb-3">
                <Bar className="h-4 w-24" />
                <Bar className="h-3 w-20" />
                <Bar className="h-3 w-24" />
                <div className="flex-1" />
                <Bar className="h-7 w-28" />
                <Bar className="h-7 w-24" />
            </div>
            <StatGroupSkeleton cols={6} />
            <PanelShell>
                <TableHeaderRow widths={['10%', '10%', '24%', '10%', '10%', '24%', '12%']} />
                <TableBodyRows count={6} widths={['10%', '10%', '24%', '10%', '10%', '24%', '12%']} />
            </PanelShell>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2">
                    <PanelShell>
                        <TableHeaderRow widths={['18%', '14%', '14%', '14%', '20%']} />
                        <TableBodyRows count={6} widths={['18%', '14%', '14%', '14%', '20%']} />
                    </PanelShell>
                </div>
                <PanelShell>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-2 px-3 py-2"
                            style={{ borderBottom: '1px solid var(--border-light)' }}
                        >
                            <Bar className="h-2.5 w-10 shrink-0" />
                            <Bar className="h-2.5 w-14 shrink-0" />
                            <div className="flex-1">
                                <Bar className="h-2.5 w-3/4" />
                            </div>
                            <Bar className="h-2.5 w-10 shrink-0" />
                        </div>
                    ))}
                </PanelShell>
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
        case 'realtime':
            return <RealtimeSkeleton />
        case 'dashboard':
        default:
            return <DashboardSkeleton />
    }
}
