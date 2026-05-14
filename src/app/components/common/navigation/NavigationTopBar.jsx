/* eslint-disable react/forbid-dom-props */
import React from 'react'

import SrmLogo from '../../../../assets/images/srm-logo.svg'
import {
    ADMIN_ITEMS,
    ASSET_ITEMS,
    buildHeaderStyle,
    ICONS,
    NAV_SKELETON_WIDTHS,
    PEOPLE_ITEMS,
    REPORTING_ITEMS,
    TOOLS_ITEMS
} from '../../../constants/navigationConstants'
import { TopBarIconButton, TopBarMessagesButton } from './NavigationActionButtons'
import { TopBarRegionSelect } from './NavigationParts'

/** Pill-style cell for a top-bar nav item. */
const navItemStyle = (isActive, isTablet) => ({
    alignItems: 'center',
    backgroundColor: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
    border: isActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
    borderRadius: isTablet ? '6px' : '10px',
    color: 'white',
    cursor: 'pointer',
    display: 'flex',
    flexShrink: 0,
    fontSize: isTablet ? '12px' : '14px',
    fontWeight: isActive ? 600 : 500,
    gap: isTablet ? '4px' : '8px',
    padding: isTablet ? '6px 8px' : '10px 16px',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap'
})

const dropdownStyle = {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-light)',
    borderRadius: '14px',
    boxShadow: 'var(--shadow)',
    left: 0,
    marginTop: '8px',
    minWidth: '220px',
    padding: '10px',
    position: 'absolute',
    top: '100%',
    zIndex: 1000
}

