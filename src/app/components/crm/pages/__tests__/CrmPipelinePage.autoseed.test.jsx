import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../hooks/useOpportunities', () => ({
    useOpportunities: vi.fn()
}))

// Use cards mode so the existing virtual-card tests work unchanged.
vi.mock('../../../../hooks/useCrmViewMode', () => ({
    useCrmViewMode: vi.fn(() => ['cards', vi.fn()])
}))

import { useOpportunities } from '../../../../hooks/useOpportunities'
import { CrmPipelinePage } from '../CrmPipelinePage'

const makeVirtualOpp = (overrides = {}) => ({
    account_id: 'a1',
    account_name: 'Dormant Co',
    id: 'virtual:prospect:a1',
    owner_user_id: 'u1',
    source: 'prospect',
    stage: 'new',
    title: 'Suggested outreach',
    virtual: true,
    ...overrides
})

const makeRealOpp = (overrides = {}) => ({
    account_id: 'a2',
    account_name: 'Active Corp',
    id: 'real-uuid-001',
    stage: 'new',
    title: 'Active deal',
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

beforeEach(() => vi.clearAllMocks())

describe('CrmPipelinePage — virtual / suggested cards', () => {
    it('renders the "Suggested" chip on a virtual new card', () => {
        useOpportunities.mockReturnValue(
            mockHookReturn({
                opportunities: [makeVirtualOpp()]
            })
        )
        render(<CrmPipelinePage accentColor="#2563eb" />)
        expect(screen.getByText('Suggested')).toBeInTheDocument()
    })

    it('does NOT render the "Suggested" chip on a real card', () => {
        useOpportunities.mockReturnValue(
            mockHookReturn({
                opportunities: [makeRealOpp()]
            })
        )
        render(<CrmPipelinePage accentColor="#2563eb" />)
        expect(screen.queryByText('Suggested')).not.toBeInTheDocument()
    })

    it('clicking a move chip on a virtual card calls move with the opp object and target stage', () => {
        const move = vi.fn()
        const opp = makeVirtualOpp()
        useOpportunities.mockReturnValue(mockHookReturn({ move, opportunities: [opp] }))
        render(<CrmPipelinePage accentColor="#2563eb" />)

        fireEvent.click(screen.getByRole('button', { name: /move to contacted/i }))

        expect(move).toHaveBeenCalledWith(expect.objectContaining({ virtual: true }), 'contacted')
    })

    it('clicking a move chip on a virtual card passes the full opp object (not just an id)', () => {
        const move = vi.fn()
        const opp = makeVirtualOpp()
        useOpportunities.mockReturnValue(mockHookReturn({ move, opportunities: [opp] }))
        render(<CrmPipelinePage accentColor="#2563eb" />)

        fireEvent.click(screen.getByRole('button', { name: /move to quoted/i }))

        const [calledOpp] = move.mock.calls[0]
        // The full object should be passed — not just a string id
        expect(typeof calledOpp).toBe('object')
        expect(calledOpp.id).toBe('virtual:prospect:a1')
        expect(calledOpp.account_id).toBe('a1')
        expect(calledOpp.source).toBe('prospect')
    })

    it('a virtual won card renders a "Confirm won" button instead of move chips', () => {
        useOpportunities.mockReturnValue(
            mockHookReturn({
                opportunities: [makeVirtualOpp({ id: 'virtual:order:a1', stage: 'won' })]
            })
        )
        render(<CrmPipelinePage accentColor="#2563eb" />)

        expect(screen.getByRole('button', { name: /confirm won/i })).toBeInTheDocument()
        // Regular move chips must not appear for this card
        expect(screen.queryByRole('button', { name: /move to/i })).not.toBeInTheDocument()
    })

    it('"Confirm won" button calls materialize with the full opp object', () => {
        const materialize = vi.fn()
        const opp = makeVirtualOpp({ id: 'virtual:order:a1', source: 'order', stage: 'won' })
        useOpportunities.mockReturnValue(mockHookReturn({ materialize, opportunities: [opp] }))
        render(<CrmPipelinePage accentColor="#2563eb" />)

        fireEvent.click(screen.getByRole('button', { name: /confirm won/i }))

        expect(materialize).toHaveBeenCalledWith(
            expect.objectContaining({ source: 'order', stage: 'won', virtual: true })
        )
    })

    it('real cards in "won" show move chips, not a "Confirm won" button', () => {
        useOpportunities.mockReturnValue(
            mockHookReturn({
                opportunities: [makeRealOpp({ stage: 'won' })]
            })
        )
        render(<CrmPipelinePage accentColor="#2563eb" />)

        expect(screen.queryByRole('button', { name: /confirm won/i })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /move to new/i })).toBeInTheDocument()
    })
})
