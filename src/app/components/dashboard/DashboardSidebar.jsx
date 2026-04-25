import React, { memo, useState } from 'react'

import { getAssetViewType } from './shared/DashboardSharedComponents'

/* ── Skeleton ── */

const SidebarSkeleton = () => (
    <div className="flex flex-col gap-3">
        <div
            className="rounded p-3 flex flex-col gap-2"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            <div className="h-2.5 w-20 rounded animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />
            <div className="h-3 w-full rounded animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />
            <div className="h-3 w-4/5 rounded animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />
        </div>
        {[1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2">
                <div className="h-2 w-16 rounded animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />
                <div
                    className="rounded p-2.5 flex flex-col gap-2"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                >
                    <div className="h-3 w-24 rounded animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />
                    <div className="flex gap-1.5">
                        <div className="h-5 w-20 rounded animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />
                        <div className="h-5 w-16 rounded animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />
                    </div>
                </div>
            </div>
        ))}
    </div>
)

/* ── Group panel — shared between Alerts and People sections ────────────── */

const GroupPanel = ({
    icon,
    iconColor,
    title,
    count,
    children,
    items,
    renderItem,
    maxItems = 3,
    expandKey,
    expandedSections,
    setExpandedSections
}) => {
    const isExpanded = expandedSections?.[expandKey]
    const renderItems = items ? (isExpanded ? items : items.slice(0, maxItems)) : null
    const hasMore = items ? items.length > maxItems : false

    return (
        <div
            className="rounded p-2.5"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            <div className="flex items-center gap-2 mb-2">
                <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded flex-shrink-0"
                    style={{ background: `${iconColor}14`, color: iconColor }}
                >
                    <i className={`fas ${icon} text-[10px]`} />
                </span>
                <span className="text-[11.5px] font-semibold flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                    {title}
                </span>
                {count > 0 && (
                    <span
                        className="inline-flex items-center justify-center min-w-[18px] h-4 rounded text-[10px] font-bold tabular-nums px-1"
                        style={{ background: `${iconColor}14`, color: iconColor }}
                    >
                        {count}
                    </span>
                )}
            </div>
            {renderItems ? (
                <div className="flex flex-wrap gap-1">
                    {renderItems.map((item, i) => renderItem(item, i))}
                    {hasMore && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                setExpandedSections((prev) => ({ ...prev, [expandKey]: !isExpanded }))
                            }}
                            className="rounded text-[10px] font-semibold px-1.5 py-0.5 cursor-pointer border-none transition-colors hover:brightness-95"
                            style={{
                                background: 'var(--bg-tertiary)',
                                color: 'var(--text-secondary)'
                            }}
                        >
                            {isExpanded ? 'Less' : `+${items.length - maxItems}`}
                        </button>
                    )}
                </div>
            ) : (
                children
            )}
        </div>
    )
}

/** Compact tinted asset/operator pill — matches schedule-tab badge density. */
const TintedPill = ({ label, onClick, color, suffix }) => (
    <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 rounded text-[10.5px] font-semibold px-1.5 py-0.5 cursor-pointer border-none transition-colors hover:brightness-95"
        style={{ background: `${color}14`, color, border: `1px solid ${color}25` }}
    >
        <span className="truncate max-w-[140px]">{label}</span>
        {suffix && <span className="text-[9px] opacity-70 tabular-nums">{suffix}</span>}
    </button>
)

/* ── Alerts section ─────────────────────────────────────────────────────── */

