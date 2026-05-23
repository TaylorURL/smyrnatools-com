/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'

import { UserPresenceService } from '../../../services/UserPresenceService'

const MILLISECONDS_PER_MINUTE = 60000
const MILLISECONDS_PER_HOUR = 3600000
const MILLISECONDS_PER_DAY = 86400000

function formatLastActivity(lastActivity) {
    if (!lastActivity) return 'Unknown'
    const diffMs = Date.now() - new Date(lastActivity).getTime()
    const diffMins = Math.floor(diffMs / MILLISECONDS_PER_MINUTE)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMs / MILLISECONDS_PER_HOUR)
    if (diffHours < 24) return `${diffHours}h ago`
    return `${Math.floor(diffMs / MILLISECONDS_PER_DAY)}d ago`
}

function OnlineUsersModal({ isOpen, onClose, anchorRect }) {
    const [onlineUsers, setOnlineUsers] = useState(() => UserPresenceService.getOnlineUsers())
    const [regionNames, setRegionNames] = useState(() => UserPresenceService.getRegionNames())
    const [roleColorMap, setRoleColorMap] = useState(() => UserPresenceService.getRoleColorMap())
    const [isLoading, setIsLoading] = useState(() => UserPresenceService.getIsLoading())

    useEffect(() => {
        if (!isOpen) return
        setOnlineUsers(UserPresenceService.getOnlineUsers())
        setRegionNames(UserPresenceService.getRegionNames())
        setRoleColorMap(UserPresenceService.getRoleColorMap())
        setIsLoading(UserPresenceService.getIsLoading())
        UserPresenceService.refreshOnlineUsers(true)
        const handleUpdate = (snapshot) => {
            setOnlineUsers(snapshot.users)
            setRegionNames(snapshot.regionNames)
            setRoleColorMap(snapshot.roleColorMap)
            setIsLoading(snapshot.isLoading)
        }
        UserPresenceService.addOnlineUsersListener(handleUpdate)
        return () => UserPresenceService.removeOnlineUsersListener(handleUpdate)
    }, [isOpen])

    if (!isOpen) return null

    /* Position is runtime-computed from anchorRect, must stay inline */
    const modalStyle = {
        position: 'fixed',
        zIndex: 1000,
        ...(anchorRect?.useLeft
            ? { bottom: anchorRect.bottom, left: anchorRect.left }
            : {
                  right: anchorRect ? window.innerWidth - anchorRect.right : '16px',
                  top: anchorRect ? anchorRect.bottom + 8 : '80px'
              })
    }

    const modal = (
        <div className="fixed inset-0 z-[999]" onClick={onClose}>
            <div
                style={{
                    ...modalStyle,
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 6
                }}
                className="flex max-h-[70vh] w-80 flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex shrink-0 items-center justify-between px-3 py-2 border-b border-border-light">
                    <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded bg-bg-tertiary text-text-secondary">
                            <i className="fas fa-users text-[11px]" />
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                            Online Users
                        </span>
                        {!isLoading && (
                            <span className="font-mono tabular-nums rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider bg-bg-tertiary text-text-secondary">
                                {onlineUsers.length}
                            </span>
                        )}
                    </div>
                    <button
                        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-bg-tertiary text-text-secondary"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <i className="fas fa-times text-[11px]" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {isLoading && onlineUsers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-text-tertiary">
                            <i className="fas fa-spinner fa-spin mb-2 text-xl" />
                            <span className="text-[12px]">Loading users…</span>
                        </div>
                    ) : onlineUsers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-text-tertiary">
                            <i className="fas fa-user-slash mb-2 text-2xl" />
                            <span className="text-[12px] font-semibold text-text-primary">No users online</span>
                        </div>
                    ) : (
                        <div>
                            {onlineUsers.map((user) => {
                                const roleColor =
                                    (user.roles?.[0] && roleColorMap[user.roles[0].toLowerCase()]) ?? '#64748b'
                                const tintBg = roleColor.startsWith('hsl')
                                    ? roleColor.replace('hsl(', 'hsla(').replace(')', ', 0.12)')
                                    : `${roleColor}1f`
                                return (
                                    <div
                                        key={user.id}
                                        className="px-3 py-2 transition-colors hover:bg-bg-tertiary border-b border-border-light"
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <div className="relative shrink-0">
                                                <div className="flex h-7 w-7 items-center justify-center rounded bg-bg-tertiary text-text-secondary">
                                                    <i className="fas fa-user text-[11px]" />
                                                </div>
                                                <div
                                                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-600"
                                                    style={{ border: '2px solid var(--bg-primary)' }}
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <span className="block truncate text-[12px] font-semibold text-text-primary">
                                                    {user.name || 'Unknown User'}
                                                    {user.isCurrentUser && (
                                                        <span className="ml-1 font-normal text-text-tertiary">
                                                            (You)
                                                        </span>
                                                    )}
                                                </span>
                                                <div className="mt-0.5 flex items-center gap-1.5">
                                                    {user.roles?.length > 0 && (
                                                        <span
                                                            className="force-white-text rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider"
                                                            style={{ background: roleColor }}
                                                        >
                                                            {user.roles[0]}
                                                        </span>
                                                    )}
                                                    {user.regionCode && (
                                                        <span className="text-[10.5px] text-text-secondary">
                                                            {regionNames[user.regionCode] || user.regionCode}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-text-tertiary">
                                                    <span className="flex items-center gap-1">
                                                        {(user.activeDevices || ['desktop']).map((d) => (
                                                            <i
                                                                key={d}
                                                                className={`fas fa-${d === 'mobile' ? 'mobile-alt' : 'desktop'} text-[9px]`}
                                                            />
                                                        ))}
                                                    </span>
                                                    <span className="font-mono tabular-nums">
                                                        Active {formatLastActivity(user.lastActivity)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
    return ReactDOM.createPortal(modal, document.body)
}

export default OnlineUsersModal
