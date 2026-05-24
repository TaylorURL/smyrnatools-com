/* eslint-disable react/forbid-dom-props */
import React from 'react'

import SrmLogo from '../../../../assets/images/srm-logo.svg'
import { buildHeaderStyle, ICONS, NAV_SKELETON_WIDTHS } from '../../../constants/navigationConstants'
import { TwoLevelIconButton, TwoLevelUserAvatar } from './NavigationActionButtons'
import { TwoLevelRegionSelect } from './NavigationParts'

/** Two-level desktop nav: header with category tabs + secondary tab strip with
 *  sliding underline. */
export default function NavigationTwoLevel({
    children,
    accentColor,
    visibleMenuItems,
    visibleCategories,
    secondaryItems,
    activeCategory,
    selectedView,
    regionCode,
    permittedRegions,
    onRegionChange,
    combinedCount,
    onlineUsersCount,
    onShowNotifications,
    onShowOnlineUsers,
    onMenuClick,
    onCategoryClick,
    userInitials,
    userName,
    secondaryNavRef,
    underlineRef
}) {
    const headerStyle = buildHeaderStyle(accentColor)
    return (
        <div className="flex flex-col h-screen w-full overflow-hidden">
            <header
                className="flex-shrink-0 sticky top-0 z-[100]"
                style={{
                    ...headerStyle,
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
                }}
            >
                <div className="flex items-center justify-between" style={{ padding: '12px 32px' }}>
                    <div className="flex items-center gap-6 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                        <img
                            src={SrmLogo}
                            alt="Smyrna Ready Mix"
                            className="flex-shrink-0 transition-all duration-300 hover:brightness-125 h-7"
                            draggable={false}
                        />
                        <div className="flex items-center gap-1">
                            {visibleMenuItems.length === 0 &&
                                NAV_SKELETON_WIDTHS.map((w, i) => (
                                    <div
                                        key={i}
                                        className="animate-pulse rounded-lg bg-[rgba(255,255,255,0.08)] h-[34px]"
                                        style={{
                                            animationDelay: `${i * 80}ms`,
                                            animationFillMode: 'both',
                                            width: w
                                        }}
                                    />
                                ))}
                            {visibleCategories.map((cat) => {
                                const isActive = activeCategory === cat.id
                                return (
                                    <button
                                        key={cat.id}
                                        className="flex items-center gap-2 whitespace-nowrap cursor-pointer border-none transition-all duration-200 rounded-[10px]"
                                        style={{
                                            background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
                                            boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                                            color: isActive ? 'white' : 'rgba(255,255,255,0.65)',
                                            fontSize: 13,
                                            fontWeight: isActive ? 600 : 500,
                                            outline: 'none',
                                            padding: '8px 18px'
                                        }}
                                        onClick={() => onCategoryClick(cat.id)}
                                        onMouseEnter={(e) => {
                                            if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isActive) e.currentTarget.style.background = 'transparent'
                                        }}
                                    >
                                        <i className={`fas ${cat.icon}`} style={{ fontSize: 13 }} />
                                        {cat.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                        <TwoLevelRegionSelect
                            regionCode={regionCode}
                            permittedRegions={permittedRegions}
                            onChange={onRegionChange}
                        />
                        <TwoLevelIconButton
                            title="Messages"
                            iconClasses={[
                                { name: 'fa-bell', size: 12 },
                                { name: 'fa-envelope', size: 11 }
                            ]}
                            onClick={onShowNotifications}
                            accentColor={accentColor}
                            badge={combinedCount}
                            width={40}
                        />
                        <TwoLevelIconButton
                            title="Online Users"
                            iconClasses={[{ name: 'fa-users', size: 13 }]}
                            onClick={onShowOnlineUsers}
                            accentColor={accentColor}
                            badge={onlineUsersCount}
                            badgeColor="#22c55e"
                        />
                        <TwoLevelUserAvatar
                            accentColor={accentColor}
                            initials={userInitials}
                            title={userName || 'My Account'}
                            onClick={() => onMenuClick('MyAccount')}
                        />
                    </div>
                </div>
            </header>

            {secondaryItems.length > 0 && (
                <div className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm" style={{ minHeight: 44 }}>
                    <div
                        ref={secondaryNavRef}
                        className="flex items-center relative overflow-x-auto"
                        style={{ padding: '0 32px', scrollbarWidth: 'none' }}
                    >
                        {secondaryItems.map((item) => {
                            const isActive = selectedView === item.id
                            return (
                                <button
                                    key={item.id}
                                    data-active={isActive}
                                    className="flex items-center gap-1.5 whitespace-nowrap cursor-pointer border-none bg-transparent transition-colors duration-150"
                                    style={{
                                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        fontSize: 13,
                                        fontWeight: isActive ? 600 : 500,
                                        outline: 'none',
                                        padding: '12px 16px'
                                    }}
                                    onClick={() => onMenuClick(item.id)}
                                    onMouseEnter={(e) => {
                                        if (!isActive) e.currentTarget.style.color = 'var(--text-primary)'
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)'
                                    }}
                                >
                                    <i className={`fas ${ICONS[item.id] || 'fa-circle'}`} style={{ fontSize: 12 }} />
                                    {item.text}
                                </button>
                            )
                        })}
                        <div
                            ref={underlineRef}
                            className="absolute bottom-0 rounded-t h-[2.5px] w-0"
                            style={{
                                backgroundColor: accentColor,
                                transition:
                                    'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                        />
                    </div>
                </div>
            )}

            <div data-content-scroll className="flex-1 overflow-x-hidden overflow-y-auto relative">
                {children}
            </div>
        </div>
    )
}
