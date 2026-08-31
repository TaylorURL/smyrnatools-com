/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { SRM_LOGO_URL } from '../../../constants/assetUrls'
import { buildHeaderStyle, ICONS, NAV_SKELETON_WIDTHS } from '../../../constants/navigationConstants'
import { TwoLevelIconButton, TwoLevelUserAvatar } from './NavigationActionButtons'
import { TwoLevelRegionSelect } from './NavigationParts'

/** Returns Tailwind classes for a primary category tab on the colored header. */
const categoryTabClasses = (isActive) => {
    const tone = isActive
        ? 'bg-white/[0.18] text-white font-semibold shadow-raised'
        : 'bg-transparent text-white/65 font-medium hover:bg-white/[0.08] hover:text-white'
    return `inline-flex items-center gap-2 cursor-pointer whitespace-nowrap rounded-[10px] border-none px-4 py-2 text-[13px] transition-[background-color,color,box-shadow] duration-200 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${tone}`
}

/** Returns Tailwind classes for a secondary item underline tab on the surface. */
const secondaryTabClasses = (isActive) => {
    const tone = isActive
        ? 'text-text-primary font-semibold'
        : 'text-text-secondary font-medium hover:text-text-primary'
    return `inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap border-none bg-transparent px-4 py-3 text-[13px] transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary rounded-sm ${tone}`
}

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
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            <header
                className="sticky top-0 z-nav flex-shrink-0 border-b border-white/10 shadow-raised"
                style={headerStyle}
            >
                <div className="flex items-center justify-between px-8 py-3">
                    <div className="flex items-center gap-6 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                        <img
                            src={SRM_LOGO_URL}
                            alt="Smyrna Ready Mix"
                            width={223}
                            height={85}
                            className="h-7 w-auto flex-shrink-0 transition-[filter] duration-300 ease-out hover:brightness-125 motion-reduce:transition-none"
                            draggable={false}
                        />
                        <nav aria-label="Primary" className="flex items-center gap-1">
                            {visibleMenuItems.length === 0 &&
                                NAV_SKELETON_WIDTHS.map((w, i) => (
                                    <div
                                        key={i}
                                        className="h-[34px] animate-pulse rounded-lg bg-white/[0.08] motion-reduce:animate-none"
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
                                        type="button"
                                        key={cat.id}
                                        className={categoryTabClasses(isActive)}
                                        aria-current={isActive ? 'page' : undefined}
                                        onClick={() => onCategoryClick(cat.id)}
                                    >
                                        <i className={`fas ${cat.icon} text-[13px]`} aria-hidden="true" />
                                        {cat.label}
                                    </button>
                                )
                            })}
                        </nav>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-3">
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
                            badgeColor="var(--status-active)"
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
                <div className="min-h-[44px] flex-shrink-0 border-b border-border-light bg-bg-primary shadow-sm">
                    <nav
                        aria-label="Section"
                        ref={secondaryNavRef}
                        className="relative flex items-center overflow-x-auto px-8"
                        style={{ scrollbarWidth: 'none' }}
                    >
                        {secondaryItems.map((item) => {
                            const isActive = selectedView === item.id
                            return (
                                <button
                                    type="button"
                                    key={item.id}
                                    data-active={isActive}
                                    className={secondaryTabClasses(isActive)}
                                    aria-current={isActive ? 'page' : undefined}
                                    onClick={() => onMenuClick(item.id)}
                                >
                                    <i
                                        className={`fas ${ICONS[item.id] || 'fa-circle'} text-[12px]`}
                                        aria-hidden="true"
                                    />
                                    {item.text}
                                </button>
                            )
                        })}
                        <div
                            ref={underlineRef}
                            className="absolute bottom-0 left-0 h-[2.5px] w-px origin-left motion-reduce:transition-none"
                            style={{
                                backgroundColor: accentColor,
                                transform: 'scaleX(0)',
                                transition: 'transform 300ms ease-out'
                            }}
                        />
                    </nav>
                </div>
            )}

            <div data-content-scroll className="relative flex-1 overflow-x-hidden overflow-y-auto">
                {children}
            </div>
        </div>
    )
}
