/* BookOrderUtility — barrel re-export.
 *
 * Domain constants live in src/app/constants/bookOrderConstants and the
 * logic is split into focused modules under src/utils/book-order/:
 *   - bookOrderAddressing       — ZIP/state/token + scoreProximity
 *   - bookOrderMath             — pour-duration, truck-count, concurrent-trucks
 *   - bookOrderRestFloor        — yesterday-ticket DOT rest computation
 *   - bookOrderSlotHelpers      — scan-grid + shift-cap + isolation helpers
 *   - bookOrderRanking          — plant scoring + ranking
 *   - bookOrderStartTimes       — alternate / recommended start-time scans
 *   - bookOrderHelpAvailability — inter-plant lending candidates
 *   - bookOrderBestEffort       — earliest-day-wins coverable slot
 *   - bookOrderConflict         — full diagnosis + buildBookingRequest + tone/label
 *
 * Every previously exported name is still available from this module so the
 * existing consumers don't need to change. */

export {
    DEFAULT_LOAD_SIZE_YARDS,
    DEFAULT_POUR_TAIL_MIN,
    DEFAULT_TRAVEL_OUT_MIN,
    DEFAULT_TRUCK_SPACING_MIN,
    MAX_CONCURRENT_LAUNCHES_PER_PLANT,
    MAX_HELP_TRAVEL_MIN_FROM_PLANT,
    POUR_METHOD_OPTIONS,
    SHIFT_LIMIT_MIN,
    TRAVEL_MIN_HORIZON
} from '../app/constants/bookOrderConstants'
export { extractStateCode, extractZip, scoreProximity, tokenizeAddress } from './book-order/bookOrderAddressing'
export { findBestEffortSlot } from './book-order/bookOrderBestEffort'
export { buildBookingRequest, computeBookingConflict, scoreLabel, scoreTone } from './book-order/bookOrderConflict'
export { findHelpAvailability } from './book-order/bookOrderHelpAvailability'
export {
    computeConcurrentTrucks,
    countOrdersAtSameStart,
    estimatePourDurationMinutes,
    estimateRequiredTrucks,
    getPourMethodTimings
} from './book-order/bookOrderMath'
export { rankPlantsForBooking, scorePlantForBooking } from './book-order/bookOrderRanking'
export { computeRestFloorByPlant } from './book-order/bookOrderRestFloor'
export { findAlternateStartTimes, findRecommendedStartTime } from './book-order/bookOrderStartTimes'
