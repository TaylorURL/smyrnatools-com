import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../../../app/context/PreferencesContext', () => ({
    usePreferences: () => ({
        preferences: { accentColor: '#1e3a5f', themeMode: 'light' }
    })
}))

vi.mock('../../../../app/context/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'user-1' } })
}))

vi.mock('../../../../services/UserService', () => ({
    UserService: {
        getUserPermissions: vi.fn(() => Promise.resolve(['crm.view']))
    }
}))

vi.mock('../../../../app/hooks/useCrmRoster', () => ({
    default: () => ({
        contactsByCustomer: {},
        deleteContact: vi.fn(),
        deleteEntry: vi.fn(),
        historyByCustomer: {},
        isLoadingActivity: false,
        isLoadingRoster: false,
        isLoadingTeamMonitor: false,
        loadContacts: vi.fn(),
        loadHistory: vi.fn(),
        loadRecentActivity: vi.fn(),
        loadTeamMonitor: vi.fn(),
        loadingContactsFor: null,
        loadingHistoryFor: null,
        logCall: vi.fn(),
        recentActivity: [],
        refreshRoster: vi.fn(),
        roster: [],
        rosterError: null,
        saveContact: vi.fn(),
        savingContactFor: null,
        savingFor: null,
        teamMonitor: []
    })
}))

vi.mock('../../../../app/hooks/useCrm', () => ({
    useCrm: () => ({
        interactionsByAccount: {},
        loadInteractions: vi.fn(),
        logInteraction: vi.fn(),
        roster: []
    })
}))

vi.mock('../../../../app/hooks/useCrmDashboard', () => ({
    useCrmDashboard: () => ({
        dashboard: {
            activity: { interactionsLast7d: 0, recentFeed: [] },
            leaderboard: [],
            pipeline: { byStage: { contacted: 0, new: 0, quoted: 0 }, realOpenTotal: 0, virtualTotal: 0 },
            roster: { customers: 0, dormant: 0, longestDormant: [], neverCalledOrStale: 0, prospects: 0, total: 0 },
            teamFollowups: { dueToday: [], overdue: [], upcoming: [] }
        },
        desk: { accounts: [], followups: [], opportunities: [], recentActivity: [] },
        error: null,
        isDeskLoading: false,
        isLoading: false,
        reload: vi.fn()
    })
}))

vi.mock('../../../../services/CrmService', () => ({
    default: {
        saveAccount: vi.fn()
    }
}))

// Stub every page component so the render tree stays shallow.
vi.mock('../../../../app/components/crm/pages/CrmMyDeskPage', () => ({
    CrmMyDeskPage: () => <div data-testid="page-my-desk">My Desk</div>
}))

vi.mock('../../../../app/components/crm/pages/CrmFollowupsPage', () => ({
    CrmFollowupsPage: () => <div data-testid="page-followups">Followups</div>
}))

vi.mock('../../../../app/components/crm/CrmPages', () => ({
    CrmActivityPage: () => <div data-testid="page-activity">Activity</div>,
    CrmAccountsPage: () => <div data-testid="page-accounts">Accounts</div>,
    CrmOutreachPage: () => <div data-testid="page-outreach">Outreach</div>
}))

vi.mock('../../../../app/components/crm/CrmTeamMonitorPage', () => ({
    CrmTeamMonitorPage: () => <div data-testid="page-team-monitor">Team Monitor</div>
}))

vi.mock('../../../../app/components/crm/pages/CrmMapPage', () => ({
    CrmMapPage: () => <div data-testid="page-map">Map</div>
}))

vi.mock('../../../../app/components/crm/pages/CrmPipelinePage', () => ({
    CrmPipelinePage: () => <div data-testid="page-pipeline">Pipeline</div>
}))

vi.mock('../../../../app/components/common/TabFadeIn', () => ({
    default: ({ children, className }) => <div className={className}>{children}</div>
}))

// ── Tests ─────────────────────────────────────────────────────────────────────

import CrmView from '../CrmView'

describe('CrmView', () => {
    it('renders the top-level tabs: Work, Customers, Insights (Pipeline lives under Customers)', () => {
        render(<CrmView />)
        expect(screen.getByRole('tab', { name: /work/i })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /customers/i })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /insights/i })).toBeInTheDocument()
        // Pipeline is a Customers side-menu section now, not a top-level tab.
        expect(screen.queryByRole('tab', { name: /pipeline/i })).not.toBeInTheDocument()
    })

    it('defaults to Work tab and shows My Desk page', () => {
        render(<CrmView />)
        const workTab = screen.getByRole('tab', { name: /work/i })
        expect(workTab).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByTestId('page-my-desk')).toBeInTheDocument()
    })

    it('switches to Customers tab and shows the sidebar with Accounts, Pipeline, and Map', async () => {
        render(<CrmView />)
        const customersTab = screen.getByRole('tab', { name: /customers/i })
        await userEvent.click(customersTab)
        // Sidebar renders section buttons for Accounts, Pipeline, and Map
        expect(screen.getByRole('button', { name: /accounts/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /pipeline/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /map/i })).toBeInTheDocument()
        // Accounts page is active by default
        expect(screen.getByTestId('page-accounts')).toBeInTheDocument()
    })

    it('hides the Settings tab when the user lacks crm.manage', () => {
        render(<CrmView />)
        // Default mock returns only 'crm.view' — no crm.manage.
        expect(screen.queryByRole('tab', { name: /settings/i })).not.toBeInTheDocument()
    })

    it('shows the Settings tab when the user has crm.manage', async () => {
        const { UserService } = await import('../../../../services/UserService')
        UserService.getUserPermissions.mockResolvedValueOnce(['crm.view', 'crm.manage'])

        render(<CrmView />)

        // The permissions fetch is async; wait for the tab to appear.
        const settingsTab = await screen.findByRole('tab', { name: /settings/i })
        expect(settingsTab).toBeInTheDocument()
    })
})
