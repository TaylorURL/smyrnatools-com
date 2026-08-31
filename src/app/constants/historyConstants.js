/** Maps asset types to their history-fetching service and method names. */
export const HISTORY_SERVICE_MAP = {
    equipment: { method: 'getEquipmentHistory', service: 'EquipmentService' },
    mixer: { method: 'getMixerHistory', service: 'MixerService' },
    operator: { method: 'getOperatorHistory', service: 'OperatorService' },
    'pickup-truck': { method: 'fetchHistory', service: 'PickupTruckService' },
    tractor: { method: 'getTractorHistory', service: 'TractorService' },
    trailer: { method: 'getTrailerHistory', service: 'TrailerService' }
}
/** Maps asset types to their database history table names. */
export const HISTORY_TABLE_MAP = {
    equipment: 'heavy_equipment_history',
    mixer: 'mixers_history',
    operator: 'operators_history',
    'pickup-truck': 'pickup_trucks_history',
    tractor: 'tractors_history',
    trailer: 'trailers_history'
}
/** Maps asset types to their issue-management service class names. */
export const ISSUE_SERVICE_MAP = {
    equipment: 'EquipmentService',
    mixer: 'MixerService',
    tractor: 'TractorService',
    trailer: 'TrailerService'
}
export const STATUS_COLORS = {
    Active: 'var(--status-active)',
    'In Shop': 'var(--status-shop)',
    Retired: 'var(--status-retired)',
    Spare: 'var(--status-spare)'
}
export const DEFAULT_STATUS_COLOR = 'var(--accent)'
export const SEVERITY_COLORS = {
    High: 'var(--status-danger)',
    Low: 'var(--status-shop)',
    Medium: 'var(--status-warning)'
}
export const RESOLVED_ISSUE_COLOR = 'var(--status-active)'
/** Indexed directly by the 1-5 rating value; index 0 is unused. */
export const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']
/** Ordered high to low: the first entry a reading clears is the one it gets,
 *  and the trailing 0 makes sure every reading matches something. */
export const MILEAGE_MILESTONES = [
    { label: 'High Mileage', level: 'critical', threshold: 300000 },
    { label: 'Elevated', level: 'warning', threshold: 200000 },
    { label: 'Moderate', level: 'info', threshold: 100000 },
    { label: 'Low', level: 'good', threshold: 0 }
]
export const AI_HISTORY_CACHE_KEY = 'srm_history_ai_summaries'
export const AI_CACHE_DURATION_MS = 24 * 60 * 60 * 1000
export const CHART_HEIGHT = 300
export const CHART_PADDING = 40
export const CHART_WIDTH = 1000
export const MAX_STAR_RATING = 5
export const DAYS_IN_MS = 1000 * 60 * 60 * 24
/** Membership sets the tab definitions below test against, so which tabs an
 *  asset type gets is decided here rather than in the modal. */
export const ASSET_TYPES_WITH_OVERVIEW = ['mixer', 'tractor', 'trailer', 'equipment', 'pickup-truck']
export const ASSET_TYPES_WITH_OPERATORS = ['mixer', 'tractor']
export const ASSET_TYPES_WITH_SERVICE = ['mixer', 'tractor', 'equipment', 'pickup-truck']
export const ASSET_TYPES_WITH_PLANT = ['mixer', 'tractor', 'trailer', 'equipment', 'pickup-truck']
export const ASSET_TYPES_WITH_CLEANLINESS = ['mixer', 'tractor', 'trailer', 'equipment']
export const AI_TYPEWRITER_CHARS_PER_TICK = 4
export const AI_TYPEWRITER_TICK_MS = 10
export const SEVERITY_PALETTES = {
    High: { bg: 'var(--notice-danger-fill)', color: 'var(--notice-danger-soft)' },
    Low: { bg: 'var(--tint-sky-bg)', color: 'var(--tint-sky-ink)' },
    Medium: { bg: 'var(--notice-warning-bg-strong)', color: 'var(--notice-warning-soft)' }
}
/** The full tab strip for the history modal, in display order. `show` is
 *  passed the asset type and decides whether that tab is offered at all. */
export const HISTORY_TAB_DEFINITIONS = [
    { id: 'timeline', label: 'Timeline', show: () => true },
    { id: 'overview', label: 'Overview', show: (type) => ASSET_TYPES_WITH_OVERVIEW.includes(type) },
    { id: 'operators', label: 'Operators', show: (type) => ASSET_TYPES_WITH_OPERATORS.includes(type) },
    { id: 'service', label: 'Service History', show: (type) => ASSET_TYPES_WITH_SERVICE.includes(type) },
    { id: 'plant', label: 'Plant Assignments', show: (type) => ASSET_TYPES_WITH_PLANT.includes(type) },
    { id: 'status', label: 'Status History', show: (type) => type === 'operator' || type === 'pickup-truck' },
    { id: 'position', label: 'Position History', show: (type) => type === 'operator' },
    { id: 'ratings', label: 'Ratings History', show: (type) => type === 'operator' },
    { id: 'assignments', label: 'Assignments', show: (type) => type === 'operator' },
    { id: 'mileage', label: 'Mileage Tracking', show: (type) => type === 'pickup-truck' },
    { id: 'condition', label: 'Condition', show: (type) => type === 'equipment' },
    { id: 'cleanliness', label: 'Cleanliness', show: (type) => ASSET_TYPES_WITH_CLEANLINESS.includes(type) }
]