const AlertsSection = ({
    plantNotifications,
    expandedSections,
    setExpandedSections,
    setEmbeddedView,
    setEmbeddedViewSearch
}) => {
    const { assetsWithMostIssues, longTermShopAssets, shopIssue } = plantNotifications
    const hasAlerts = assetsWithMostIssues.length > 0 || longTermShopAssets.length > 0 || shopIssue

    if (!hasAlerts) {
        return (
            <div
                className="rounded px-2.5 py-2 flex items-center gap-2"
                style={{
                    background: 'rgba(22, 163, 74, 0.08)',
                    border: '1px solid rgba(22, 163, 74, 0.25)'
                }}
            >
                <i className="fas fa-check-circle text-[12px]" style={{ color: '#16a34a' }} />
                <div className="flex flex-col leading-tight">
                    <span className="text-[12px] font-semibold" style={{ color: '#15803d' }}>
                        All clear
                    </span>
                    <span className="text-[10px]" style={{ color: '#16a34a' }}>
                        No fleet issues
                    </span>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-2">
            {shopIssue && (
                <GroupPanel icon="fa-exclamation-triangle" iconColor="#dc2626" title="Fleet Alert" count={0}>
                    <div className="text-[10.5px]" style={{ color: 'var(--text-secondary)' }}>
                        <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                            {shopIssue.inShopCount}
                        </span>{' '}
                        in shop ·{' '}
                        <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                            {shopIssue.spareCount}
                        </span>{' '}
                        spare
                    </div>
                </GroupPanel>
            )}

            {assetsWithMostIssues.length > 0 && (
                <GroupPanel
                    icon="fa-exclamation-circle"
                    iconColor="#ea580c"
                    title="Open Issues"
                    count={assetsWithMostIssues.length}
                    items={assetsWithMostIssues}
                    expandKey="assetsWithIssues"
                    expandedSections={expandedSections}
                    setExpandedSections={setExpandedSections}
                    renderItem={(a, i) => (
                        <TintedPill
                            key={i}
                            label={`${a.type} ${a.identifier || ''}`}
                            color="#ea580c"
                            suffix={a.openIssueCount}
                            onClick={() => {
                                setEmbeddedView(getAssetViewType(a.type))
                                setEmbeddedViewSearch(a.identifier || '')
                            }}
                        />
                    )}
                />
            )}

            {longTermShopAssets.length > 0 && (
                <GroupPanel
                    icon="fa-tools"
                    iconColor="#be123c"
                    title="Long-Term Shop"
                    count={longTermShopAssets.length}
                    items={longTermShopAssets}
                    expandKey="longTermShop"
                    expandedSections={expandedSections}
                    setExpandedSections={setExpandedSections}
                    renderItem={(a, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => {
                                setEmbeddedView(getAssetViewType(a.type))
                                setEmbeddedViewSearch(a.identifier || '')
                            }}
                            className="inline-flex items-center gap-1 rounded text-[10.5px] font-semibold px-1.5 py-0.5 cursor-pointer border-none transition-colors hover:brightness-95"
                            style={{
                                background: '#be123c14',
                                color: '#be123c',
                                border: '1px solid #be123c25'
                            }}
                        >
                            <span>{a.identifier}</span>
                            <span className="text-[9px] opacity-70 tabular-nums">{a.daysInShop}d</span>
                            {a.downInYard && (
                                <span
                                    className="rounded text-[8px] font-bold uppercase tracking-wider px-1"
                                    style={{ background: '#fee2e2', color: '#dc2626' }}
                                >
                                    Yard
                                </span>
                            )}
                        </button>
                    )}
                />
            )}
        </div>
    )
}

/* ── People section ─────────────────────────────────────────────────────── */

const PeopleSection = ({ plantNotifications, setEmbeddedView, setEmbeddedViewSearch }) => {
    const { unassignedOperators, pendingOperators, trainingOperators } = plantNotifications
    const hasAny = unassignedOperators.length > 0 || pendingOperators.length > 0 || trainingOperators.length > 0
    if (!hasAny) return null

    function makeRenderName(color) {
        return function NameItem(o, i) {
            return (
                <TintedPill
                    key={i}
                    label={o.name || o.operatorName || ''}
                    color={color}
                    onClick={() => {
                        setEmbeddedView('operators')
                        setEmbeddedViewSearch(o.name || o.operatorName || '')
                    }}
                />
            )
        }
    }

    return (
        <div className="flex flex-col gap-2">
            {unassignedOperators.length > 0 && (
                <GroupPanel
                    icon="fa-user-slash"
                    iconColor="#0ea5e9"
                    title="Unassigned"
                    count={unassignedOperators.length}
                    items={unassignedOperators}
                    expandKey="sidebarUnassigned"
                    expandedSections={{}}
                    setExpandedSections={() => {}}
                    renderItem={makeRenderName('#0ea5e9')}
                />
            )}
            {pendingOperators.length > 0 && (
                <GroupPanel
                    icon="fa-user-plus"
                    iconColor="#10b981"
                    title="Pending Start"
                    count={pendingOperators.length}
                    items={pendingOperators}
                    expandKey="sidebarPending"
                    expandedSections={{}}
                    setExpandedSections={() => {}}
                    renderItem={makeRenderName('#10b981')}
                />
            )}
            {trainingOperators.length > 0 && (
                <GroupPanel
                    icon="fa-graduation-cap"
                    iconColor="#8b5cf6"
                    title="In Training"
                    count={trainingOperators.length}
                    items={trainingOperators}
                    expandKey="sidebarTraining"
                    expandedSections={{}}
                    setExpandedSections={() => {}}
                    renderItem={makeRenderName('#8b5cf6')}
                />
            )}
        </div>
    )
}

