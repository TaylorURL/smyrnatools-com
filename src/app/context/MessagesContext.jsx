import React, { createContext, useContext } from 'react'

import { useMessages } from '../hooks/useMessages'

const MessagesContext = createContext(null)

/**
 * Provides a single shared useMessages instance to the component tree.
 *
 * Every consumer reads the same subscription and state, so the unread badge
 * in the navigation bar cannot drift away from what the notifications and
 * account views show.
 */
export function MessagesProvider({ userId, children }) {
    const messagesHook = useMessages(userId)
    return <MessagesContext.Provider value={messagesHook}>{children}</MessagesContext.Provider>
}

/** @returns The shared messages hook (conversations, unreadCount, markAsRead, etc.) */
export function useSharedMessages() {
    const context = useContext(MessagesContext)
    if (!context) throw new Error('useSharedMessages must be used within a MessagesProvider')
    return context
}
