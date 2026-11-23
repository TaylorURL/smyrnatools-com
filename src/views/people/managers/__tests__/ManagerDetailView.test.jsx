import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ManagerDetailView from '../ManagerDetailView'

/* `/auth-service/admin-update-password` refuses a weak password with a 400,
 * and the save path used to send one unconditionally — after the profile
 * write had already committed. These cover the three behaviours that fixed:
 * the pre-flight refusal, the untouched record behind it, and an honest
 * message when the server refuses a password the client accepted. */

vi.mock('../../../../app/components/sections/DetailViewSection', async () => {
    const react = await import('react')
    const R = react.default
    function DetailViewSection({ children, footerActions, message, onCanEditChange }) {
        // The real component decides edit permission from the plant the record
        // sits in; the save path is what these tests are about, so grant it.
        R.useEffect(() => {
            onCanEditChange?.(true)
        }, [onCanEditChange])
        return R.createElement(
            'div',
            null,
            message ? R.createElement('p', null, message) : null,
            children,
            footerActions
        )
    }
    DetailViewSection.Section = ({ children }) => R.createElement('div', null, children)
    DetailViewSection.Card = ({ children }) => R.createElement('div', null, children)
    return { default: DetailViewSection }
})

vi.mock('../../../../app/context/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'admin-1' } })
}))

vi.mock('../../../../app/context/PreferencesContext', () => ({
    usePreferences: () => ({ preferences: { selectedRegion: null } })
}))

const MANAGER = {
    additionalAssignedPlants: [],
    email: 'manager@example.com',
    firstName: 'Dana',
    id: 'manager-1',
    lastName: 'Reed',
    plantCode: 'P1',
    roleName: 'Manager',
    roleWeight: 10
}

vi.mock('../../../../app/hooks/useManagerDetailData', () => ({
    fetchManagerRecord: vi.fn(() => Promise.resolve({ ...MANAGER })),
    useAvailableRoles: () => ({
        availableRoles: [{ id: 'role-1', name: 'Manager', weight: 10 }],
        fetchRoles: vi.fn(() => Promise.resolve())
    }),
    useCurrentUserRoleWeight: () => ({ currentUserRoleWeight: 100, fetchCurrentUserRole: vi.fn() }),
    useFilteredPlants: () => [{ plant_code: 'P1', plant_name: 'Plant One' }],
    usePlants: () => ({
        fetchPlants: vi.fn(() => Promise.resolve()),
        plants: [{ plant_code: 'P1', plant_name: 'Plant One' }]
    }),
    useRegionPlantCodes: () => new Set(['P1'])
}))

vi.mock('../../../../services/DatabaseService', () => ({
    Database: {
        from: () => ({
            select: () => ({
                eq: () => ({ single: () => Promise.resolve({ data: { id: 'manager-1' }, error: null }) })
            })
        })
    }
}))

const updateManager = vi.fn(() => Promise.resolve(true))
vi.mock('../../../../services/UserService', () => ({
    UserService: {
        getUserRoles: () => Promise.resolve([]),
        updateManager: (...args) => updateManager(...args)
    }
}))

const post = vi.fn(() => Promise.resolve({ json: { success: true }, res: { ok: true } }))
vi.mock('../../../../utils/APIUtility', () => ({
    default: { post: (...args) => post(...args) }
}))

async function renderView() {
    render(<ManagerDetailView managerId="manager-1" onClose={vi.fn()} />)
    await screen.findByText('Change Password')
}

function openPasswordField() {
    fireEvent.click(screen.getByText('Change Password'))
}

describe('ManagerDetailView password change', () => {
    beforeEach(() => {
        updateManager.mockClear()
        post.mockClear()
    })

    it('refuses a weak password before writing anything, and says what is required', async () => {
        await renderView()
        openPasswordField()
        fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'password' } })
        fireEvent.click(screen.getByText('Save'))

        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
        expect(screen.getByRole('alert').textContent).toMatch(/too weak/i)
        expect(screen.getByRole('alert').textContent).toMatch(/at least 12 characters/i)
        // The profile write commits before the password call, so a password the
        // server would refuse must not get as far as either request.
        expect(updateManager).not.toHaveBeenCalled()
        expect(post).not.toHaveBeenCalled()
    })

    it('rejects a symbol the server does not count towards strength', async () => {
        await renderView()
        openPasswordField()
        // `-` is outside the server's special-character set, so this scores 3
        // there and is refused; the client used to score it 4 and send it.
        fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'Abcdefghij-' } })
        fireEvent.click(screen.getByText('Save'))

        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
        expect(updateManager).not.toHaveBeenCalled()
        expect(post).not.toHaveBeenCalled()
    })

    it('saves a password that meets the rule', async () => {
        await renderView()
        openPasswordField()
        fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'Str0ng!Passphrase' } })
        fireEvent.click(screen.getByText('Save'))

        await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
        expect(updateManager).toHaveBeenCalledTimes(1)
        expect(post.mock.calls[0][0]).toBe('/auth-service/admin-update-password')
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('reports a server-side refusal as the partial save it is', async () => {
        post.mockImplementationOnce(() =>
            Promise.resolve({ json: { error: 'Password is too weak' }, res: { ok: false } })
        )
        await renderView()
        openPasswordField()
        fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'Str0ng!Passphrase' } })
        fireEvent.click(screen.getByText('Save'))

        // The details are already on the server by this point, so the message
        // must not claim the save failed outright.
        await waitFor(() => expect(screen.getByText(/Details saved/)).toBeInTheDocument())
        expect(screen.getByText(/The password was not changed: Password is too weak/)).toBeInTheDocument()
        expect(screen.queryByText(/Error saving changes/)).not.toBeInTheDocument()
    })
})
