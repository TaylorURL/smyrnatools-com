/* eslint-disable react/forbid-dom-props */
import React from 'react'

import UserAvatar from '../UserAvatar'

/** Compact icon button used in the two-level header for messages/users. */
export function TwoLevelIconButton({
    title,
    iconClasses,
    onClick,
    accentColor,
    badge = 0,
    badgeColor = '#ef4444',
    width = 34
}) {
    return (
        <button
            className="relative flex items-center justify-center cursor-pointer bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgba(255,255,255,0.7)] h-[34px]"
            title={title}
            style={{ gap: 4, outline: 'none', width }}
            onClick={onClick}
        >
            {iconClasses.map((cls) => (
                <i key={cls.name} className={`fas ${cls.name}`} style={{ fontSize: cls.size }} />
            ))}
            {badge > 0 && (
                <span
                    className="force-white-text absolute flex items-center justify-center rounded-full font-bold h-4"
                    style={{
                        backgroundColor: badgeColor,
                        border: `2px solid ${accentColor}`,
                        color: 'white',
                        fontSize: 9,
                        minWidth: 16,
                        right: -4,
                        top: -4
                    }}
                >
                    {badge}
                </span>
            )}
        </button>
    )
}

/** Avatar pill in the two-level header that opens the user's account view.
 *  Renders the viewer's own initials on their accent colour. */
export function TwoLevelUserAvatar({ accentColor, initials, title, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className="cursor-pointer border border-[rgba(255,255,255,0.1)] rounded-lg p-0"
            style={{ background: 'transparent' }}
        >
            <UserAvatar accentColor={accentColor} initials={initials} size={34} rounded="lg" />
        </button>
    )
}

/** Messages icon button in the top-bar header — wider to fit bell + envelope. */
export function TopBarMessagesButton({ onClick, combinedCount, accentColor, isTablet }) {
    return (
        <div
            className="items-center bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] cursor-pointer flex justify-center relative"
            style={{
                borderRadius: isTablet ? '8px' : '12px',
                color: 'white',
                flexShrink: 0,
                gap: isTablet ? '3px' : '4px',
                height: isTablet ? '32px' : '42px',
                transition: 'all 0.2s ease',
                width: isTablet ? '40px' : '52px'
            }}
            onClick={onClick}
            title="Messages"
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'
                e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
                e.currentTarget.style.transform = 'translateY(0)'
            }}
        >
            <i className="fas fa-bell" style={{ fontSize: isTablet ? '12px' : '14px' }} />
            <i className="fas fa-envelope" style={{ fontSize: isTablet ? '11px' : '13px' }} />
            {combinedCount > 0 && (
                <span
                    className="force-white-text items-center bg-red-500 rounded-[10px] flex font-bold justify-center absolute"
                    style={{
                        border: `2px solid ${accentColor}`,
                        boxShadow: '0 2px 8px #ef444466',
                        color: 'white',
                        fontSize: isTablet ? '9px' : '11px',
                        height: isTablet ? '16px' : '20px',
                        minWidth: isTablet ? '16px' : '20px',
                        padding: '0 4px',
                        right: '-4px',
                        top: '-4px'
                    }}
                >
                    {combinedCount}
                </span>
            )}
        </div>
    )
}

/** Square icon button in the top-bar header (online users / account). */
export function TopBarIconButton({
    icon,
    title,
    onClick,
    isActive = false,
    badge = null,
    badgeColor = '#ef4444',
    tutorialTarget = null,
    isTablet,
    accentColor
}) {
    return (
        <div
            className="items-center cursor-pointer flex justify-center relative"
            style={{
                backgroundColor: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                border: isActive ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: isTablet ? '8px' : '12px',
                color: 'white',
                flexShrink: 0,
                height: isTablet ? '32px' : '42px',
                transition: 'all 0.2s ease',
                width: isTablet ? '32px' : '42px'
            }}
            onClick={onClick}
            title={title}
            data-tutorial-target={tutorialTarget}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'
                e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'
                e.currentTarget.style.transform = 'translateY(0)'
            }}
        >
            <i className={`fas ${icon}`} style={{ fontSize: isTablet ? '13px' : '16px' }}></i>
            {badge > 0 && (
                <span
                    className="force-white-text items-center rounded-[10px] flex font-bold justify-center absolute"
                    style={{
                        backgroundColor: badgeColor,
                        border: `2px solid ${accentColor}`,
                        boxShadow: `0 2px 8px ${badgeColor}66`,
                        color: 'white',
                        fontSize: isTablet ? '9px' : '11px',
                        height: isTablet ? '16px' : '20px',
                        minWidth: isTablet ? '16px' : '20px',
                        padding: '0 4px',
                        right: '-4px',
                        top: '-4px'
                    }}
                >
                    {badge}
                </span>
            )}
        </div>
    )
}
