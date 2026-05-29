import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Stub heavy shared components — expose viewMode + columns for toggle assertions.
vi.mock('../crmShared', () => ({
    FilterStrip: () => <div data-testid="filter-strip" />,
    ListOrDetailPane: ({ filtered, listEmptyMessage, selectedRow, viewMode, columns }) =>
        selectedRow ? (
            <div data-testid="customer-detail">{selectedRow.customer_name}</div>
        ) : filtered.length > 0 ? (
            <ul data-testid="customer-list" data-view-mode={viewMode}>
                {viewMode === 'list' &&
                    columns?.map((col) => (
                        <li key={col.key} data-testid={`col-header-${col.key}`}>
                            {col.label}
                        </li>
                    ))}
                {filtered.map((row) => (
                    <li key={row.account_id}>{row.customer_name}</li>
                ))}
            </ul>
        ) : (
            <div data-testid="empty-message">{listEmptyMessage}</div>
        )
}))

vi.mock('../../../../../utils/CrmRosterUtility', () => ({
    formatCrmPhone: (p) => p || '',
    formatRelativeDays: () => '',
    matchesCrmRosterQuery: () => true,
    sortCrmRoster: (rows) => rows,
    wasRecentlyCalled: () => false
}))

vi.mock('../../../../hooks/useCrmViewMode', () => ({
    useCrmViewMode: () => ['list', vi.fn()]
}))

import { CrmOutreachPage } from '../CrmOutreachPage'

const DORMANT_ROW = {
    account_id: 'acc-dormant',
    customer_name: 'Dormant Paving',
    customer_num: 'D1',
    last_call_at: null,
    lifecycle_stage: 'customer',
    pouring_status: 'dormant'
}

const PROSPECT_ROW = {
    account_id: 'acc-prospect',
    customer_name: 'Prospect Co',
    customer_num: 'P1',
    last_call_at: null,
    lifecycle_stage: 'prospect',
    pouring_status: 'dormant'
}

const ACTIVE_ROW = {
    account_id: 'acc-active',
    customer_name: 'Active Roads',
    customer_num: 'A1',
    last_call_at: null,
    lifecycle_stage: 'customer',
    pouring_status: 'active'
}

/** Prospect with null customer_num — simulates a manually-created prospect
 *  that has never poured (no customer_num assigned yet). */
const NULL_CUSTOMER_NUM_PROSPECT = {
    account_id: 'acc-null-prospect',
    customer_name: 'Brand New Prospect',
    customer_num: null,
    last_call_at: null,
    lifecycle_stage: 'prospect',
    pouring_status: 'dormant'
}

const ROSTER = [DORMANT_ROW, PROSPECT_ROW, ACTIVE_ROW]

const baseProps = {
    accentColor: '#2563eb',
    colocationMap: {},
    contactsByCustomer: {},
    deleteContact: vi.fn(),
    deleteEntry: vi.fn(),
    historyByCustomer: {},
    isLoading: false,
    loadContacts: vi.fn(),
    loadHistory: vi.fn(),
    loadingContactsFor: new Set(),
    loadingHistoryFor: new Set(),
    logCall: vi.fn(),
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

beforeEach(() => vi.clearAllMocks())

describe('CrmOutreachPage — worklist toggle', () => {
    it('renders "Dormant" and "Prospects" toggle buttons', () => {
        render(<CrmOutreachPage {...baseProps} />)
        expect(screen.getByRole('button', { name: /dormant/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /prospects/i })).toBeInTheDocument()
    })

    it('defaults to Dormant — shows only dormant rows (not active, not prospect)', () => {
        render(<CrmOutreachPage {...baseProps} />)
        expect(screen.getByText('Dormant Paving')).toBeInTheDocument()
        expect(screen.queryByText('Prospect Co')).not.toBeInTheDocument()
        expect(screen.queryByText('Active Roads')).not.toBeInTheDocument()
    })

    it('switching to Prospects shows only lifecycle_stage==="prospect" rows', () => {
        render(<CrmOutreachPage {...baseProps} />)
        fireEvent.click(screen.getByRole('button', { name: /prospects/i }))
        expect(screen.getByText('Prospect Co')).toBeInTheDocument()
        expect(screen.queryByText('Dormant Paving')).not.toBeInTheDocument()
        expect(screen.queryByText('Active Roads')).not.toBeInTheDocument()
    })

    it('switching back to Dormant restores the dormant view', () => {
        render(<CrmOutreachPage {...baseProps} />)
        fireEvent.click(screen.getByRole('button', { name: /prospects/i }))
        fireEvent.click(screen.getByRole('button', { name: /dormant/i }))
        expect(screen.getByText('Dormant Paving')).toBeInTheDocument()
        expect(screen.queryByText('Prospect Co')).not.toBeInTheDocument()
    })

    it('shows a "no prospects" empty state when Prospects is active with no matches', () => {
        render(<CrmOutreachPage {...baseProps} roster={[DORMANT_ROW]} />)
        fireEvent.click(screen.getByRole('button', { name: /prospects/i }))
        expect(screen.getByTestId('empty-message')).toHaveTextContent(/no prospects/i)
    })
})

describe('CrmOutreachPage — list / cards view toggle', () => {
    it('renders the List/Cards toggle alongside the worklist toggle', () => {
        render(<CrmOutreachPage {...baseProps} />)
        // CrmViewToggle is a group[aria-label="View mode"] with two buttons
        const group = screen.getByRole('group', { name: /view mode/i })
        expect(group).toBeInTheDocument()
        expect(group.querySelectorAll('button')).toHaveLength(2)
    })

    it('passes viewMode="list" to ListOrDetailPane by default', () => {
        render(<CrmOutreachPage {...baseProps} />)
        expect(screen.getByTestId('customer-list').dataset.viewMode).toBe('list')
    })

    it('passes columns to ListOrDetailPane — "Name" column header present in list mode', () => {
        render(<CrmOutreachPage {...baseProps} />)
        expect(screen.getByTestId('col-header-customer_name')).toBeInTheDocument()
        expect(screen.getByTestId('col-header-customer_name').textContent).toBe('Name')
    })

    it('hides the toggles when a customer is selected (detail view)', () => {
        render(<CrmOutreachPage {...baseProps} selectedAccountId="acc-dormant" roster={[DORMANT_ROW]} />)
        expect(screen.queryByRole('group', { name: /view mode/i })).not.toBeInTheDocument()
    })
})

describe('CrmOutreachPage — null customer_num prospect regression', () => {
    it('does NOT auto-open the detail when selectedAccountId is null, even with a null-customer_num prospect in the roster', () => {
        // Regression: previously selectedRow was found by customer_num, so
        // roster.find(r => r.customer_num === null) would match a prospect
        // with customer_num=null whenever nothing was selected (selectedCustomerNum=null).
        // This trapped the user in the detail with no way to escape.
        const rosterWithNullProspect = [NULL_CUSTOMER_NUM_PROSPECT, DORMANT_ROW]
        render(<CrmOutreachPage {...baseProps} roster={rosterWithNullProspect} selectedAccountId={null} />)
        // The list/worklist toggle must be visible, not the detail card.
        expect(screen.queryByTestId('customer-detail')).not.toBeInTheDocument()
        // The worklist toggle buttons confirm the list view is active.
        expect(screen.getByRole('button', { name: /dormant/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /prospects/i })).toBeInTheDocument()
    })
})
