import React from 'react'

const ALLOCATION_CLASSES = {
    high: 'allocation-pill-high',
    low: 'allocation-pill-low',
    medium: 'allocation-pill-medium'
}
const getAllocationClass = (percent) => {
    if (percent >= 80) return ALLOCATION_CLASSES.high
    if (percent >= 50) return ALLOCATION_CLASSES.medium
    return ALLOCATION_CLASSES.low
}

/** Small neutral pill for inline status labels (e.g. "Active 5"). Theme-aware. */
export function StatusPill({ children, className = '' }) {
    return (
        <span
            className={`inline-flex items-center rounded-full bg-bg-tertiary border border-border-light px-2.5 py-0.5 text-[11px] font-semibold text-text-secondary ${className}`}
        >
            {children}
        </span>
    )
}

/** Color-coded allocation percentage pill (green >= 80, yellow >= 50, red < 50). */
export function AllocationPill({ percent }) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${getAllocationClass(percent)}`}
        >
            <i className="fas fa-chart-pie mr-1 text-[9px] opacity-80" />
            {percent}% allocated
        </span>
    )
}

/**
 * Primary dashboard metric card. Displays a label, large value, optional icon,
 * optional subtitle, and a flex-wrap container for pill badges / breakdowns.
 */
export function MetricCard({
    label,
    value,
    subtitle,
    icon,
    iconColor,
    children,
    highlight = false,
    accentColor,
    className = ''
}) {
    const accent = iconColor || accentColor || 'var(--accent)'
    return (
        <div
            className={`metric-card group relative overflow-hidden rounded-xl p-4 md:p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${highlight ? 'metric-card-highlight' : ''} ${className}`}
            style={highlight ? { borderColor: accentColor } : undefined}
        >
            <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-0.5 opacity-60"
                style={{ background: `linear-gradient(90deg, ${accent} 0%, transparent 100%)` }}
            />
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                    <div className="text-[11px] md:text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
                        {label}
                    </div>
                    <div className="text-2xl md:text-[28px] leading-none font-bold text-text-primary tabular-nums">
                        {value}
                    </div>
                </div>
                {icon && (
                    <div
                        className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 ring-1 ring-inset transition-transform group-hover:scale-105"
                        style={{
                            backgroundColor: `${accent}14`,
                            color: accent,
                            boxShadow: `inset 0 0 0 1px ${accent}22`
                        }}
                    >
                        <i className={`fas ${icon} text-[17px]`} />
                    </div>
                )}
            </div>
            {subtitle && <div className="text-xs text-text-secondary mt-0.5 mb-1">{subtitle}</div>}
            {children && <div className="flex flex-wrap gap-1.5">{children}</div>}
        </div>
    )
}

/** Shimmer placeholder for generic card loading states. */
export function SkeletonCard() {
    return (
        <div className="rounded-xl p-6 bg-bg-primary border border-border-light animate-pulse">
            <div className="h-4 rounded w-2/5 mb-3 bg-bg-tertiary" />
            <div className="h-8 rounded w-3/5 mb-2 bg-bg-tertiary" />
            <div className="h-3 rounded w-1/3 bg-bg-tertiary" />
        </div>
    )
}

/** Shimmer placeholder for metric card loading states. */
export function SkeletonMetricCard() {
    return (
        <div className="rounded-xl p-4 md:p-5 bg-bg-tertiary border border-border-light animate-pulse">
            <div className="h-3.5 rounded w-3/5 mb-3 bg-bg-secondary" />
            <div className="h-8 rounded w-1/2 mb-2 bg-bg-secondary" />
            <div className="h-3 rounded w-2/5 bg-bg-secondary" />
        </div>
    )
}

/**
 * Rounded surface container for dashboard sections. Theme-aware and
 * supports optional `accent` strip on the top edge for visual hierarchy.
 */
export function DashboardCard({ children, className = '', accent }) {
    return (
        <div
            className={`relative bg-bg-primary border border-border-light rounded-2xl p-4 md:p-6 shadow-sm transition-shadow duration-200 hover:shadow-md ${className}`}
        >
            {accent && (
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-5 top-0 h-[2px] rounded-b-full"
                    style={{ background: `linear-gradient(90deg, ${accent}00 0%, ${accent} 50%, ${accent}00 100%)` }}
                />
            )}
            {children}
        </div>
    )
}

/**
 * Section heading used inside dashboard cards. Supports optional icon,
 * right-side action slot, and subtitle text for richer context.
 */
export function SectionTitle({ children, icon, action, subtitle, accentColor }) {
    return (
        <div className="flex items-start justify-between gap-3 mb-4 md:mb-5">
            <div className="flex items-center gap-2.5 min-w-0">
                {icon && (
                    <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
                        style={{
                            background: `${accentColor || 'var(--accent)'}15`,
                            color: accentColor || 'var(--accent)'
                        }}
                    >
                        <i className={`fas ${icon} text-xs`} />
                    </span>
                )}
                <div className="min-w-0">
                    <h3 className="text-base md:text-lg font-semibold text-text-primary m-0 truncate">{children}</h3>
                    {subtitle && <p className="text-xs text-text-secondary m-0 mt-0.5 truncate">{subtitle}</p>}
                </div>
            </div>
            {action && <div className="flex-shrink-0">{action}</div>}
        </div>
    )
}

const STATUS_TINT = {
    active: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    shop: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
    spare: 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400'
}

/** Shared grid of active/spare/shop counts per asset type. */
function TypeBreakdownGrid({ typeData, typeOrder, icons, columns, labelMap = {} }) {
    const types = typeOrder.filter((type) => typeData[type] && typeData[type].total > 0)
    if (types.length === 0) return null
    return (
        <div className="w-full border-t border-border-light mt-3 pt-3">
            <div className={`grid gap-2 ${columns}`}>
                {types.map((type) => {
                    const data = typeData[type]
                    return (
                        <div
                            key={type}
                            className="bg-bg-tertiary border border-border-light rounded-lg p-2 text-center"
                        >
                            <div className="flex items-center justify-center gap-1.5 mb-1.5">
                                <i className={`fas ${icons[type]} text-text-secondary text-[10px]`} />
                                <span className="text-text-secondary text-[11px] font-semibold uppercase tracking-wide">
                                    {labelMap[type] || type}
                                </span>
                            </div>
                            <div className="flex justify-center gap-1">
                                {['active', 'spare', 'shop'].map((status) => (
                                    <span
                                        key={status}
                                        className={`${STATUS_TINT[status]} rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums`}
                                    >
                                        {data[status]}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

const FREIGHT_ICONS = { Aggregate: 'fa-mountain', Cement: 'fa-industry', 'Dump Truck': 'fa-truck-loading' }
const TRAILER_ICONS = { Cement: 'fa-industry', 'End Dump': 'fa-truck-loading' }

/** Grid of active/spare/shop counts per freight type (Cement, Aggregate, Dump Truck). */
export function FreightTypeBreakdown({ freightData, isMobile }) {
    return (
        <TypeBreakdownGrid
            typeData={freightData}
            typeOrder={['Cement', 'Aggregate', 'Dump Truck']}
            icons={FREIGHT_ICONS}
            columns={isMobile ? 'grid-cols-2' : 'grid-cols-3'}
            labelMap={{ 'Dump Truck': 'Dump' }}
        />
    )
}

/** Grid of active/spare/shop counts per trailer type (Cement, End Dump). */
export function TrailerTypeBreakdown({ trailerTypeData, isMobile }) {
    return (
        <TypeBreakdownGrid
            typeData={trailerTypeData}
            typeOrder={['Cement', 'End Dump']}
            icons={TRAILER_ICONS}
            columns={isMobile ? 'grid-cols-1' : 'grid-cols-2'}
        />
    )
}
