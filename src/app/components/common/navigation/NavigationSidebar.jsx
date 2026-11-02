/* eslint-disable react/forbid-dom-props */
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { SRM_LOGO_URL } from '../../../constants/assetUrls'
import { ADMIN_ITEMS, ASSET_ITEMS, ICONS, PEOPLE_ITEMS, TOOLS_ITEMS } from '../../../constants/navigationConstants'
import { useMenuKeyboard } from '../../../hooks/useMenuKeyboard'
import CountBubble from '../CountBubble'

/** The rail takes the user's accent and sinks it almost to black, so the
 *  colour they picked still names the app without a saturated slab of it
 *  running down the whole left edge. */
export const sidebarBackground = (accentColor) => `color-mix(in srgb, ${accentColor} 20%, #0e0f11)`

const GROUPS = [
    { items: TOOLS_ITEMS, key: 'hasTools', label: 'Tools' },
    { items: ASSET_ITEMS, key: 'hasAssets', label: 'Fleet' },
    { items: PEOPLE_ITEMS, key: 'hasPeople', label: 'People' },
    { items: ADMIN_ITEMS, key: 'hasAdmin', label: 'Admin' }
]

const regionCodeOf = (r) => r.regionCode || r.region_code
const regionNameOf = (r) => r.regionName || r.region_name

const itemClass = (isActive, compact) =>
    `group relative flex w-full items-center rounded-[4px] border-none text-left cursor-pointer transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/50 ${
        compact ? 'h-10 justify-center' : 'h-8 gap-3 px-2.5'
    } ${isActive ? 'bg-white/[0.11] text-white' : 'bg-transparent text-white/[0.68] hover:bg-white/[0.06] hover:text-white'}`

/** One destination in the rail. In compact mode the label moves to a
 *  tooltip and the count to a dot on the icon. */
