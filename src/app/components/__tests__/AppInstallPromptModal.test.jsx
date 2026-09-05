import { act, render, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The session id is held in memory and put there by AuthContext after a round
// trip, so a mounting modal always reads an empty one. Driving it from a
// mutable holder lets a test move it the way a restore does.
const session = { userId: null }

vi.mock('../../../services/SessionService', () => ({
    getSessionUserId: () => session.userId
}))

const canShowInstallPrompt = vi.fn(() => true)
const detectDeviceType = vi.fn(() => 'mobile')
const shouldShowPrompt = vi.fn(async () => true)

vi.mock('../../../services/UserPreferencesService', () => ({
    UserPreferencesService: {
        canShowInstallPrompt: () => canShowInstallPrompt(),
        detectDeviceType: () => detectDeviceType(),
        dismissForever: async () => {},
        markAsInstalled: async () => {},
        remindLater: async () => {},
        shouldShowPrompt: (id, type) => shouldShowPrompt(id, type)
    }
}))

const getUserRoles = vi.fn(async () => [{ name: 'admin' }])

vi.mock('../../../services/UserService', () => ({
    UserService: { getUserRoles: (id) => getUserRoles(id) }
}))

vi.mock('../../hooks/useAccentColor', () => ({ useAccentColor: () => '#000000' }))

const AppInstallPromptModal = (await import('../common/AppInstallPromptModal')).default

const signIn = async () => {
    session.userId = 'user-1'
    await act(async () => {
        window.dispatchEvent(new CustomEvent('authSuccess', { detail: { userId: 'user-1' } }))
    })
}

describe('AppInstallPromptModal', () => {
    beforeEach(() => {
        session.userId = null
        vi.clearAllMocks()
        getUserRoles.mockResolvedValue([{ name: 'admin' }])
        shouldShowPrompt.mockResolvedValue(true)
        canShowInstallPrompt.mockReturnValue(true)
    })

    it('runs its check when the session arrives after mount', async () => {
        render(<AppInstallPromptModal />)
        await act(async () => {})
        expect(getUserRoles).not.toHaveBeenCalled()

        await signIn()
        await waitFor(() => expect(shouldShowPrompt).toHaveBeenCalledWith('user-1', 'mobile_install'))
    })

    it('checks once per mount, so a second announcement queues nothing', async () => {
        render(<AppInstallPromptModal />)
        await signIn()
        await waitFor(() => expect(getUserRoles).toHaveBeenCalledTimes(1))

        await signIn()
        await act(async () => {})
        expect(getUserRoles).toHaveBeenCalledTimes(1)
    })

    it('stays out of the way of a guest', async () => {
        getUserRoles.mockResolvedValue([{ name: 'Guest' }])
        render(<AppInstallPromptModal />)
        await signIn()
        await waitFor(() => expect(getUserRoles).toHaveBeenCalledTimes(1))
        expect(shouldShowPrompt).not.toHaveBeenCalled()
    })
})
