import { DEFAULT_TRAVEL_OUT_MIN, PER_LOAD_POUR_MIN, REST_HOURS_MIN } from '../../app/constants/bookOrderConstants'
import { parseDurationMinutes } from '../PlanUtility'

/** Parse "HH:MM" or "HH:MM:SS" into minutes-of-day. Returns null on
 *  malformed input — matches the way dispatch's `loaded_time` cells come
 *  through. */
const parseHhmmToMin = (value) => {
    const parts = String(value || '').split(':')
    if (parts.length < 2) return null
    const h = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null
    return h * 60 + m
}

/** Estimated round-trip cycle for a single dispatch ticket — travel out +
 *  one-load discharge + travel back — using the order's actual `toJobTime`
 *  / `toPlantTime` HH:MM cells when present, defaults otherwise. */
const projectTicketCycleMin = (order) => {
    const travelOut = parseDurationMinutes(order?.toJobTime) ?? DEFAULT_TRAVEL_OUT_MIN
    const travelBackRaw = parseDurationMinutes(order?.toPlantTime)
    const travelBack = Number.isFinite(travelBackRaw) ? travelBackRaw : travelOut
    return travelOut + PER_LOAD_POUR_MIN + travelBack
}

/** Builds a `Map(orderId → order)` from yesterday's production data so each
 *  ticket can be resolved to its order's travel times when projecting
 *  back-at-yard. */
function buildOrderById(yesterdayProduction) {
    const orderById = new Map()
    Object.entries(yesterdayProduction || {}).forEach(([code, block]) => {
        const orders = Array.isArray(block?.orders) ? block.orders : []
        orders.forEach((order) => {
            if (order?.orderId) orderById.set(order.orderId, { ...order, plantCode: code })
        })
    })
    return orderById
}

/** For each truck in yesterday's tickets, find the LATEST projected
 *  back-at-yard. Returns `Map(truckNum → { plantCode, latestBackAtYardMin })`. */
function buildPerTruckLatestBackAtYard(yesterdayDetail, orderById) {
    const perTruck = new Map()
    Object.values(yesterdayDetail).forEach((detail) => {
        const tickets = Array.isArray(detail?.tickets) ? detail.tickets : []
        tickets.forEach((ticket) => {
            const truckNum = String(ticket?.truckNum || '').trim()
            if (!truckNum) return
            const loadedMin = parseHhmmToMin(ticket?.loadedTime)
            if (!Number.isFinite(loadedMin)) return
            const order = orderById.get(detail.orderId)
            const backAtYard = loadedMin + projectTicketCycleMin(order)
            const plantCode = String(ticket.plantId || order?.plantCode || '').trim()
            if (!plantCode) return
            const existing = perTruck.get(truckNum)
            if (!existing || existing.latestBackAtYardMin < backAtYard) {
                perTruck.set(truckNum, { latestBackAtYardMin: backAtYard, plantCode })
            }
        })
    })
    return perTruck
}

/**
 * Today's earliest legal first-load-out per plant, derived from
 * yesterday's actual dispatch tickets. For each truck that loaded at a
 * plant yesterday, we project its last back-at-yard from the ticket's
 * `loadedTime` plus the order's travel cycle, add the 10-hour DOT rest
 * window, and keep the minimum across that plant's trucks (the earliest
 * the plant could dispatch a single truck today). Returns
 * `{ [plantCode]: minutesOfDay }`. Plants with no yesterday activity are
 * omitted — callers can fall back to the schedule-derived floor for
 * those.
 */
export const computeRestFloorByPlant = (yesterdayDetail, yesterdayProduction) => {
    if (!yesterdayDetail || typeof yesterdayDetail !== 'object') return {}
    const orderById = buildOrderById(yesterdayProduction)
    const perTruck = buildPerTruckLatestBackAtYard(yesterdayDetail, orderById)
    const byPlant = {}
    perTruck.forEach(({ latestBackAtYardMin, plantCode }) => {
        // back-at-yard + 10h rest, mapped onto today's clock. If the rest
        // window ends before midnight today (e.g. truck back at 10:00 +
        // 10h = 20:00 same day), the operator is free all of today and
        // the floor collapses to 0.
        const earliestClockInTodayMin = Math.max(0, latestBackAtYardMin + REST_HOURS_MIN - 24 * 60)
        if (byPlant[plantCode] == null || byPlant[plantCode] > earliestClockInTodayMin) {
            byPlant[plantCode] = earliestClockInTodayMin
        }
    })
    return byPlant
}
