import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../services/CrmService', () => ({
    default: { bulkAssignSalesReps: vi.fn() }
}))

vi.mock('../../../../../services/UserService', () => ({
    UserService: {
        getAllUsersWithProfilesAndRoles: vi.fn()
    }
}))

import CrmService from '../../../../../services/CrmService'
import { UserService } from '../../../../../services/UserService'
import { BulkAssignSalesRepsModal } from '../BulkAssignSalesRepsModal'

const USERS = [
    { id: 'u1', firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com', roleWeight: 10 },
    { id: 'u2', firstName: 'John', lastName: 'Doe', email: 'john@test.com', roleWeight: 10 }
]

describe('BulkAssignSalesRepsModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        UserService.getAllUsersWithProfilesAndRoles.mockResolvedValue(USERS)
        CrmService.bulkAssignSalesReps.mockResolvedValue({ matched: 1, unmatched: [] })
    })

    it('renders the textarea and Assign button', async () => {
        render(<BulkAssignSalesRepsModal accentColor="#2563eb" onClose={vi.fn()} onDone={vi.fn()} />)
        expect(screen.getByRole('textbox', { name: /assignments text/i })).toBeInTheDocument()
        await waitFor(() => expect(screen.getByRole('button', { name: /assign/i })).toBeInTheDocument())
    })

    it('pasting a valid line and clicking Assign calls CrmService.bulkAssignSalesReps', async () => {
        const onDone = vi.fn()
        render(<BulkAssignSalesRepsModal accentColor="#2563eb" onClose={vi.fn()} onDone={onDone} />)

        // Wait for the user roster to load so name resolution works
        await waitFor(() => expect(UserService.getAllUsersWithProfilesAndRoles).toHaveBeenCalled())

        const textarea = screen.getByRole('textbox', { name: /assignments text/i })
        fireEvent.change(textarea, { target: { value: '12345, Jane Smith' } })

        const assignBtn = screen.getByRole('button', { name: /assign/i })
        fireEvent.click(assignBtn)

        await waitFor(() => {
            expect(CrmService.bulkAssignSalesReps).toHaveBeenCalledWith([{ customerNum: '12345', repUserId: 'u1' }])
        })
    })

    it('shows an error when no valid assignments can be parsed', async () => {
        render(<BulkAssignSalesRepsModal accentColor="#2563eb" onClose={vi.fn()} onDone={vi.fn()} />)
        await waitFor(() => expect(UserService.getAllUsersWithProfilesAndRoles).toHaveBeenCalled())

        const textarea = screen.getByRole('textbox', { name: /assignments text/i })
        // Rep name doesn't match any user
        fireEvent.change(textarea, { target: { value: '12345, Nobody Here' } })

        fireEvent.click(screen.getByRole('button', { name: /assign/i }))

        await waitFor(() => {
            expect(screen.getByText(/no valid lines found/i)).toBeInTheDocument()
        })
        expect(CrmService.bulkAssignSalesReps).not.toHaveBeenCalled()
    })

    it('calls onClose when the Cancel button is clicked', async () => {
        const onClose = vi.fn()
        render(<BulkAssignSalesRepsModal accentColor="#2563eb" onClose={onClose} onDone={vi.fn()} />)
        fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
        expect(onClose).toHaveBeenCalled()
    })

    it('shows matched count after successful assignment', async () => {
        render(<BulkAssignSalesRepsModal accentColor="#2563eb" onClose={vi.fn()} onDone={vi.fn()} />)
        await waitFor(() => expect(UserService.getAllUsersWithProfilesAndRoles).toHaveBeenCalled())

        fireEvent.change(screen.getByRole('textbox', { name: /assignments text/i }), {
            target: { value: 'Acme Paving, Jane Smith' }
        })
        fireEvent.click(screen.getByRole('button', { name: /assign/i }))

        await waitFor(() => {
            expect(screen.getByText(/1 assignment applied/i)).toBeInTheDocument()
        })
    })
})
