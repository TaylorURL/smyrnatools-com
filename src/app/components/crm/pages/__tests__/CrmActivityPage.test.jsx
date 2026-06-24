import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Stub heavy chart/avatar sub-components that aren't relevant to the filter test.
vi.mock('../activity/ActivityMetrics', () => ({
    ActivityMetrics: () => <div data-testid="activity-metrics" />
}))
vi.mock('../activity/ActivityOutcomeBreakdown', () => ({
    ActivityOutcomeBreakdown: () => <div data-testid="activity-outcome-breakdown" />
}))
vi.mock('../activity/ActivityToolbar', () => ({
    ActivityToolbar: () => <div data-testid="activity-toolbar" />
}))
vi.mock('../activity/ActivityAuxiliary', () => ({
    ActivityEmpty: ({ hasFilters }) => (
        <div data-testid="activity-empty">{hasFilters ? 'No matches' : 'Nothing yet'}</div>
    ),
    ActivityListSkeleton: () => <div data-testid="activity-skeleton" />
}))

// Default to 'list' mode so table renders in baseline tests; individual tests
// can override via the mock return value.
vi.mock('../../../../hooks/useCrmViewMode', () => ({
    useCrmViewMode: vi.fn(() => ['list', vi.fn()])
}))

import { useCrmViewMode } from '../../../../hooks/useCrmViewMode'
import { CrmActivityPage } from '../CrmActivityPage'

// A real date inside "earlier" so the grouping helper puts it in the right bucket.
const EARLIER_DATE = '2020-01-15T10:00:00Z'

const CALL_ENTRY = {
    comment: 'Scheduled a pour',
    contact_name: null,
    created_at: EARLIER_DATE,
    created_by: 'user-1',
    created_by_name: 'Alice',
    customer_name: 'Acme Corp',
    customer_num: 'C1',
    id: 'e1',
    interaction_type: 'call',
    outcome: 'booked'
}

const SITE_VISIT_ENTRY = {
    comment: 'Reviewed the job site',
    contact_name: null,
    created_at: EARLIER_DATE,
    created_by: 'user-2',
    created_by_name: 'Bob',
    customer_name: 'Beta Paving',
    customer_num: 'C2',
    id: 'e2',
    interaction_type: 'site_visit',
    outcome: 'note'
}

const baseProps = {
    accentColor: '#2563eb',
    isLoading: false,
    onRefresh: vi.fn(),
    onSelectCustomer: vi.fn(),
    recentActivity: [CALL_ENTRY, SITE_VISIT_ENTRY],
    selectedCustomerForActivity: null
}

describe('CrmActivityPage — list / cards toggle', () => {
    it('default list view renders a table header with "Type" column', () => {
        useCrmViewMode.mockReturnValue(['list', vi.fn()])
        render(<CrmActivityPage {...baseProps} />)
        expect(screen.getByRole('columnheader', { name: /type/i })).toBeInTheDocument()
    })

    it('toggling to cards shows the existing grouped feed, not the table', () => {
        useCrmViewMode.mockReturnValue(['cards', vi.fn()])
        render(<CrmActivityPage {...baseProps} />)
        expect(screen.queryByRole('columnheader', { name: /type/i })).not.toBeInTheDocument()
        // Grouped list renders customer names directly
        expect(screen.getByText('Acme Corp')).toBeInTheDocument()
        expect(screen.getByText('Beta Paving')).toBeInTheDocument()
    })

    it('list view row click calls onSelectCustomer', () => {
        useCrmViewMode.mockReturnValue(['list', vi.fn()])
        const onSelectCustomer = vi.fn()
        render(<CrmActivityPage {...baseProps} onSelectCustomer={onSelectCustomer} />)
        // Click the row for Acme Corp (customer_num C1, no account_id)
        fireEvent.click(screen.getByText('Acme Corp'))
        expect(onSelectCustomer).toHaveBeenCalledWith('C1')
    })
})

describe('CrmActivityPage — interaction type filter', () => {
    // All filter tests use list mode so customer names are visible in table cells.
    beforeEach(() => {
        useCrmViewMode.mockReturnValue(['list', vi.fn()])
    })

    it('renders both entries when the All chip is active', () => {
        render(<CrmActivityPage {...baseProps} />)
        expect(screen.getByText('Acme Corp')).toBeInTheDocument()
        expect(screen.getByText('Beta Paving')).toBeInTheDocument()
    })

    it('filters to only site_visit entries when the Site visit chip is clicked', () => {
        render(<CrmActivityPage {...baseProps} />)
        fireEvent.click(screen.getByRole('button', { name: 'Site visit' }))
        expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument()
        expect(screen.getByText('Beta Paving')).toBeInTheDocument()
    })

    it('filters to only call entries when the Call chip is clicked', () => {
        render(<CrmActivityPage {...baseProps} />)
        fireEvent.click(screen.getByRole('button', { name: 'Call' }))
        expect(screen.getByText('Acme Corp')).toBeInTheDocument()
        expect(screen.queryByText('Beta Paving')).not.toBeInTheDocument()
    })

    it('shows the empty state when no entries match the selected type', () => {
        render(<CrmActivityPage {...baseProps} />)
        fireEvent.click(screen.getByRole('button', { name: 'Meeting' }))
        expect(screen.getByTestId('activity-empty')).toBeInTheDocument()
    })

    it('renders all type filter chips', () => {
        render(<CrmActivityPage {...baseProps} />)
        // Scope to the filter group — sortable table headers are also buttons,
        // and the "Note" column header would otherwise collide with the chip.
        const group = screen.getByRole('group', { name: /filter by interaction type/i })
        const chipLabels = ['All', 'Call', 'Site visit', 'Meeting', 'Email', 'Note']
        for (const label of chipLabels) {
            expect(within(group).getByRole('button', { name: label })).toBeInTheDocument()
        }
    })
})
