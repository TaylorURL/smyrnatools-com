
export const ONE_DAY_MS = 86_400_000

export const PLAN_STATS_PERIODS = [
    { id: 'day', label: 'Day', span: 1 },
    { id: 'week', label: 'Week', span: 7 },
    { id: 'month', label: 'Month', span: 30 },
    { id: 'quarter', label: 'Quarter', span: 90 },
    { id: 'year', label: 'Year', span: 365 },
    { id: 'custom', label: 'Custom', span: null }
]

export const PLAN_STATS_CHART_TOOLTIP_STYLE = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-light)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 12
}
