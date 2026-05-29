/**
 * usePlanFlowMetrics — `effAtViewTime` headcount for a chained help route.
 *
 * Scenario (the reported bug): 408 sends general help to 401, whose crew is
 * then loaded direct for a 406 order and turned back to 408. The 408→401 leg
 * carries its own 13:50 leave time, but that time is a phantom — the crew
 * actually leaves 401 for the job (~09:20), not by driving home. The
 * pass-through plant (401) must read its base all afternoon, never dropping
 * below it just because the inbound leg's phantom leave time elapsed.
 */

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { usePlanFlowMetrics } from '../usePlanFlowMetrics'

const stats = [
    { base: 15, code: '401', rawBase: 15 },
    { base: 15, code: '408', rawBase: 15 },
    { base: 10, code: '406', rawBase: 10 }
]

// 408 → 401 general help (no job), arrives 05:40, phantom return 13:50.
// 401 → 406 direct-load for order J406, leaves job 14:05, returns to 408.
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

const getTravelTime = (from, to) => {
    if (from === '408' && to === '401') return 50
    if (from === '401' && to === '406') return 35
    if (from === '406' && to === '408') return 35
    return 30
}

const renderAt = (viewTime) =>
    renderHook(() =>
        usePlanFlowMetrics({
            assignments,
            getTravelTime,
            planDate: '2026-05-28',
            plantProduction: {},
            stats,
            viewTime
        })
    ).result.current.effAtViewTime

describe('usePlanFlowMetrics effAtViewTime — chained help pass-through', () => {
    it('shows the help present at the pass-through plant before it leaves for the job', () => {
        // 06:00 — help has landed at 401, has not yet left for the 406 job.
        expect(renderAt(360)['401']).toBe(20)
        expect(renderAt(360)['408']).toBe(10)
    })

    it("keeps the pass-through plant at base after the inbound leg's phantom leave time", () => {
        // 14:00 — past the 408→401 leg's phantom 13:50 leave. The crew is at
        // the 406 job, NOT back at 401, so 401 must read its base of 15, not
        // drop to 10 by expiring the arrival credit while the onward debit lives on.
        expect(renderAt(840)['401']).toBe(15)
    })
})