/* ── Section label — matches Plan-tab table headers ─────────────────────── */

const SectionLabel = ({ label, count, countColor, collapsed, onToggle }) => (
    <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 w-full text-left bg-transparent border-none p-0 cursor-pointer group px-1"
    >
        <span
            className="text-[10px] font-bold uppercase tracking-wider flex-1 transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
        >
            {label}
        </span>
        {count > 0 && (
            <span
                className="inline-flex items-center justify-center min-w-[16px] h-3.5 rounded text-[9px] font-bold tabular-nums px-1"
                style={{ background: `${countColor}14`, color: countColor }}
            >
                {count}
            </span>
        )}
        <i
            className={`fas fa-chevron-down text-[8px] transition-transform duration-150 ${
                collapsed ? '-rotate-90' : ''
            }`}
            style={{ color: 'var(--text-tertiary)' }}
        />
    </button>
)

/* ── Main sidebar ───────────────────────────────────────────────────────── */

const EXPANDED_WIDTH = 300
const COLLAPSED_WIDTH = 44

const DashboardSidebar = memo(function DashboardSidebar({
    accentColor,
    dashboardPlant,
    dashboardRegionCode,
    dataReady,
    expandedSections,
    isPlantMode,
    onRefresh,
    plantNotifications,
    refreshing,
    regionDisplayName,
    regionPlants,
    selectedRegion,
    setEmbeddedView,
    setEmbeddedViewSearch,
    setExpandedSections,
    setPlantModalOpen
}) {
    const [minimized, setMinimized] = useState(false)
    const [collapsed, setCollapsed] = useState({})
    const toggle = (key) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))

    const alertCount =
        (plantNotifications.assetsWithMostIssues?.length || 0) +
        (plantNotifications.longTermShopAssets?.length || 0) +
        (plantNotifications.shopIssue ? 1 : 0)

    const peopleCount =
        (plantNotifications.unassignedOperators?.length || 0) +
        (plantNotifications.pendingOperators?.length || 0) +
        (plantNotifications.trainingOperators?.length || 0)

    const plantLabel =
        dashboardPlant === 'MY_PLANTS'
            ? 'My Plants'
            : dashboardPlant?.startsWith('DISTRICT:')
              ? dashboardPlant.slice(9)
              : dashboardPlant
                ? regionPlants.find((p) => (p.plantCode || p.plant_code) === dashboardPlant)?.plantName ||
                  dashboardPlant
                : 'All Plants'

    const width = minimized ? COLLAPSED_WIDTH : EXPANDED_WIDTH

    const railIconButton = (icon, count, badgeColor, title) => (
        <button
            type="button"
            onClick={() => setMinimized(false)}
            className="relative flex items-center justify-center w-7 h-7 rounded border-none bg-transparent cursor-pointer transition-colors hover:brightness-95"
            style={{ color: 'var(--text-tertiary)' }}
            title={title}
        >
            <i className={`fas ${icon} text-[12px]`} />
            {count > 0 && (
                <span
                    className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[14px] h-3.5 rounded text-[9px] font-bold tabular-nums px-1"
                    style={{ background: badgeColor, color: '#fff' }}
                >
                    {count > 99 ? '99' : count}
                </span>
            )}
        </button>
    )

    return (
        <aside
            className="flex flex-col sticky top-0 z-10 max-h-[calc(100dvh-68px)] overflow-hidden flex-shrink-0"
            style={{
                background: 'var(--bg-primary)',
                borderRight: '1px solid var(--border-light)',
                width,
                minWidth: width,
                maxWidth: width,
                transition:
                    'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
        >
            {minimized ? (
                <>
                    <button
                        type="button"
                        onClick={() => setMinimized(false)}
                        className="flex items-center justify-center w-full h-9 cursor-pointer transition-colors hover:brightness-95"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid var(--border-light)',
                            color: 'var(--text-tertiary)'
                        }}
                        title="Expand sidebar"
                    >
                        <i className="fas fa-chevron-right text-[10px]" />
                    </button>
                    <div className="flex-1 flex flex-col items-center gap-1 py-2 overflow-hidden">
                        {railIconButton('fa-bell', alertCount, '#ea580c', `Fleet Alerts (${alertCount})`)}
                        {peopleCount > 0 &&
                            railIconButton('fa-users', peopleCount, '#0ea5e9', `People (${peopleCount})`)}
                        <button
                            type="button"
                            onClick={onRefresh}
                            disabled={refreshing}
                            className="flex items-center justify-center w-7 h-7 rounded border-none bg-transparent cursor-pointer transition-colors hover:brightness-95 disabled:opacity-60"
                            style={{ color: 'var(--text-tertiary)' }}
                            title="Refresh dashboard"
                        >
                            <i className={`fas fa-sync-alt text-[12px] ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </>
            ) : (
                <>
                    {/* Header — region/plant scope + refresh + minimize */}
                    <div
                        className="px-3 py-2.5 flex-shrink-0"
                        style={{ borderBottom: '1px solid var(--border-light)' }}
                    >
                        <div className="flex items-center gap-1.5 mb-2">
                            <span
                                className="text-[10px] font-bold uppercase tracking-wider flex-1"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                {isPlantMode ? 'Plant' : 'Region'}
                            </span>
                            <button
                                type="button"
                                onClick={onRefresh}
                                disabled={refreshing}
                                className="flex items-center justify-center w-6 h-6 rounded text-[11px] cursor-pointer border-none transition-colors hover:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed"
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-light)',
                                    color: 'var(--text-secondary)'
                                }}
                                title="Refresh"
                            >
                                <i className={`fas fa-sync-alt ${refreshing ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setMinimized(true)}
                                className="flex items-center justify-center w-6 h-6 rounded border-none bg-transparent cursor-pointer transition-colors hover:brightness-95"
                                style={{ color: 'var(--text-tertiary)' }}
                                title="Minimize sidebar"
                            >
                                <i className="fas fa-chevron-left text-[10px]" />
                            </button>
                        </div>
                        {dashboardRegionCode && selectedRegion?.type !== 'Office' ? (
                            <button
                                type="button"
                                onClick={() => setPlantModalOpen(true)}
                                disabled={refreshing}
                                className="w-full flex items-center gap-2 rounded text-[12px] font-semibold px-2 py-1.5 truncate cursor-pointer transition-colors hover:brightness-95 text-left"
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-light)',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                <i className="fas fa-map-marker-alt text-[10px]" style={{ color: accentColor }} />
                                <span className="truncate flex-1">{plantLabel}</span>
                                <i
                                    className="fas fa-chevron-down text-[8px]"
                                    style={{ color: 'var(--text-tertiary)' }}
                                />
                            </button>
                        ) : (
                            <div className="text-[13px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                                {regionDisplayName}
                            </div>
                        )}
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 flex flex-col gap-4">
                        {!dataReady ? (
                            <SidebarSkeleton />
                        ) : (
                            <>
                                <div className="flex flex-col gap-2">
                                    <SectionLabel
                                        label="Fleet Alerts"
                                        count={alertCount}
                                        countColor="#ea580c"
                                        collapsed={collapsed.alerts}
                                        onToggle={() => toggle('alerts')}
                                    />
                                    {!collapsed.alerts && (
                                        <AlertsSection
                                            plantNotifications={plantNotifications}
                                            expandedSections={expandedSections}
                                            setExpandedSections={setExpandedSections}
                                            setEmbeddedView={setEmbeddedView}
                                            setEmbeddedViewSearch={setEmbeddedViewSearch}
                                        />
                                    )}
                                </div>

                                {peopleCount > 0 && (
                                    <div className="flex flex-col gap-2">
                                        <SectionLabel
                                            label="People"
                                            count={peopleCount}
                                            countColor="#0ea5e9"
                                            collapsed={collapsed.people}
                                            onToggle={() => toggle('people')}
                                        />
                                        {!collapsed.people && (
                                            <PeopleSection
                                                plantNotifications={plantNotifications}
                                                setEmbeddedView={setEmbeddedView}
                                                setEmbeddedViewSearch={setEmbeddedViewSearch}
                                            />
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}
        </aside>
    )
})

export default DashboardSidebar
