import { act, render, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The session id is held in memory and put there by AuthContext after a round
// trip, so a mounting provider always reads an empty one. Driving it from a
// mutable holder lets a test move it the way a restore does.
const session = { userId: null }

vi.mock('../../../services/SessionService', () => ({
    getSessionUserId: () => session.userId
}))

const getUserPreferences = vi.fn(async () => ({ tutorials: false }))
const getDismissedTutorials = vi.fn(async () => [])

vi.mock('../../../services/UserPreferencesService', () => ({
    UserPreferencesService: {
        dismissTutorial: async () => {},
        getDismissedTutorials: () => getDismissedTutorials(),
        getUserPreferences: (id) => getUserPreferences(id),
        resetAllTutorials: async () => {},
        resetTutorial: async () => {}
    }
}))

const { TutorialProvider, useTutorial } = await import('../TutorialContext')

let tutorial = null

function Probe() {
    tutorial = useTutorial()
    return <div data-testid="active">{tutorial.activeTutorial || 'none'}</div>
}

const renderProvider = () =>
    render(
        <TutorialProvider>
            <Probe />
        </TutorialProvider>
    )

describe('TutorialProvider', () => {
    beforeEach(() => {
        session.userId = null
        vi.clearAllMocks()
        getUserPreferences.mockResolvedValue({ tutorials: false })
        getDismissedTutorials.mockResolvedValue([])
    })

    it('reads the tutorials preference when the session arrives after mount', async () => {
        const { getByTestId } = renderProvider()
        await waitFor(() => expect(getDismissedTutorials).toHaveBeenCalled())
        expect(getUserPreferences).not.toHaveBeenCalled()

        session.userId = 'user-1'
        await act(async () => {
            window.dispatchEvent(new CustomEvent('authSuccess', { detail: { userId: 'user-1' } }))
        })
        await waitFor(() => expect(getUserPreferences).toHaveBeenCalledWith('user-1'))

        // The preference has to be in hand before the first trigger, since the
        // first tutorial of the load is the one a stale default leaks.
        await act(async () => {
            tutorial.triggerTutorial('probe')
        })
        expect(getByTestId('active')).toHaveTextContent('none')
    })

    it('shows a tutorial for a user who left them on', async () => {
        getUserPreferences.mockResolvedValue({ tutorials: true })
        const { getByTestId } = renderProvider()
        await waitFor(() => expect(getDismissedTutorials).toHaveBeenCalled())

        session.userId = 'user-1'
        await act(async () => {
            window.dispatchEvent(new CustomEvent('authSuccess', { detail: { userId: 'user-1' } }))
        })
        await waitFor(() => expect(getUserPreferences).toHaveBeenCalledWith('user-1'))

        await act(async () => {
            tutorial.triggerTutorial('probe')
        })
        expect(getByTestId('active')).toHaveTextContent('probe')
    })
})
