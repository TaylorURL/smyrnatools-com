import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock useOpportunities before the component imports it
vi.mock('../../../../hooks/useOpportunities', () => ({
    useOpportunities: vi.fn()
}))

// Use cards mode so the existing board/drawer tests work unchanged.
vi.mock('../../../../hooks/useCrmViewMode', () => ({
    useCrmViewMode: vi.fn(() => ['cards', vi.fn()])
}))

// Mock CrmService so drawer fetch calls are intercepted
vi.mock('../../../../../services/CrmService', () => ({
    default: {
        fetchAccount: vi.fn(),
        logInteraction: vi.fn()
    }
}))

import CrmService from '../../../../../services/CrmService'
import { useOpportunities } from '../../../../hooks/useOpportunities'
import { CrmPipelinePage } from '../CrmPipelinePage'

const ACCOUNT_ID = 'acct-drawer-001'

const makeOpp = (overrides = {}) => ({
    account_id: ACCOUNT_ID,
    account_name: 'Drawer Test Co',
    id: 'opp-001',
    stage: 'new',
    title: 'Test deal',
    ...overrides
})

const mockHookReturn = (overrides = {}) => ({
    error: null,
    isLoading: false,
    materialize: vi.fn(),
    move: vi.fn(),
    opportunities: [],
    reload: vi.fn(),
    remove: vi.fn(),
    save: vi.fn(),
    ...overrides
})

const makeAccountPayload = () => ({
    account: {
        id: ACCOUNT_ID,
        lifecycle_stage: 'customer',
        name: 'Drawer Test Co',
        phone: null,
        plant_codes: [],
        sales_rep_user_id: null
    },
    contacts: [],
    interactions: []
})

beforeEach(() => {
    vi.clearAllMocks()
    CrmService.fetchAccount.mockResolvedValue(makeAccountPayload())
    CrmService.logInteraction.mockResolvedValue({ id: 'new-row' })
})

describe('CrmPipelinePage — account detail drawer wiring', () => {
    it('clicking a card body opens the drawer and calls fetchAccount with the card account_id', async () => {
        useOpportunities.mockReturnValue(
            mockHookReturn({
                opportunities: [makeOpp()]
            })
        )
        render(<CrmPipelinePage accentColor="#2563eb" />)

        // Find the card root by its aria-label
        const cardRoot = screen.getByRole('button', { name: /open test deal/i })
        fireEvent.click(cardRoot)

        await waitFor(() => {
            expect(CrmService.fetchAccount).toHaveBeenCalledWith(ACCOUNT_ID)
        })

        // Drawer renders the account name in the panel heading after fetch
        await waitFor(() => {
            // account name appears in both the card subtitle and the drawer h2; verify the h2 exists
            const headings = screen.getAllByText('Drawer Test Co')
            const drawerHeading = headings.find((el) => el.tagName === 'H2')
            expect(drawerHeading).toBeTruthy()
        })
    })

    it('clicking a move chip calls move and does NOT open the drawer', async () => {
        const move = vi.fn()
        useOpportunities.mockReturnValue(
            mockHookReturn({
                move,
                opportunities: [makeOpp()]
            })
        )
        render(<CrmPipelinePage accentColor="#2563eb" />)

        fireEvent.click(screen.getByRole('button', { name: /move to contacted/i }))

        expect(move).toHaveBeenCalledWith(expect.objectContaining({ id: 'opp-001' }), 'contacted')

        // fetchAccount should NOT have been called — drawer was not opened
        expect(CrmService.fetchAccount).not.toHaveBeenCalled()
    })
})
