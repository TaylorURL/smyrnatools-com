/* PlanUtility — barrel re-export.
 *
 * The implementation now lives in:
 *   - src/app/constants/planConstants — all pure constants
 *   - src/utils/plan/planTime         — CST date + time-of-day helpers
 *   - src/utils/plan/planAvailability — weekend / missing-ops / base pool
 *   - src/utils/plan/planBadges       — plant badge color lookup
 *   - src/utils/plan/planOrder        — order predicates + pour math
 *   - src/utils/plan/planAssignment   — driver-assignment helpers
 *   - src/utils/plan/planPool         — pool simulation + clock-in / send-home
 *   - src/utils/plan/planSlots        — slot suggestion + pull-up + timing
 *   - src/utils/plan/planCustomerSat  — customer-satisfaction scoring
 *
 * All previously exported names are still available from this module so the
 * 57+ consumers don't need to change. */

export {
    AUTOSAVE_DELAY_MS,
    BAD_SERVICE_LATE_THRESHOLD_MIN,
    BAD_SERVICE_PACE_THRESHOLD,
    BIG_POUR_MIN_TRUCKS,
    BIG_POUR_SPACING_THRESHOLD_MIN,
    BIG_POUR_YARDAGE_THRESHOLD,
    BUFFER_MINUTES,
    CANCELLED_ORDER_START,
    CUSTOMER_SAT_LATE_WINDOW_MIN,
    CUSTOMER_SAT_ONTIME_WEIGHT,
    CUSTOMER_SAT_PACE_WEIGHT,
    DAY_WIDTH,
    DEFAULT_STAGGER_MINUTES,
    DROPDOWN_ARROW_SVG,
    EARLY_ARRIVAL_MINUTES,
    FLEET_MAX_LOAD_SIZE,
    GAP_THRESHOLD_MINUTES,
    KICKER_RESERVE_BASE_TRUCKS,
    KICKER_RESERVE_BIG_POUR_TRUCKS,
    KICKER_RESERVE_BLOCK_SIZE,
    KICKER_RESERVE_MAX_DURATION_MIN,
    KICKER_RESERVE_MIN_DURATION_MIN,
    LABEL_WIDTH,
    LANE_COLORS,
    LOAD_MINUTES,
    MAX_YPH,
    OVERTIME_THRESHOLD_HOURS,
    PLAN_META_KEY,
    PLAN_TIME_ZONE,
    PLANT_BADGE_COLORS,
    PRE_TRIP_MINUTES,
    PULL_UP_LEAD_NOTICE_MIN,
    PULL_UP_MIN_DELTA_MIN,
    SAME_DAY_ORDER_START,
    SLUMP_MINUTES,
    SMALL_JOB_TRUCK_THRESHOLD,
    SMALL_JOB_YARDAGE_THRESHOLD,
    SUGGESTED_SLOT_TYPES,
    TARGET_YPH,
    TEST_ORDER_START,
    TIMELINE_END_HOUR,
    TIMELINE_HOURS,
    TIMELINE_START_HOUR,
    TRUCK_ON_SITE_MINUTES
} from '../app/constants/planConstants'
export {
    buildAssignmentDriverTimes,
    createEmptyAssignment,
    ensureUniqueIds,
    isAssignmentTimingComplete,
    nextAssignmentId,
    resolveReturnTravelMinutes
} from './plan/planAssignment'
export {
    adjustPoolForDate,
    getDayAdjustedBase,
    getEffectiveBase,
    getForecastedOperatorCount,
    getMissingOperators,
    getPoolDayMultiplier,
    getSaturdayOverride,
    isClosedDay,
    isSaturday,
    resolveSaturdayHeadcount,
    setMissingOperators,
    setSaturdayOverride
} from './plan/planAvailability'
export { plantBadgeColor } from './plan/planBadges'
export { buildSuppressedReturnIndexes } from './plan/planChains'
export {
    BAD_LATE_MIN,
    classifyServiceTier,
    computeActualYardsPerHour,
    computeCustomerSatisfaction,
    computeRequestedYardsPerHour,
    isSmallPourJob,
    NOT_GOOD_LATE_MIN,
    scoreOrderExperience,
    SERVICE_TIER_META,
    SERVICE_TIER_ORDER,
    splitTicketsAtKicker,
    VERY_BAD_LATE_MIN
} from './plan/planCustomerSat'
export type { OrderExperienceVerdict, ServiceTier } from './plan/planCustomerSat'
export {
    getCalculatedTruckCount,
    getEffectiveMinTrucks,
    getOrderPourDurationMinutes,
    getOrderPourRate,
    getRequiredTrucksForPourRate,
    isBigPourOrder,
    isCancelledOrder,
    isExcludedOrder,
    isTestOrder,
    trucksToHitBigPourGoal
} from './plan/planOrder'
export {
    computeClockInAdherence,
    computeClockInRows,
    computePlantPoolTimeline,
    computePlantPoolTimelines,
    computeSendHomeRows,
    poolAtTime
} from './plan/planPool'
export { computePullUpRows, computeSuggestedSlots, estimateOrderTiming, findNextViableStart } from './plan/planSlots'
export {
    addMinutesToTime,
    formatMinutesClock,
    formatTime,
    formatTimeInput,
    getDayOfWeekForDate,
    getNowCstMinutes,
    getOffsetDate,
    getTodayDate,
    getTomorrowDate,
    minutesToTime,
    offsetDateSkipSunday,
    parseDurationMinutes,
    parseTime,
    percentToTime,
    skipSundayDate,
    timeToMinutes,
    timeToPercent
} from './plan/planTime'
