import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../services/CrmService', () => ({
    default: {
        fetchAccount: vi.fn(),
        logInteraction: vi.fn()
    }
}))

import CrmService from '../../../../../services/CrmService'
import { AccountDetailDrawer } from '../AccountDetailDrawer'

const ACCOUNT_ID = 'acct-001'

const makeFetchPayload = (overrides = {}) => ({
    account: {
        id: ACCOUNT_ID,
        lifecycle_stage: 'customer',
        name: 'Acme Paving',
        phone: null,
        plant_codes: ['101'],
        sales_rep_user_id: null,
        ...overrides.account
    },
    contacts: overrides.contacts ?? [
        {
            contact_name: 'Jane Doe',
            email: null,
            id: 'c1',
            is_primary: true,
            label: 'Office',
            phone_digits: '5551234',
            phone_display: '555-1234'
        }
    ],
    interactions: overrides.interactions ?? []
})

beforeEach(() => {
    vi.clearAllMocks()
    CrmService.fetchAccount.mockResolvedValue(makeFetchPayload())
    CrmService.logInteraction.mockResolvedValue({ id: 'new-interaction' })
})

describe('AccountDetailDrawer', () => {
    it('shows account name and the primary contact phone as a tap-to-call tel: link', async () => {
        render(<AccountDetailDrawer accountId={ACCOUNT_ID} accentColor="#2563eb" onClose={vi.fn()} />)

        // Wait for the fetch to resolve and content to render
        await waitFor(() => expect(screen.getByText('Acme Paving')).toBeInTheDocument())

        // Contact number rendered as a tap-to-call link visible without any tab switch
        const telLink = screen.getByRole('link', { name: /call 555-1234/i })
        expect(telLink).toHaveAttribute('href', 'tel:5551234')
    })

    it('shows the "No interactions logged yet." empty state in the activity stream', async () => {
        render(<AccountDetailDrawer accountId={ACCOUNT_ID} accentColor="#2563eb" onClose={vi.fn()} />)

        await waitFor(() => expect(screen.getByText('Acme Paving')).toBeInTheDocument())

        // In the two-column layout the timeline is always visible — no tab switch needed
        expect(screen.getByText(/no interactions logged yet/i)).toBeInTheDocument()
    })

    it('calls onClose when the close button is clicked', async () => {
        const onClose = vi.fn()
        render(<AccountDetailDrawer accountId={ACCOUNT_ID} accentColor="#2563eb" onClose={onClose} />)

        await waitFor(() => expect(screen.getByText('Acme Paving')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /close/i }))
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('submitting the log composer calls logInteraction then re-fetches', async () => {
        render(<AccountDetailDrawer accountId={ACCOUNT_ID} accentColor="#2563eb" onClose={vi.fn()} />)

        await waitFor(() => expect(screen.getByText('Acme Paving')).toBeInTheDocument())

        // The composer submit button is always in the DOM — no tab switch needed
        const logButtons = screen.getAllByRole('button', { name: /log interaction/i })
        fireEvent.click(logButtons[logButtons.length - 1])

        await waitFor(() => {
            expect(CrmService.logInteraction).toHaveBeenCalledWith(expect.objectContaining({ accountId: ACCOUNT_ID }))
        })

        // fetchAccount should now have been called twice (once on mount, once after log)
        await waitFor(() => {
            expect(CrmService.fetchAccount).toHaveBeenCalledTimes(2)
        })
    })

    it('shows both the account profile (name + tap-to-call) and the log composer simultaneously without any tab switch', async () => {
        render(<AccountDetailDrawer accountId={ACCOUNT_ID} accentColor="#2563eb" onClose={vi.fn()} />)

        await waitFor(() => expect(screen.getByText('Acme Paving')).toBeInTheDocument())

        // Profile side: name rendered in the top bar
        expect(screen.getByText('Acme Paving')).toBeInTheDocument()

        // Profile side: tap-to-call link visible without any interaction
        expect(screen.getByRole('link', { name: /call 555-1234/i })).toBeInTheDocument()

        // Activity side: log composer always present (two-column layout, no tabs)
        const logButtons = screen.getAllByRole('button', { name: /log interaction/i })
        expect(logButtons.length).toBeGreaterThanOrEqual(1)
    })
})
