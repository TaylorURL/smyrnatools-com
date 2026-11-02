/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom'

import { UserPresenceService } from '../../../services/UserPresenceService'
import { useUserAccents } from '../../hooks/useUserAccent'
import UserAvatar from './UserAvatar'

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

    useEffect(() => {
        if (!isOpen) return
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [isOpen, onClose])

    const onlineUserIds = useMemo(() => onlineUsers.map((u) => u.id), [onlineUsers])
    const accentByUserId = useUserAccents(onlineUserIds)

    if (!isOpen) return null

    /* Position is runtime-computed from anchorRect, must stay inline */
    const modalStyle = {
        position: 'fixed',
        zIndex: 'var(--z-panel)',
        ...(anchorRect?.useLeft
            ? { bottom: anchorRect.bottom, left: anchorRect.left }
            : {
                  right: anchorRect ? window.innerWidth - anchorRect.right : '16px',
                  top: anchorRect ? anchorRect.bottom + 8 : '80px'
              })
    }

    const modal = (
        <div className="fixed inset-0 z-backdrop">
            <button
                type="button"
                aria-label="Close online users"
                className="absolute inset-0 cursor-default"
                onClick={onClose}
            />
            <div
                role="dialog"
                aria-modal="false"
                aria-label="Online users"
                style={modalStyle}
                className="flex max-h-[76vh] w-96 max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-card border border-border-light bg-bg-primary shadow-modal animate-fade-slide-in motion-reduce:animate-none"
            >
                <div className="flex shrink-0 items-center gap-2 border-b border-border-light py-2 pl-4 pr-2">
                    <span className="text-[14px] font-semibold text-text-primary">Online now</span>
                    {!isLoading && (
                        <span className="text-[12px] tabular-nums text-text-secondary">{onlineUsers.length}</span>
                    )}
                    <button
                        type="button"
                        className="ml-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-[4px] border-none bg-transparent text-text-secondary transition-colors duration-150 ease-out hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
                        onClick={onClose}
                        aria-label="Close online users"
                    >
                        <i className="fas fa-times text-[12px]" aria-hidden="true" />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                    {isLoading && onlineUsers.length === 0 ? (
                        <div className="flex items-center justify-center gap-2 px-4 py-10 text-[13px] text-text-secondary">
                            <i className="fas fa-spinner fa-spin text-[12px]" aria-hidden="true" />
                            Loading people
                        </div>
                    ) : onlineUsers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-1 px-4 py-10 text-center">
                            <p className="m-0 text-[15px] font-medium text-text-primary">No users online</p>
                            <p className="m-0 text-[13px] text-text-secondary">
                                People show up here while they have the app open.
                            </p>
                        </div>
                    ) : (
                        <div role="list">
                            {onlineUsers.map((user) => {
                                /* Source data occasionally repeats the same role on a user
                                 * — usually from a join hitting both a role assignment row
                                 * and the role's name string with mismatched casing. Dedupe
                                 * case-insensitively here so the role line reads once-per-
                                 * role, keeping the first encountered casing for display. */
                                const uniqueRoles = []
                                const seenRoleKeys = new Set()
                                for (const role of user.roles || []) {
                                    if (!role) continue
                                    const key = String(role).trim().toLowerCase()
                                    if (!key || seenRoleKeys.has(key)) continue
                                    seenRoleKeys.add(key)
                                    uniqueRoles.push(role)
                                }
                                const roleColor =
                                    (uniqueRoles[0] && roleColorMap[uniqueRoles[0].toLowerCase()]) ??
                                    'var(--role-other)'
                                const region = user.regionCode ? regionNames[user.regionCode] || user.regionCode : ''
                                return (
                                    <div
                                        key={user.id}
                                        role="listitem"
                                        className="flex items-center gap-3 border-b border-border-light px-4 py-2.5 transition-colors duration-150 ease-out last:border-b-0 hover:bg-bg-hover motion-reduce:transition-none"
                                    >
                                        <UserAvatar name={user.name} accentColor={accentByUserId[user.id]} size="md">
                                            <span
                                                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg-primary bg-status-active"
                                                aria-hidden="true"
                                            />
                                        </UserAvatar>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-baseline justify-between gap-3">
                                                <span className="truncate text-[13px] font-medium text-text-primary">
                                                    {user.name || 'Unknown User'}
                                                    {user.isCurrentUser && (
                                                        <span className="ml-1 font-normal text-text-tertiary">
                                                            (you)
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="flex shrink-0 items-center gap-1.5 text-[12px] tabular-nums text-text-tertiary">
                                                    {(user.activeDevices || ['desktop']).map((d) => (
                                                        <i
                                                            key={d}
                                                            className={`fas fa-${d === 'mobile' ? 'mobile-alt' : 'desktop'} text-[10px]`}
                                                            aria-hidden="true"
                                                        />
                                                    ))}
                                                    {formatLastActivity(user.lastActivity)}
                                                </span>
                                            </div>
                                            {(uniqueRoles.length > 0 || region) && (
                                                <div className="flex min-w-0 items-center gap-x-2 text-[12px] text-text-secondary">
                                                    {uniqueRoles.map((role) => (
                                                        <span
                                                            key={role.toLowerCase()}
                                                            className="inline-flex shrink-0 items-center gap-1.5"
                                                        >
                                                            <span
                                                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                                                style={{
                                                                    background:
                                                                        roleColorMap[role.toLowerCase()] ?? roleColor
                                                                }}
                                                                aria-hidden="true"
                                                            />
                                                            {role}
                                                        </span>
                                                    ))}
                                                    {region && (
                                                        <span className="min-w-0 truncate">
                                                            {uniqueRoles.length > 0 && (
                                                                <span className="mr-2" aria-hidden="true">
                                                                    ·
                                                                </span>
                                                            )}
                                                            {region}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
                <div className="shrink-0 border-t border-border-light">
                    <button
                        type="button"
                        onClick={() => UserPresenceService.refreshOnlineUsers(true)}
                        className="flex w-full cursor-pointer items-center border-none bg-transparent px-4 py-2.5 text-left text-[13px] font-medium text-text-primary underline-offset-2 transition-colors duration-150 ease-out hover:bg-bg-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent motion-reduce:transition-none"
                    >
                        Refresh list
                    </button>
                </div>
            </div>
        </div>
    )
    return ReactDOM.createPortal(modal, document.body)
}

export default OnlineUsersModal
