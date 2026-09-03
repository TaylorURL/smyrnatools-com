export const DASHBOARD_CACHE_KEY = 'dashboard_assets_cache_v1'
export const DASHBOARD_CACHE_TTL_MS = 120000 // 2 minutes
export const DASHBOARD_REFRESH_INTERVAL_MS = 600000 // 10 minutes
/** What the dashboard renders before any data arrives, and the floor the
 *  count-up animation walks from. Every field a view reads has to be present
 *  here at zero or that view reads undefined on first paint. */
export const INITIAL_STATS = {
    equipment: { active: 0, allocationPercent: 0, comments: 0, issues: 0, overdue: 0, shop: 0, spare: 0, total: 0 },
    fleetTotal: 0,
    mixers: {
        active: 0,
        allocationPercent: 0,
        comments: 0,
        issues: 0,
        overdue: 0,
        shop: 0,
        spare: 0,
        total: 0,
        verified: 0,
        verifiedPercent: 0
    },
    openIssuesTotal: 0,
    operators: {
        active: 0,
        assigned: 0,
        lightDuty: 0,
        mixerAssigned: 0,
        pending: 0,
        total: 0,
        tractorAssigned: 0,
        training: 0,
        unassigned: 0
    },
    overallAllocationPercent: 0,
    overdueTotal: 0,
    pickups: { active: 0, allocationPercent: 0, retired: 0, shop: 0, sold: 0, spare: 0, stationary: 0, total: 0 },
    tractors: {
        active: 0,
        allocationPercent: 0,
        comments: 0,
        freight: {
            Aggregate: { active: 0, shop: 0, spare: 0, total: 0 },
            Cement: { active: 0, shop: 0, spare: 0, total: 0 },
            'Dump Truck': { active: 0, shop: 0, spare: 0, total: 0 },
            Other: { active: 0, shop: 0, spare: 0, total: 0 }
        },
        issues: 0,
        overdue: 0,
        shop: 0,
        spare: 0,
        total: 0,
        verified: 0,
        verifiedPercent: 0
    },
    trailers: {
        active: 0,
        allocationPercent: 0,
        comments: 0,
        issues: 0,
        overdue: 0,
        shop: 0,
        spare: 0,
        total: 0,
        trailerType: {
            Cement: { active: 0, shop: 0, spare: 0, total: 0 },
            'End Dump': { active: 0, shop: 0, spare: 0, total: 0 }
        }
    },
    verificationAverage: 0
}
/** Same contract as INITIAL_STATS, for the per-plant alerts panel. */
export const INITIAL_PLANT_NOTIFICATIONS = {
    aiSummary: null,
    aiSummaryFailed: false,
    aiSummaryLoading: false,
    assetsWithMostIssues: [],
    longTermShopAssets: [],
    overdueService: [],
    pendingOperators: [],
    shopIssue: null,
    totalOpenIssues: 0,
    totalResolvedIssues: 0,
    trainingOperators: [],
    unassignedOperators: [],
    unverifiedMixers: []
}
