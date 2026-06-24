import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the hook module BEFORE importing the component that uses it.
// Path is from the test file's location (one level deeper than the component).
vi.mock('../../../../hooks/useFollowups', () => ({
    useFollowups: vi.fn()
}))

// Default to 'list' mode so the table renders in baseline tests.
vi.mock('../../../../hooks/useCrmViewMode', () => ({
    useCrmViewMode: vi.fn(() => ['list', vi.fn()])
}))

import { useCrmViewMode } from '../../../../hooks/useCrmViewMode'
import { useFollowups } from '../../../../hooks/useFollowups'
import { CrmFollowupsPage } from '../CrmFollowupsPage'

// Fixed "now" so due_at comparisons are deterministic.
const NOW_ISO = '2026-05-28T12:00:00.000Z'
const NOW_MS = new Date(NOW_ISO).getTime()

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW_MS)
    vi.clearAllMocks()
})

afterEach(() => {
    vi.useRealTimers()
})

const OVERDUE_FOLLOWUP = {
    account_name: 'Acme Corp',
    due_at: '2026-05-01T12:00:00Z',
    id: 'f1',
    // well in the past
status: 'open', 
    title: 'Call back Acme'
}

const UPCOMING_FOLLOWUP = {
    account_name: 'Beta Paving',
    due_at: '2026-06-10T12:00:00Z',
    id: 'f2',
    // future
status: 'open', 
    title: 'Send proposal'
}

describe('CrmFollowupsPage — list / cards toggle', () => {
    it('default list view renders a table header with "Title" column', () => {
        useCrmViewMode.mockReturnValue(['list', vi.fn()])
        useFollowups.mockReturnValue({
            complete: vi.fn(),
            error: null,
            followups: [OVERDUE_FOLLOWUP, UPCOMING_FOLLOWUP],
            isLoading: false
        })
        render(<CrmFollowupsPage accentColor="#2563eb" />)
        expect(screen.getByRole('columnheader', { name: /title/i })).toBeInTheDocument()
    })

    it('toggling to cards shows grouped sections (Overdue, Upcoming)', () => {
        useCrmViewMode.mockReturnValue(['cards', vi.fn()])
        useFollowups.mockReturnValue({
            complete: vi.fn(),
            error: null,
            followups: [OVERDUE_FOLLOWUP, UPCOMING_FOLLOWUP],
            isLoading: false
        })
        render(<CrmFollowupsPage accentColor="#2563eb" />)
        expect(screen.queryByRole('columnheader', { name: /title/i })).not.toBeInTheDocument()
        expect(screen.getByText('Overdue')).toBeInTheDocument()
        expect(screen.getByText('Upcoming')).toBeInTheDocument()
    })

    it('list view Done button calls complete with the correct id', () => {
        useCrmViewMode.mockReturnValue(['list', vi.fn()])
        const complete = vi.fn()
        useFollowups.mockReturnValue({
            complete,
            error: null,
            followups: [OVERDUE_FOLLOWUP],
            isLoading: false
        })
        render(<CrmFollowupsPage accentColor="#2563eb" />)
        fireEvent.click(screen.getByRole('button', { name: /done/i }))
        expect(complete).toHaveBeenCalledWith('f1')
    })
})

describe('CrmFollowupsPage', () => {
    // All existing tests use list mode.
    beforeEach(() => {
        useCrmViewMode.mockReturnValue(['list', vi.fn()])
    })

    it('renders overdue and upcoming rows from mocked hook', () => {
        const complete = vi.fn()
        useFollowups.mockReturnValue({
            complete,
            error: null,
            followups: [OVERDUE_FOLLOWUP, UPCOMING_FOLLOWUP],
            isLoading: false
        })

        render(<CrmFollowupsPage accentColor="#2563eb" />)

        expect(screen.getByText('Call back Acme')).toBeInTheDocument()
        expect(screen.getByText('Send proposal')).toBeInTheDocument()
        // In list mode group headers are NOT shown; titles appear as table cells
        expect(screen.queryByText('Overdue')).not.toBeInTheDocument()
        expect(screen.queryByText('Upcoming')).not.toBeInTheDocument()
    })

    it('clicking Done on an overdue row calls complete with the correct id', () => {
        const complete = vi.fn()
        useFollowups.mockReturnValue({
            complete,
            error: null,
            followups: [OVERDUE_FOLLOWUP],
            isLoading: false
        })

        render(<CrmFollowupsPage accentColor="#2563eb" />)

        fireEvent.click(screen.getByRole('button', { name: /done/i }))
        expect(complete).toHaveBeenCalledWith('f1')
    })

    it('shows a skeleton while loading', () => {
        useFollowups.mockReturnValue({
            complete: vi.fn(),
            error: null,
            followups: [],
            isLoading: true
        })

        const { container } = render(<CrmFollowupsPage accentColor="#2563eb" />)
        // Skeleton divs render instead of list items
        expect(screen.queryByText('Overdue')).not.toBeInTheDocument()
        expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
    })

    it('shows an all-clear message when there are no follow-ups', () => {
        useFollowups.mockReturnValue({
            complete: vi.fn(),
            error: null,
            followups: [],
            isLoading: false
        })

        render(<CrmFollowupsPage accentColor="#2563eb" />)
        expect(screen.getByText(/you're all caught up/i)).toBeInTheDocument()
    })

    it('shows an error banner on fetch failure', () => {
        useFollowups.mockReturnValue({
            complete: vi.fn(),
            error: 'Network error',
            followups: [],
            isLoading: false
        })

        render(<CrmFollowupsPage accentColor="#2563eb" />)
        expect(screen.getByText('Network error')).toBeInTheDocument()
    })
})
