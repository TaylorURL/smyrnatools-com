import React from 'react'

const PULSE_BASE = 'animate-pulse'

function Block({ className = '', delay = 0, height, width = '100%' }) {
    return (
        <div
            className={`${PULSE_BASE} rounded ${className}`}
            style={{
                animationDelay: `${delay}ms`,
                animationFillMode: 'both',
                background: 'var(--bg-tertiary)',
                height,
                width
            }}
        />
    )
}

/** Flat panel chrome — title row + bordered body — matches the live layout. */
function PanelChrome({ children, titleWidth = 80, delay = 0 }) {
    return (
        <section className="flex flex-col gap-2">
            <Block delay={delay} height={14} width={titleWidth} />
            <div
                className="rounded p-3"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
            >
                {children}
            </div>
        </section>
    )
}

/** Flat-table skeleton — header row + N body rows. */
function TableChrome({ delay = 0, columns = 7, rows = 5 }) {
    return (
        <div className="rounded overflow-hidden" style={{ border: '1px solid var(--border-light)' }}>
            <div
                className="grid px-3 py-2"
                style={{
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-light)',
                    gridTemplateColumns: `1.5fr repeat(${columns - 1}, 1fr)`
                }}
            >
                {Array.from({ length: columns }, (_, i) => (
                    <Block key={i} delay={delay + i * 20} height={10} width="50%" />
                ))}
            </div>
            {Array.from({ length: rows }, (_, r) => (
                <div
                    key={r}
                    className="grid px-3 py-2.5"
                    style={{
                        background: 'var(--bg-primary)',
                        borderBottom: r < rows - 1 ? '1px solid var(--border-light)' : 'none',
                        gridTemplateColumns: `1.5fr repeat(${columns - 1}, 1fr)`
                    }}
                >
                    {Array.from({ length: columns }, (_, c) => (
                        <Block key={c} delay={delay + r * 60 + c * 20} height={12} width={c === 0 ? '70%' : '40%'} />
                    ))}
                </div>
            ))}
        </div>
    )
}

/** List skeleton — row with text on left, metric on right. Used for alerts. */
function ListChrome({ rows = 3, delay = 0 }) {
    return (
        <div className="flex flex-col">
            {Array.from({ length: rows }, (_, i) => (
                <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2.5"
                    style={{
                        borderBottom: i < rows - 1 ? '1px solid var(--border-light)' : 'none'
                    }}
                >
                    <Block delay={delay + i * 60} height={12} width="60%" />
                    <Block delay={delay + i * 60 + 30} height={12} width={48} />
                </div>
            ))}
        </div>
    )
}

/**
 * Loading placeholder — mirrors the live 3-column dashboard layout.
 * Renders skeletons for: alerts list, KPI strip, fleet table, and
 * the side-by-side operators / managers tables.
 */
export default function DashboardSkeleton({ isMobile }) {
    return (
        <div className="flex flex-col gap-3 sm:gap-5">
            <PanelChrome delay={0} titleWidth={70}>
                <ListChrome delay={40} rows={3} />
            </PanelChrome>

            <PanelChrome delay={140} titleWidth={64}>
                <TableChrome columns={isMobile ? 4 : 7} delay={180} rows={6} />
            </PanelChrome>

            <PanelChrome delay={380} titleWidth={70}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <Block delay={420} height={10} width={70} />
                        <TableChrome columns={2} delay={440} rows={5} />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Block delay={500} height={10} width={70} />
                        <TableChrome columns={2} delay={520} rows={4} />
                    </div>
                </div>
            </PanelChrome>
        </div>
    )
}
