import React from 'react'

/** Maps asset type labels to their corresponding embedded view route keys. */
export const getAssetViewType = (assetType) => {
    const viewMap = { Equipment: 'equipment', Mixer: 'mixers', Tractor: 'tractors', Trailer: 'trailers' }
    return viewMap[assetType] || 'equipment'
}

/** Skeleton pulse block — generic loading placeholder with configurable size. */
export const Skeleton = ({ className = '', style }) => (
    <div className={`bg-bg-tertiary rounded-lg animate-pulse ${className}`} style={style} />
)

/**
 * Compact KPI tile displaying a label, value, optional icon, and dynamic color.
 * Minimum width grows so tiles read as confident cards rather than pill tags.
 */
export const MetricPill = ({ label, value, color, icon, accentColor, suffix }) => {
    const tint = color || accentColor || 'var(--accent)'
    return (
        <div
            className="relative flex items-center gap-3 bg-bg-primary rounded-xl border border-border-light px-4 py-3 min-w-[150px] flex-1 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            style={{ animation: 'fadeSlideIn 0.3s ease both' }}
        >
            <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
                style={{ background: `linear-gradient(180deg, ${tint} 0%, ${tint}40 100%)` }}
            />
            {icon && (
                <div
                    className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 ring-1 ring-inset"
                    style={{ background: `${tint}14`, boxShadow: `inset 0 0 0 1px ${tint}20` }}
                >
                    <i className={`fas ${icon} text-[13px]`} style={{ color: tint }} />
                </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">{label}</span>
                <span className="text-xl font-bold leading-tight tabular-nums" style={{ color: tint }}>
                    {value}
                    {suffix && <span className="text-[11px] font-medium text-text-secondary ml-1">{suffix}</span>}
                </span>
            </div>
        </div>
    )
}

/** Clickable pill button for navigating to an asset in an embedded view. */
export const AssetPill = ({ label, onClick, color }) => (
    <button
        onClick={onClick}
        className="rounded-full text-[11px] font-semibold px-2.5 py-1 cursor-pointer transition-all hover:brightness-95 active:scale-[0.97] border"
        style={{ background: `${color}14`, color, borderColor: `${color}30` }}
    >
        {label}
    </button>
)

/**
 * Tinted notification row with expand/collapse for overflow items.
 * Groups related alerts under a colored icon header with a count badge.
 */
export const NotificationRow = ({
    icon,
    iconColor,
    title,
    count,
    items,
    renderItem,
    maxItems = 3,
    expandKey,
    expandedSections,
    setExpandedSections
}) => {
    const isExpanded = expandedSections?.[expandKey]
    const displayItems = isExpanded ? items : items.slice(0, maxItems)
    const hasMore = items.length > maxItems
    return (
        <div
            className="rounded-xl px-3 py-2.5 mb-1.5 border"
            style={{
                animation: 'fadeSlideIn 0.3s ease both',
                background: `${iconColor}0a`,
                borderColor: `${iconColor}22`
            }}
        >
            <div className="flex items-center gap-2.5 mb-1.5">
                <div
                    className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 ring-1 ring-inset"
                    style={{ background: `${iconColor}20`, boxShadow: `inset 0 0 0 1px ${iconColor}30` }}
                >
                    <i className={`fas ${icon} text-xs`} style={{ color: iconColor }} />
                </div>
                <span className="text-text-primary text-[13px] font-semibold flex-1">{title}</span>
                <span
                    className="rounded-full text-white text-[10px] font-bold min-w-[20px] text-center px-1.5 py-0.5 leading-none"
                    style={{ background: iconColor }}
                >
                    {count}
                </span>
            </div>
            <div className="flex flex-wrap gap-1.5 pl-[38px]">
                {displayItems.map((item, i) => renderItem(item, i))}
                {hasMore && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            setExpandedSections((prev) => ({ ...prev, [expandKey]: !isExpanded }))
                        }}
                        className="rounded-full text-[11px] font-semibold px-2.5 py-0.5 cursor-pointer transition-all hover:brightness-95 border"
                        style={{ background: `${iconColor}15`, color: iconColor, borderColor: `${iconColor}30` }}
                    >
                        {isExpanded ? 'Show less' : `+${items.length - maxItems} more`}
                    </button>
                )}
            </div>
        </div>
    )
}

/**
 * Operator group row with tinted background, matching NotificationRow visual style.
 * Each operator name is a clickable pill that opens the operators embedded view.
 */
export const OperatorGroup = ({
    icon,
    iconColor,
    title,
    count,
    operators,
    nameField = 'name',
    setEmbeddedView,
    setEmbeddedViewSearch
}) => (
    <div
        className="rounded-xl px-3 py-2.5 mb-1.5 border"
        style={{
            animation: 'fadeSlideIn 0.3s ease both',
            background: `${iconColor}0a`,
            borderColor: `${iconColor}22`
        }}
    >
        <div className="flex items-center gap-2.5 mb-1.5">
            <div
                className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 ring-1 ring-inset"
                style={{ background: `${iconColor}20`, boxShadow: `inset 0 0 0 1px ${iconColor}30` }}
            >
                <i className={`fas ${icon} text-xs`} style={{ color: iconColor }} />
            </div>
            <span className="text-text-primary text-[13px] font-semibold flex-1">{title}</span>
            <span
                className="rounded-full text-white text-[10px] font-bold min-w-[20px] text-center px-1.5 py-0.5 leading-none"
                style={{ background: iconColor }}
            >
                {count}
            </span>
        </div>
        <div className="flex flex-wrap gap-1.5 pl-[38px]">
            {operators.map((o, i) => (
                <button
                    key={i}
                    onClick={() => {
                        setEmbeddedView('operators')
                        setEmbeddedViewSearch(o[nameField] || '')
                    }}
                    className="rounded-full text-[11px] font-semibold px-2.5 py-1 cursor-pointer transition-all hover:brightness-95 active:scale-[0.97] border"
                    style={{ background: `${iconColor}14`, color: iconColor, borderColor: `${iconColor}30` }}
                >
                    {o[nameField]}
                </button>
            ))}
        </div>
    </div>
)

/** AI chat bubble — left-aligned for AI responses, right-aligned for user messages. */
export const AIChatBubble = ({ children, isAI, accentColor }) => (
    <div
        className={`flex ${isAI ? 'justify-start' : 'justify-end'}`}
        style={{ animation: 'fadeSlideIn 0.3s ease both' }}
    >
        <div
            className={`rounded-2xl px-3.5 py-2.5 max-w-[95%] text-[13px] leading-relaxed ${
                isAI
                    ? 'bg-bg-tertiary text-text-primary border border-border-light rounded-tl-sm'
                    : 'text-white rounded-tr-sm shadow-sm'
            }`}
            style={!isAI ? { background: accentColor } : undefined}
        >
            {children}
        </div>
    </div>
)

/** Summary counter strip — compact at-a-glance row of colored badges showing counts by category. */
export const SummaryStrip = ({ items }) => {
    const visible = items.filter((i) => i.count > 0)
    if (visible.length === 0) return null
    return (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {visible.map(({ label, count, color, icon }, i) => (
                <div
                    key={i}
                    className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border"
                    style={{ background: `${color}14`, color, borderColor: `${color}30` }}
                >
                    <i className={`fas ${icon} text-[8px]`} />
                    <span className="tabular-nums">{count}</span>
                    <span className="text-text-secondary font-medium">{label}</span>
                </div>
            ))}
        </div>
    )
}
