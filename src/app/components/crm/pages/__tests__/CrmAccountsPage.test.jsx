import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CrmAccountsPage } from '../CrmAccountsPage'

// Stub the heavy shared pane — we need both list+detail toggle behavior
// AND the viewMode/columns passthrough to test the table path.
vi.mock('../crmShared', () => ({
    FilterStrip: () => <div data-testid="filter-strip" />,
    ListOrDetailPane: ({ selectedRow, onClearSelection, interactions, onLogInteraction, viewMode, columns }) =>
        selectedRow ? (
            <div data-testid="customer-detail">
                <button type="button" onClick={onClearSelection}>
                    Back to list
                </button>
                {/* Expose interactions length so we can assert data is threaded through */}
                <div data-testid="interactions-count">{interactions?.length ?? 0}</div>
                {/* Expose log button so we can assert the handler is threaded through */}
                <button
                    type="button"
                    onClick={() => onLogInteraction?.({ comment: null, interactionType: 'call', roleLens: 'general' })}
                >
                    Log interaction
                </button>
            </div>
        ) : (
            <div data-testid="customer-list" data-view-mode={viewMode}>
                {viewMode === 'list' &&
                    columns?.map((col) => (
                        <div key={col.key} data-testid={`col-header-${col.key}`}>
                            {col.label}
                        </div>
                    ))}
            </div>
        )
}))

// Stub CrmRosterUtility helpers used for filtering / sorting.
vi.mock('../../../../../utils/CrmRosterUtility', () => ({
    formatCrmPhone: (p) => p || '',
    formatRelativeDays: () => '',
    matchesCrmRosterQuery: () => true,
    sortCrmRoster: (rows) => rows,
    wasRecentlyCalled: () => false
}))

vi.mock('../../../../../utils/DateUtility', () => ({
    default: { formatDate: (d) => d || '' }
}))

vi.mock('../../../../hooks/useCrmViewMode', () => ({
    useCrmViewMode: () => ['list', vi.fn()]
}))

const ROSTER = [
    {
        account_id: 'a1',
        customer_name: 'Acme Corp',
        customer_num: 'C1',
        days_since_last_pour: 10,
        last_call_at: null,
        pouring_status: 'active'
    }
]