/** Renders a category dropdown trigger and its menu of nav items. */
function TopBarDropdown({
    label,
    icon,
    items,
    isOpen,
    isActive,
    isTablet,
    accentColor,
    visibleMenuItems,
    selectedView,
    onToggle,
    onItemClick,
    onTriggerRef,
    registerMagnetic
}) {
    return (
        <div className="relative" ref={isOpen ? onTriggerRef : null}>
            <div
                ref={registerMagnetic}
                style={{ ...navItemStyle(isActive, isTablet), gap: isTablet ? '4px' : '6px' }}
                onClick={onToggle}
            >
                <i className={`fas ${icon}`} style={{ fontSize: isTablet ? '13px' : '14px' }}></i>
                {!isTablet && <span>{label}</span>}
                <i
                    className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`}
                    style={{ fontSize: isTablet ? '9px' : '10px', marginLeft: isTablet ? '0' : '2px' }}
                ></i>
            </div>
            {isOpen && (
                <div style={dropdownStyle}>
                    {items.map((itemId) => {
                        const item = visibleMenuItems.find((i) => i.id === itemId)
                        if (!item) return null
                        const isItemActive = selectedView === item.id
                        return (
                            <div
                                className="items-center rounded-lg cursor-pointer flex"
                                key={item.id}
                                style={{
                                    backgroundColor: isItemActive ? `${accentColor}12` : 'transparent',
                                    color: isItemActive ? accentColor : 'var(--text-primary)',
                                    fontWeight: isItemActive ? 600 : 400,
                                    gap: '10px',
                                    padding: '10px 14px',
                                    transition: 'all 0.15s'
                                }}
                                onClick={() => onItemClick(item.id)}
                                onMouseEnter={(e) =>
                                    (e.currentTarget.style.backgroundColor = isItemActive
                                        ? `${accentColor}12`
                                        : 'var(--bg-secondary)')
                                }
                                onMouseLeave={(e) =>
                                    (e.currentTarget.style.backgroundColor = isItemActive
                                        ? `${accentColor}12`
                                        : 'transparent')
                                }
                            >
                                <i className={`fas ${ICONS[item.id]} text-text-secondary text-sm w-[18px]`}></i>
                                <span style={{ color: isItemActive ? accentColor : 'var(--text-primary)' }}>
                                    {item.text}
                                </span>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

const DROPDOWN_CONFIGS = [
    { activeKey: 'hasTools', icon: ICONS.Tools, id: 'tools', items: TOOLS_ITEMS, label: 'Tools' },
    { activeKey: 'hasAssets', icon: ICONS.Assets, id: 'assets', items: ASSET_ITEMS, label: 'Assets' },
    { activeKey: 'hasPeople', icon: ICONS.People, id: 'people', items: PEOPLE_ITEMS, label: 'People' },
    {
        activeKey: 'hasReporting',
        icon: ICONS.Reporting,
        id: 'reporting',
        items: REPORTING_ITEMS,
        label: 'Reporting'
    },
    { activeKey: 'hasAdmin', icon: 'fa-cog', id: 'admin', items: ADMIN_ITEMS, label: 'Admin' }
]

/** Top-bar basic desktop nav: single-row header with grouped dropdowns. */
export default function NavigationTopBar({
    children,
    accentColor,
    isTablet,
    visibleMenuItems,
    standaloneItems,
    groupFlags,
    selectedView,
    openDropdown,
    setOpenDropdown,
    dropdownRef,
    onMenuClick,
    onRegionChange,
    regionCode,
    permittedRegions,
    combinedCount,
    onlineUsersCount,
    onShowNotifications,
    onShowOnlineUsers,
    userName,
    registerMagnetic
}) {
    const headerStyle = buildHeaderStyle(accentColor)
    const dashboardItem = standaloneItems.find((i) => i.id === 'Dashboard')
    return (
        <div className="flex flex-col h-screen overflow-hidden w-full">
            <header
                style={{
                    ...headerStyle,
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    display: 'flex',
                    flexShrink: 0,
                    height: isTablet ? '56px' : '68px',
                    justifyContent: 'space-between',
                    padding: isTablet ? '0 12px' : '0 24px',
                    position: 'sticky',
                    top: 0,
                    zIndex: 100
                }}
            >
                <div className="items-center flex flex-1 min-w-0" style={{ gap: isTablet ? '10px' : '28px' }}>
                    <div
                        className="group items-center border-r border-[rgba(255,255,255,0.1)] cursor-pointer flex"
                        style={{ flexShrink: 0, paddingRight: isTablet ? '10px' : '24px' }}
                    >
                        <img
                            src={SrmLogo}
                            alt="Smyrna Ready Mix"
                            className="transition-all duration-300 ease-out group-hover:brightness-125 group-hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.3)] group-hover:scale-105"
                            style={{ height: isTablet ? '28px' : '40px' }}
                            draggable={false}
                        />
                    </div>
                    <nav className="items-center flex flex-1 min-w-0" style={{ gap: isTablet ? '2px' : '6px' }}>
                        {visibleMenuItems.length === 0 && (
                            <div className="flex items-center gap-2">
                                {NAV_SKELETON_WIDTHS.map((w, i) => (
                                    <div
                                        key={i}
                                        className="bg-white/10 animate-pulse rounded-lg h-8"
                                        style={{
                                            animationDelay: `${i * 80}ms`,
                                            animationFillMode: 'both',
                                            width: w
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                        {dashboardItem && (
                            <div
                                ref={registerMagnetic}
                                style={navItemStyle(selectedView === 'Dashboard', isTablet)}
                                onClick={() => onMenuClick('Dashboard')}
                                title="Dashboard"
                            >
                                <i
                                    className={`fas ${ICONS.Dashboard}`}
                                    style={{ fontSize: isTablet ? '13px' : '14px' }}
                                ></i>
                                {!isTablet && <span>Dashboard</span>}
                            </div>
                        )}
                        {DROPDOWN_CONFIGS.map((cfg) =>
                            groupFlags[cfg.activeKey] ? (
                                <TopBarDropdown
                                    key={cfg.id}
                                    label={cfg.label}
                                    icon={cfg.icon}
                                    items={cfg.items}
                                    isOpen={openDropdown === cfg.id}
                                    isActive={cfg.items.includes(selectedView)}
                                    isTablet={isTablet}
                                    accentColor={accentColor}
                                    visibleMenuItems={visibleMenuItems}
                                    selectedView={selectedView}
                                    onToggle={() => setOpenDropdown(openDropdown === cfg.id ? null : cfg.id)}
                                    onItemClick={onMenuClick}
                                    onTriggerRef={dropdownRef}
                                    registerMagnetic={registerMagnetic}
                                />
                            ) : null
                        )}
                        {standaloneItems
                            .filter((i) => i.id !== 'Dashboard')
                            .map((item) => (
                                <div
                                    key={item.id}
                                    ref={registerMagnetic}
                                    style={navItemStyle(selectedView === item.id, isTablet)}
                                    onClick={() => onMenuClick(item.id)}
                                    title={item.text}
                                    onMouseEnter={(e) => {
                                        if (selectedView !== item.id)
                                            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'
                                    }}
                                    onMouseLeave={(e) => {
                                        if (selectedView !== item.id)
                                            e.currentTarget.style.backgroundColor = 'transparent'
                                    }}
                                >
                                    <i
                                        className={`fas ${ICONS[item.id]}`}
                                        style={{ fontSize: isTablet ? '13px' : '14px' }}
                                    ></i>
                                    {!isTablet && <span>{item.text}</span>}
                                </div>
                            ))}
                    </nav>
                </div>
                <div className="items-center flex" style={{ flexShrink: 0, gap: isTablet ? '8px' : '16px' }}>
                    <TopBarRegionSelect
                        regionCode={regionCode}
                        permittedRegions={permittedRegions}
                        onChange={onRegionChange}
                        isTablet={isTablet}
                    />
                    <TopBarMessagesButton
                        onClick={onShowNotifications}
                        combinedCount={combinedCount}
                        accentColor={accentColor}
                        isTablet={isTablet}
                    />
                    <TopBarIconButton
                        icon="fa-users"
                        title="Online Users"
                        onClick={onShowOnlineUsers}
                        badge={onlineUsersCount}
                        badgeColor="#22c55e"
                        isTablet={isTablet}
                        accentColor={accentColor}
                    />
                    <TopBarIconButton
                        icon={ICONS.MyAccount}
                        title={userName ? `My Account - ${userName}` : 'My Account'}
                        onClick={() => onMenuClick('MyAccount')}
                        isActive={selectedView === 'MyAccount'}
                        tutorialTarget="account-nav"
                        isTablet={isTablet}
                        accentColor={accentColor}
                    />
                </div>
            </header>
            <main className="flex-1 overflow-x-hidden overflow-y-auto relative" data-content-scroll>
                {children}
            </main>
        </div>
    )
}
