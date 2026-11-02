import React, { useMemo, useState } from 'react'

import { ADMIN_ITEMS, ASSET_ITEMS, PEOPLE_ITEMS, TOOLS_ITEMS } from '../../constants/navigationConstants'
import { useSharedMessages } from '../../context/MessagesContext'
import { usePreferences } from '../../context/PreferencesContext'
import { useAccentColor } from '../../hooks/useAccentColor'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useOnlineUsersCount, usePermittedRegions, useVisibleMenuItems } from '../../hooks/useNavigationData'
import { useIsTablet } from '../../hooks/useNavigationLayout'
import NavigationMobile from './navigation/NavigationMobile'
import NavigationSidebar from './navigation/NavigationSidebar'
import NotificationsModal from './NotificationsModal'
import OnlineUsersModal from './OnlineUsersModal'

/** Computes the two-character avatar initials from a user's display name. */
const computeUserInitials = (userName) => {
    if (!userName) return '?'
    return userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
}

/** The app's navigation. Desktop and tablet get the left rail, full width by
 *  default and an icon rail on tablets or when the user picks "Compact" (the
 *  stored `two_level_tabs` value, kept so existing preferences carry over).
 *  Phones get a top bar whose menu opens the same rail as a drawer. */
export default function Navigation({
    selectedView,
    onSelectView,
    children,
    footer = null,
    userName = '',
    userId = null,
    ..._rest
}) {
    const { preferences, updatePreferences } = usePreferences()
    const isCompactPreference = (preferences.navStyle || 'top_bar_basic') === 'two_level_tabs'

    const [showNotifications, setShowNotifications] = useState(false)
    const [notificationsAnchor, setNotificationsAnchor] = useState(null)
    const [showOnlineUsers, setShowOnlineUsers] = useState(false)
    const [onlineUsersAnchor, setOnlineUsersAnchor] = useState(null)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    const isMobile = useIsMobile()
    const isTablet = useIsTablet()
    const accentColor = useAccentColor()

    const regionType = preferences.selectedRegion?.type
    const regionCode = preferences.selectedRegion?.code

    const messagesHook = useSharedMessages()
    const combinedCount = messagesHook.unreadCount || 0
    const onlineUsersCount = useOnlineUsersCount()
    const permittedRegions = usePermittedRegions(userId, regionCode, updatePreferences)
    const visibleMenuItems = useVisibleMenuItems(userId, regionType, regionCode)

    const groupFlags = useMemo(
        () => ({
            hasAdmin: visibleMenuItems.some((i) => ADMIN_ITEMS.includes(i.id)),
            hasAssets: visibleMenuItems.some((i) => ASSET_ITEMS.includes(i.id)),
            hasPeople: visibleMenuItems.some((i) => PEOPLE_ITEMS.includes(i.id)),
            hasTools: visibleMenuItems.some((i) => TOOLS_ITEMS.includes(i.id))
        }),
        [visibleMenuItems]
    )

    const standaloneItems = useMemo(
        () =>
            visibleMenuItems.filter(
                (i) =>
                    !ASSET_ITEMS.includes(i.id) &&
                    !(groupFlags.hasPeople && PEOPLE_ITEMS.includes(i.id)) &&
                    !(groupFlags.hasTools && TOOLS_ITEMS.includes(i.id)) &&
                    !(groupFlags.hasAdmin && ADMIN_ITEMS.includes(i.id))
            ),
        [visibleMenuItems, groupFlags]
    )

    const userInitials = useMemo(() => computeUserInitials(userName), [userName])

    const handleMenuClick = (id) => {
        onSelectView(id)
        setMobileMenuOpen(false)
    }

    const handleRegionChange = (e) => {
        const code = e.target.value
        if (!code) return
        const r = permittedRegions.find((x) => (x.regionCode || x.region_code) === code)
        if (!r) return
        const newRegion = {
            code: r.regionCode || r.region_code,
            name: r.regionName || r.region_name || '',
            type: r.type || r.region_type || ''
        }
        updatePreferences('selectedRegion', newRegion)
        window.dispatchEvent(new CustomEvent('region-changed', { detail: newRegion }))
    }

    // The rail's popovers open to its right, level with the button's bottom
    // edge, so they never cover the rail itself.
    const anchorBeside = (el) => {
        const rect = el.getBoundingClientRect()
        return { bottom: Math.max(8, window.innerHeight - rect.bottom), left: rect.right + 8, useLeft: true }
    }

    const handleShowNotifications = (e) => {
        setNotificationsAnchor(anchorBeside(e.currentTarget))
        setShowNotifications(true)
    }

    const handleShowOnlineUsers = (e) => {
        setOnlineUsersAnchor(anchorBeside(e.currentTarget))
        setShowOnlineUsers(true)
    }

    const modals = (
        <>
            {showNotifications && (
                <NotificationsModal
                    isOpen={showNotifications}
                    messagesHook={messagesHook}
                    onClose={() => {
                        setShowNotifications(false)
                        window.dispatchEvent(new CustomEvent('messages-refresh'))
                    }}
                    onViewAll={() => {
                        setShowNotifications(false)
                        handleMenuClick('Notifications')
                    }}
                    onSelectConversation={(otherId) => {
                        setShowNotifications(false)
                        onSelectView('Notifications', { initialConversationId: otherId })
                    }}
                    anchorRect={notificationsAnchor}
                />
            )}
            {showOnlineUsers && (
                <OnlineUsersModal
                    isOpen={showOnlineUsers}
                    onClose={() => setShowOnlineUsers(false)}
                    anchorRect={onlineUsersAnchor}
                />
            )}
        </>
    )

    const railProps = {
        accentColor,
        combinedCount,
        groupFlags,
        onMenuClick: handleMenuClick,
        onRegionChange: handleRegionChange,
        onlineUsersCount,
        permittedRegions,
        regionCode,
        selectedView,
        standaloneItems,
        userInitials,
        userName,
        visibleMenuItems
    }

    if (isMobile) {
        return (
            <>
                <NavigationMobile {...railProps} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen}>
                    {children}
                </NavigationMobile>
                {modals}
            </>
        )
    }

    return (
        <>
            <NavigationSidebar
                {...railProps}
                compact={isTablet || isCompactPreference}
                // Tablets always get the icon rail, so the toggle only shows
                // where the preference decides. It writes the same setting
                // as Preferences > Navigation, so the two never disagree.
                onToggleCompact={
                    isTablet
                        ? undefined
                        : () => updatePreferences('navStyle', isCompactPreference ? 'top_bar_basic' : 'two_level_tabs')
                }
                footer={footer}
                onShowNotifications={handleShowNotifications}
                onShowOnlineUsers={handleShowOnlineUsers}
            >
                {children}
            </NavigationSidebar>
            {modals}
        </>
    )
}