const baseProps = {
    accentColor: '#2563eb',
    accountInteractionsByAccount: { a1: [] },
    colocationMap: {},
    contactsByCustomer: {},
    deleteContact: vi.fn(),
    deleteEntry: vi.fn(),
    historyByCustomer: {},
    isLoading: false,
    loadAccountInteractions: vi.fn(),
    loadContacts: vi.fn(),
    loadHistory: vi.fn(),
    loadingContactsFor: new Set(),
    loadingHistoryFor: new Set(),
    logCall: vi.fn(),
    logInteraction: vi.fn(),
    onAddProspect: vi.fn(),
    onClearSelectedCustomer: vi.fn(),
    onSelectCustomer: vi.fn(),
    plantNameByCode: {},
    roster: ROSTER,
    rosterError: null,
    saveContact: vi.fn(),
    savingContactFor: new Set(),
    savingFor: new Set(),
    selectedAccountId: null
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('CrmAccountsPage — CRM interactions panel', () => {
    it('loads interactions when a customer with an account_id is selected', () => {
        render(<CrmAccountsPage {...baseProps} selectedAccountId="a1" />)
        expect(baseProps.loadAccountInteractions).toHaveBeenCalledWith('a1')
    })

    it('threads the interactions array into the detail pane', () => {
        const interactions = [
            {
                comment: 'test',
                created_by_name: 'Jane',
                id: 'i1',
                interaction_type: 'call',
                occurred_at: '2026-05-20T12:00:00Z',
                role_lens: 'general'
            }
        ]
        render(
            <CrmAccountsPage
                {...baseProps}
                selectedAccountId="a1"
                accountInteractionsByAccount={{ a1: interactions }}
            />
        )
        // The stub exposes the threaded interactions count
        expect(screen.getByTestId('interactions-count').textContent).toBe('1')
    })

    it('calls logInteraction with the correct accountId when the pane triggers it', async () => {
        render(<CrmAccountsPage {...baseProps} selectedAccountId="a1" />)
        // The stub exposes a "Log interaction" button that calls onLogInteraction
        fireEvent.click(screen.getByRole('button', { name: /log interaction/i }))
        await waitFor(() => {
            expect(baseProps.logInteraction).toHaveBeenCalledWith(
                expect.objectContaining({ accountId: 'a1', interactionType: 'call' })
            )
        })
    })

    it('does not render the detail pane when no customer is selected', () => {
        render(<CrmAccountsPage {...baseProps} selectedAccountId={null} />)
        expect(screen.queryByTestId('customer-detail')).not.toBeInTheDocument()
    })
})

describe('CrmAccountsPage — list / cards view toggle', () => {
    it('renders the List/Cards toggle in list view', () => {
        render(<CrmAccountsPage {...baseProps} selectedAccountId={null} />)
        // CrmViewToggle renders segmented "List" and "Cards" buttons inside aria-group "View mode"
        const group = screen.getByRole('group', { name: /view mode/i })
        expect(group).toBeInTheDocument()
        expect(group.querySelectorAll('button')).toHaveLength(2)
    })

    it('passes viewMode="list" to ListOrDetailPane by default', () => {
        render(<CrmAccountsPage {...baseProps} selectedAccountId={null} />)
        expect(screen.getByTestId('customer-list').dataset.viewMode).toBe('list')
    })

    it('passes columns to ListOrDetailPane in list mode — "Name" column header present', () => {
        render(<CrmAccountsPage {...baseProps} selectedAccountId={null} />)
        expect(screen.getByTestId('col-header-customer_name')).toBeInTheDocument()
        expect(screen.getByTestId('col-header-customer_name').textContent).toBe('Name')
    })

    it('hides the toggle when a customer is selected (detail view)', () => {
        render(<CrmAccountsPage {...baseProps} selectedAccountId="a1" />)
        expect(screen.queryByRole('group', { name: /view mode/i })).not.toBeInTheDocument()
    })
})

describe('CrmAccountsPage — Add prospect form', () => {
    it('shows the Add prospect button in list view', () => {
        render(<CrmAccountsPage {...baseProps} selectedAccountId={null} />)
        expect(screen.getByRole('button', { name: /add prospect/i })).toBeInTheDocument()
    })

    it('expands the inline form when Add prospect is clicked', () => {
        render(<CrmAccountsPage {...baseProps} selectedAccountId={null} />)
        fireEvent.click(screen.getByRole('button', { name: /add prospect/i }))
        expect(screen.getByLabelText(/company name/i)).toBeInTheDocument()
    })

    it('calls onAddProspect with the typed name and closes the form on Save', async () => {
        const onAddProspect = vi.fn().mockResolvedValue(undefined)
        render(<CrmAccountsPage {...baseProps} onAddProspect={onAddProspect} selectedAccountId={null} />)

        fireEvent.click(screen.getByRole('button', { name: /add prospect/i }))
        fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'New Paving Co' } })
        fireEvent.click(screen.getByRole('button', { name: /save/i }))

        await waitFor(() => {
            expect(onAddProspect).toHaveBeenCalledWith('New Paving Co')
        })
        // Form should collapse after save
        await waitFor(() => {
            expect(screen.queryByLabelText(/company name/i)).not.toBeInTheDocument()
        })
    })

    it('disables Save when the name field is empty', () => {
        render(<CrmAccountsPage {...baseProps} selectedAccountId={null} />)
        fireEvent.click(screen.getByRole('button', { name: /add prospect/i }))
        expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
    })

    it('closes the form on Cancel without calling onAddProspect', () => {
        render(<CrmAccountsPage {...baseProps} selectedAccountId={null} />)
        fireEvent.click(screen.getByRole('button', { name: /add prospect/i }))
        fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
        expect(baseProps.onAddProspect).not.toHaveBeenCalled()
        expect(screen.queryByLabelText(/company name/i)).not.toBeInTheDocument()
    })
})