function SidebarItem({
    icon,
    label,
    isActive,
    compact,
    onClick,
    count = 0,
    countTone = 'danger',
    tutorialTarget,
    anchorRef
}) {
    return (
        <button
            type="button"
            ref={anchorRef}
            onClick={onClick}
            className={itemClass(isActive, compact)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={compact ? label : undefined}
            title={compact ? label : undefined}
            data-tutorial-target={tutorialTarget}
        >
            <i
                className={`fas ${icon} w-4 shrink-0 text-center text-[13px] ${isActive ? 'text-white' : 'text-white/45 group-hover:text-white/80'}`}
                aria-hidden="true"
            />
            {!compact && (
                <span className={`min-w-0 flex-1 truncate text-[13px] ${isActive ? 'font-medium' : ''}`}>{label}</span>
            )}
            {!compact && count > 0 && (
                <span
                    className={`ml-auto rounded-[3px] px-1.5 py-px font-mono text-[11px] font-medium tabular-nums ${countTone === 'danger' ? 'bg-status-danger text-white' : 'bg-white/[0.12] text-white/80'}`}
                >
                    {count > 99 ? '99+' : count}
                </span>
            )}
            {compact && count > 0 && (
                <CountBubble
                    count={count}
                    size="sm"
                    tone={countTone === 'danger' ? 'danger' : 'success'}
                    ring="ring-transparent"
                    className="absolute right-2 top-1"
                />
            )}
        </button>
    )
}

/** Region switcher at the top of the rail. Opens a list in the rail's own
 *  colours; the current region is the highlighted row. */
function RegionSwitcher({ regionCode, permittedRegions, onChange, compact }) {
    const [open, setOpen] = useState(false)
    const containerRef = useRef(null)
    const close = useCallback(() => setOpen(false), [])
    const focusFirst = useMenuKeyboard(containerRef, open, close)
    const current = permittedRegions.find((r) => regionCodeOf(r) === regionCode)

    useEffect(() => {
        if (!open) return undefined
        const handlePointer = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handlePointer)
        return () => document.removeEventListener('mousedown', handlePointer)
    }, [open])

    const choose = (code) => {
        setOpen(false)
        containerRef.current?.querySelector('[aria-haspopup]')?.focus()
        if (code !== regionCode) onChange({ target: { value: code } })
    }

    return (
        <div className={`relative ${compact ? 'px-2' : 'px-3'}`} ref={containerRef}>
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={`Region: ${current ? regionNameOf(current) : 'loading'}`}
                title={compact && current ? regionNameOf(current) : undefined}
                disabled={permittedRegions.length === 0}
                onClick={(e) => {
                    setOpen((v) => !v)
                    if (!open && e.detail === 0) focusFirst()
                }}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setOpen(true)
                        focusFirst()
                    }
                }}
                className={`flex w-full items-center rounded-[4px] border text-left text-white cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-default ${
                    open
                        ? 'border-white/25 bg-white/[0.1]'
                        : 'border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08]'
                } ${compact ? 'h-10 justify-center' : 'gap-2 px-2.5 py-2'}`}
            >
                {compact ? (
                    <span className="font-mono text-[11px] font-medium tracking-wide">
                        {current ? regionCodeOf(current) : '···'}
                    </span>
                ) : (
                    <>
                        <span className="flex min-w-0 flex-1 flex-col leading-tight">
                            <span className="text-[11px] text-white/45">Region</span>
                            <span className="truncate text-[13px] font-medium">
                                {current ? regionNameOf(current) : 'Loading…'}
                            </span>
                        </span>
                        <i className="fas fa-sort text-[10px] text-white/40" aria-hidden="true" />
                    </>
                )}
            </button>
            {open && (
                <div
                    role="listbox"
                    aria-label="Region"
                    className={`absolute z-panel mt-1 rounded-[6px] border border-white/10 bg-[#1a1c1f] p-1 shadow-modal animate-fade-in-fast motion-reduce:animate-none ${
                        compact ? 'left-full top-0 ml-2 w-56' : 'left-3 right-3 top-full'
                    }`}
                >
                    {permittedRegions.map((r) => {
                        const code = regionCodeOf(r)
                        const selected = code === regionCode
                        return (
                            <button
                                type="button"
                                role="option"
                                aria-selected={selected}
                                key={code}
                                onClick={() => choose(code)}
                                className={`flex w-full items-baseline gap-2 rounded-[4px] px-2.5 py-2 text-left cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:bg-white/[0.08] ${
                                    selected
                                        ? 'bg-white/[0.1] text-white'
                                        : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                                }`}
                            >
                                <span
                                    className={`min-w-0 flex-1 truncate text-[13px] ${selected ? 'font-medium' : ''}`}
                                >
                                    {regionNameOf(r)}
                                </span>
                                <span className="font-mono text-[11px] text-white/40">{code}</span>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

/**
 * The app's navigation: a dark rail down the left edge listing every
 * destination the user can reach, grouped by what it covers, with the region
 * at the top and the user's messages, who is online and their account at the
 * bottom. Nothing hides behind a dropdown.
 *
 * `compact` narrows it to an icon rail (tablets, and the "Compact" navigation
 * preference). `onToggleCompact`, when set, adds the button at the foot of
 * the rail that flips that preference. `onClose` is set when the rail is
 * shown as the phone drawer.
 */
export function SidebarContent({
    accentColor,
    compact = false,
    groupFlags,
    standaloneItems,
    visibleMenuItems,
    selectedView,
    onMenuClick,
    regionCode,
    permittedRegions,
    onRegionChange,
    combinedCount,
    onlineUsersCount,
    onShowNotifications,
    onShowOnlineUsers,
    userName,
    userInitials,
    onToggleCompact,
    onClose
}) {
    const dashboardItem = standaloneItems.find((i) => i.id === 'Dashboard')
    const otherStandalone = standaloneItems.filter((i) => i.id !== 'Dashboard')
    const loading = visibleMenuItems.length === 0
    return (
        <div className="flex h-full min-h-0 flex-col text-white" style={{ background: sidebarBackground(accentColor) }}>
            <div
                className={`flex shrink-0 items-center ${compact ? 'justify-center px-2 pb-3 pt-4' : 'justify-between px-4 pb-4 pt-5'}`}
            >
                <img
                    src={SRM_LOGO_URL}
                    alt="Smyrna Ready Mix"
                    width={223}
                    height={85}
                    className={`w-auto ${compact ? 'h-6' : 'h-8'}`}
                    draggable={false}
                />
                {onClose && (
                    <button
                        type="button"
                        aria-label="Close menu"
                        onClick={onClose}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-[4px] text-white/70 cursor-pointer hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                        <i className="fas fa-times" aria-hidden="true" />
                    </button>
                )}
            </div>

            <RegionSwitcher
                regionCode={regionCode}
                permittedRegions={permittedRegions}
                onChange={onRegionChange}
                compact={compact}
            />

            <nav
                aria-label="Primary"
                className={`min-h-0 flex-1 overflow-y-auto pb-3 pt-3 ${compact ? 'px-2' : 'px-3'}`}
            >
                {loading && (
                    <div className="flex flex-col gap-2 px-1 pt-1" aria-hidden="true">
                        {[64, 88, 72, 96, 80].map((w, i) => (
                            <div
                                key={i}
                                className="h-3 rounded-sm bg-white/10 animate-pulse motion-reduce:animate-none"
                                style={{ width: compact ? 24 : `${w}%` }}
                            />
                        ))}
                    </div>
                )}
                {dashboardItem && (
                    <SidebarItem
                        icon={ICONS.Dashboard}
                        label="Dashboard"
                        isActive={selectedView === 'Dashboard'}
                        compact={compact}
                        onClick={() => onMenuClick('Dashboard')}
                    />
                )}
                {GROUPS.map(({ items, key, label }) =>
                    groupFlags[key] ? (
                        <div key={key} className={compact ? 'mt-3 border-t border-white/[0.08] pt-3' : 'mt-5'}>
                            {!compact && (
                                <div className="px-2.5 pb-1.5 text-[11px] font-medium text-white/40">{label}</div>
                            )}
                            <div className="flex flex-col gap-px">
                                {items.map((id) => {
                                    const item = visibleMenuItems.find((i) => i.id === id)
                                    if (!item) return null
                                    return (
                                        <SidebarItem
                                            key={id}
                                            icon={ICONS[id]}
                                            label={item.text}
                                            isActive={selectedView === id}
                                            compact={compact}
                                            onClick={() => onMenuClick(id)}
                                        />
                                    )
                                })}
                            </div>
                        </div>
                    ) : null
                )}
                {otherStandalone.map((item) => (
                    <SidebarItem
                        key={item.id}
                        icon={ICONS[item.id] || 'fa-circle'}
                        label={item.text}
                        isActive={selectedView === item.id}
                        compact={compact}
                        onClick={() => onMenuClick(item.id)}
                    />
                ))}
            </nav>

            <div
                className={`flex shrink-0 flex-col gap-px border-t border-white/[0.08] py-2 ${compact ? 'px-2' : 'px-3'}`}
            >
                <SidebarItem
                    icon="fa-envelope"
                    label="Messages"
                    isActive={selectedView === 'Notifications'}
                    compact={compact}
                    count={combinedCount}
                    onClick={onShowNotifications}
                />
                {onShowOnlineUsers && (
                    <SidebarItem
                        icon="fa-circle-dot"
                        label="Online now"
                        isActive={false}
                        compact={compact}
                        count={onlineUsersCount}
                        countTone="neutral"
                        onClick={onShowOnlineUsers}
                    />
                )}
                <button
                    type="button"
                    onClick={() => onMenuClick('MyAccount')}
                    data-tutorial-target="account-nav"
                    aria-label={compact ? `My account — ${userName || ''}` : undefined}
                    title={compact ? userName || 'My account' : undefined}
                    aria-current={selectedView === 'MyAccount' ? 'page' : undefined}
                    className={`mt-1 flex w-full items-center rounded-[4px] border-none text-left cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/50 ${
                        compact ? 'h-11 justify-center' : 'gap-2.5 px-2 py-2'
                    } ${selectedView === 'MyAccount' ? 'bg-white/[0.11]' : 'bg-transparent hover:bg-white/[0.06]'}`}
                >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-white/[0.12] font-mono text-[11px] font-medium text-white">
                        {userInitials}
                    </span>
                    {!compact && (
                        <span className="flex min-w-0 flex-col leading-tight">
                            <span className="truncate text-[13px] font-medium text-white">
                                {userName || 'My account'}
                            </span>
                            <span className="text-[11px] text-white/45">My account</span>
                        </span>
                    )}
                </button>
                {onToggleCompact && (
                    <SidebarItem
                        icon={compact ? 'fa-angles-right' : 'fa-angles-left'}
                        label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
                        isActive={false}
                        compact={compact}
                        onClick={onToggleCompact}
                    />
                )}
            </div>
        </div>
    )
}

/** Desktop and tablet shell: the rail on the left, the page beside it, and
 *  the footer pinned under the page rather than under the rail. */
export default function NavigationSidebar({ children, compact, footer, ...contentProps }) {
    return (
        // The rail's width is published as a custom property so screens that
        // fix themselves to the viewport (the detail views) start beside it.
        <div
            className="flex min-h-0 w-full flex-1 overflow-hidden"
            style={{ '--rail-width': compact ? '64px' : '232px', '--topbar-height': '0px' }}
        >
            <aside
                className={`z-nav flex h-full shrink-0 flex-col ${compact ? 'w-16' : 'w-[232px]'}`}
                aria-label="Navigation"
            >
                <SidebarContent compact={compact} {...contentProps} />
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
                <main
                    className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-bg-secondary"
                    data-content-scroll
                >
                    {children}
                </main>
                {footer}
            </div>
        </div>
    )
}
