import { poolAtTime, simulatePoolTimeline } from '../plan/planPool'
import { buildAssignmentHelpTransfers } from '../PlanRuntimeUtility'

/** Sum the net pool delta a set of transfers applies to one plant. */
const netDeltaFor = (transfers, plantCode) =>
    transfers.filter((t) => t.plantCode === plantCode).reduce((sum, t) => sum + t.delta, 0)

/** Count the home-credit (+1) events landing on a plant. */
const creditCountFor = (transfers, plantCode) =>
    transfers.filter((t) => t.plantCode === plantCode && t.delta > 0).length

describe('buildAssignmentHelpTransfers — chained help returns', () => {
    it('credits the home plant once when a help crew continues onward via a direct-load', () => {
        // 408 → 401 help, then 401 → job → 408 direct-load (same crew).
        // Conroe (408) must not get its help back twice.
        const assignments = [
            { driverCount: 2, fromPlant: '408', leaveTime: '10:00', returnPlant: '408', time: '08:00', toPlant: '401' },
            {
                driverCount: 2,
                forOrderId: 'ORD',
                fromPlant: '401',
                leaveTime: '11:00',
                returnPlant: '408',
                time: '08:30',
                toPlant: '406'
            }
        ]
        const transfers = buildAssignmentHelpTransfers(assignments)
        // Only the direct-load's return credits 408 (2 drivers) — the
        // feeder's redundant return is gone.
        expect(creditCountFor(transfers, '408')).toBe(2)
        expect(netDeltaFor(transfers, '408')).toBe(0)
    })

    it('still credits the home plant for an ordinary round-trip help route', () => {
        const assignments = [
            { driverCount: 2, fromPlant: '408', leaveTime: '10:00', returnPlant: '408', time: '08:00', toPlant: '401' }
        ]
        const transfers = buildAssignmentHelpTransfers(assignments)
        // Outbound +2 at 401, return +2 back at 408 → home credited.
        expect(creditCountFor(transfers, '408')).toBe(2)
        expect(netDeltaFor(transfers, '408')).toBe(0)
        expect(netDeltaFor(transfers, '401')).toBe(0)
    })

    it('keeps the feeder return when the onward direct-load covers only part of the crew', () => {
        const assignments = [
            { driverCount: 3, fromPlant: '408', leaveTime: '10:00', returnPlant: '408', time: '08:00', toPlant: '401' },
            {
                driverCount: 1,
                forOrderId: 'ORD',
                fromPlant: '401',
                leaveTime: '11:00',
                returnPlant: '408',
                time: '08:30',
                toPlant: '406'
            }
        ]
        const transfers = buildAssignmentHelpTransfers(assignments)
        // Coverage is partial (1 of 3 continue), so the feeder return is
        // NOT suppressed: all 3 feeder returns + the 1 direct-load return
        // land at 408. Keeping the feeder return is the deliberate tradeoff
        // of the count-coverage rule — only a full continuation is dropped.
        expect(creditCountFor(transfers, '408')).toBe(4)
    })
})

describe('buildAssignmentHelpTransfers — return-leg drive home timing', () => {
    // Ordinary round trip: 408 → 401 help, home to 408. Arrive 401 at 08:00,
    // leave 401 at 10:00, 25-minute drive home. The home plant must regain the
    // crew only after the drive (10:00 + 25 = 10:25), matching the Schedule
    // pool — not the instant they leave the destination.
    const assignments = [
        {
            driverCount: 1,
            fromPlant: '408',
            leaveTime: '10:00',
            returnPlant: '408',
            staggerMinutes: 0,
            time: '08:00',
            timeMode: 'stagger',
            toPlant: '401'
        }
    ]
    const getTravelTime = (from, to) => (from === '401' && to === '408' ? 25 : 30)
    const homeCredit = (transfers) => transfers.find((t) => t.plantCode === '408' && t.delta > 0)

    it('credits the home plant only after the drive home when travel is known', () => {
        expect(homeCredit(buildAssignmentHelpTransfers(assignments, getTravelTime)).time).toBe(625) // 10:00 + 25m
    })

    it('credits at leave time when no travel function is supplied', () => {
        expect(homeCredit(buildAssignmentHelpTransfers(assignments)).time).toBe(600) // 10:00, no drive added
    })
})

describe('driver pool matches planner headcount for chained help', () => {
    // Same scenario the planner-headcount test asserts (see
    // usePlanFlowMetrics.test.js): 408 sends general help to 401, whose crew
    // is loaded direct for a 406 order and turned back to 408. The driver
    // pool (simulatePoolTimeline) must read the pass-through plant 401
    // identically to the planner: it peaks at 20 while the help is present
    // and settles back to its base of 15 once the help leaves for the job —
    // never dropping to 10.
    const assignments = [
        {
            driverCount: 5,
            fromPlant: '408',
            leaveTime: '13:50',
            staggerMinutes: 0,
            time: '05:40',
            timeMode: 'stagger',
            toPlant: '401'
        },
        {
            driverCount: 5,
            forOrderId: 'J406',
            fromPlant: '401',
            leaveTime: '14:05',
            returnPlant: '408',
            staggerMinutes: 0,
            time: '10:10',
            timeMode: 'stagger',
            toPlant: '406'
        }
    ]
    const initialPoolByCode = { 401: 15, 406: 10, 408: 15 }
    const { timelineByPlant } = simulatePoolTimeline(
        [],
        initialPoolByCode,
        null,
        buildAssignmentHelpTransfers(assignments)
    )

    it('keeps the pass-through plant at its base, peaking only while help is on the lot', () => {
        const t401 = timelineByPlant['401']
        expect(poolAtTime(t401, 360)).toBe(20) // 06:00 — help landed, not yet on the job
        expect(poolAtTime(t401, 840)).toBe(15) // 14:00 — help gone to the job, back to base (not 10)
    })

    it('debits the source plant only while its help is away', () => {
        const t408 = timelineByPlant['408']
        expect(poolAtTime(t408, 840)).toBe(10) // 14:00 — crew still out
        expect(poolAtTime(t408, 900)).toBe(15) // 15:00 — crew back home
    })
})
