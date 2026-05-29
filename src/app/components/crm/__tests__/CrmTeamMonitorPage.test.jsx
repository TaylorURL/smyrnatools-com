import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock format utilities to keep tests pure.
vi.mock('../../../../utils/PlanStatisticsFormatUtility', () => ({
    fmtInt: vi.fn((n) => String(n ?? 0)),
    fmtScorePct: vi.fn((n) => `${Math.round((n ?? 0) * 100)}%`)
}))

vi.mock('../../../../utils/CrmRosterUtility', () => ({
    CALL_OUTCOME_COLORS: {},
    CALL_OUTCOME_LABELS: {},
    formatRelativeDays: vi.fn((iso) => (iso ? '2d ago' : '—'))
}))

import { CrmTeamMonitorPage } from '../CrmTeamMonitorPage'

const ROW_ALICE = {
    created_by: 'u1',
    user_name: 'Alice',
    total_calls: 42,
    booked: 10,
    will_book_again: 5,
    no_answer: 8,
    not_interested: 3,
    note: 2,
    unique_customers: 15,
    opportunities_won: 2,
    last_call_at: new Date(Date.now() - 2 * 86_400_000).toISOString()
}

const ROW_BOB = {
    created_by: 'u2',
    user_name: 'Bob',
    total_calls: 18,
    booked: 4,
    will_book_again: 3,
    no_answer: 5,
    not_interested: 1,
    note: 0,
    unique_customers: 9,
    opportunities_won: 0,
    last_call_at: new Date(Date.now() - 30 * 86_400_000).toISOString()
}

const MONITOR_WITH_ROWS = { rows: [ROW_ALICE, ROW_BOB] }
const MONITOR_EMPTY = { rows: [] }

beforeEach(() => vi.clearAllMocks())

describe('CrmTeamMonitorPage', () => {
    it('renders both callers in the leaderboard table', () => {
        render(
            <CrmTeamMonitorPage
                daysWindow={30}
                isLoading={false}
                monitor={MONITOR_WITH_ROWS}
                onChangeWindow={vi.fn()}
                onRefresh={vi.fn()}
            />
        )

        expect(screen.getByText('Alice')).toBeInTheDocument()
        expect(screen.getByText('Bob')).toBeInTheDocument()
    })

    it('renders numeric call counts for each caller', () => {
        render(
            <CrmTeamMonitorPage
                daysWindow={30}
                isLoading={false}
                monitor={MONITOR_WITH_ROWS}
                onChangeWindow={vi.fn()}
                onRefresh={vi.fn()}
            />
        )

        // fmtInt mock returns String(n) so "42" and "18" appear as cells.
        expect(screen.getAllByText('42').length).toBeGreaterThan(0)
        expect(screen.getAllByText('18').length).toBeGreaterThan(0)
    })

    it('shows the empty state when there are no callers', () => {
        render(
            <CrmTeamMonitorPage
                daysWindow={30}
                isLoading={false}
                monitor={MONITOR_EMPTY}
                onChangeWindow={vi.fn()}
                onRefresh={vi.fn()}
            />
        )

        expect(screen.getByText(/no call activity in this window yet/i)).toBeInTheDocument()
    })

    it('shows the skeleton when isLoading and no rows yet', () => {
        render(
            <CrmTeamMonitorPage
                daysWindow={30}
                isLoading={true}
                monitor={MONITOR_EMPTY}
                onChangeWindow={vi.fn()}
                onRefresh={vi.fn()}
            />
        )

        // Skeleton renders animated divs — not the table.
        expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    it('renders the time-frame window buttons', () => {
        render(
            <CrmTeamMonitorPage
                daysWindow={30}
                isLoading={false}
                monitor={MONITOR_WITH_ROWS}
                onChangeWindow={vi.fn()}
                onRefresh={vi.fn()}
            />
        )

        expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '30 days' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    })

    it('renders the summary KPI stat labels', () => {
        render(
            <CrmTeamMonitorPage
                daysWindow={30}
                isLoading={false}
                monitor={MONITOR_WITH_ROWS}
                onChangeWindow={vi.fn()}
                onRefresh={vi.fn()}
            />
        )

        // 'Total calls' appears only in the Stat strip.
        expect(screen.getByText('Total calls')).toBeInTheDocument()
        // 'Booked' appears in both the Stat strip and the table header — use getAllBy.
        expect(screen.getAllByText('Booked').length).toBeGreaterThanOrEqual(1)
        // 'Will book again' appears in both the Stat strip and the table header.
        expect(screen.getAllByText('Will book again').length).toBeGreaterThanOrEqual(1)
    })

    it('calls onRefresh with the current daysWindow on mount', () => {
        const onRefresh = vi.fn()

        render(
            <CrmTeamMonitorPage
                daysWindow={7}
                isLoading={false}
                monitor={MONITOR_EMPTY}
                onChangeWindow={vi.fn()}
                onRefresh={onRefresh}
            />
        )

        expect(onRefresh).toHaveBeenCalledWith({ daysWindow: 7 })
    })

    it('renders the Caller breakdown Panel title', () => {
        render(
            <CrmTeamMonitorPage
                daysWindow={30}
                isLoading={false}
                monitor={MONITOR_WITH_ROWS}
                onChangeWindow={vi.fn()}
                onRefresh={vi.fn()}
            />
        )

        expect(screen.getByText('Caller breakdown')).toBeInTheDocument()
    })
})
