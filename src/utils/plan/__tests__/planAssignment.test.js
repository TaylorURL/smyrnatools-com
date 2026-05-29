import { isAssignmentTimingComplete } from '../planAssignment'

/**
 * Sending help requires an arrival AND leave time for every operator. The
 * route editor disables the save and `submitEditor` guards on this, so the
 * helper must reject any draft with a missing time in either scheduling mode.
 */
describe('isAssignmentTimingComplete', () => {
    describe('stagger mode', () => {
        it('is complete when both arrival and leave times are set', () => {
            expect(
                isAssignmentTimingComplete({
                    driverCount: 3,
                    leaveTime: '12:00',
                    staggerMinutes: 5,
                    time: '08:00',
                    timeMode: 'stagger'
                })
            ).toBe(true)
        })

        it('is incomplete when the leave time is missing', () => {
            expect(
                isAssignmentTimingComplete({
                    driverCount: 3,
                    leaveTime: '',
                    staggerMinutes: 5,
                    time: '08:00',
                    timeMode: 'stagger'
                })
            ).toBe(false)
        })

        it('is incomplete when the arrival time is missing', () => {
            expect(
                isAssignmentTimingComplete({ driverCount: 1, leaveTime: '12:00', time: '', timeMode: 'stagger' })
            ).toBe(false)
        })
    })

    describe('custom (per-operator) mode', () => {
        it('is complete when every operator row has an arrival and leave', () => {
            expect(
                isAssignmentTimingComplete({
                    customTimes: [
                        { leaveTime: '12:00', time: '08:00' },
                        { leaveTime: '12:30', time: '08:30' }
                    ],
                    driverCount: 2,
                    timeMode: 'custom'
                })
            ).toBe(true)
        })

        it('is incomplete when an operator row is missing its leave time', () => {
            expect(
                isAssignmentTimingComplete({
                    customTimes: [
                        { leaveTime: '12:00', time: '08:00' },
                        { leaveTime: '', time: '08:30' }
                    ],
                    driverCount: 2,
                    timeMode: 'custom'
                })
            ).toBe(false)
        })

        it('is incomplete when there are fewer rows than operators', () => {
            expect(
                isAssignmentTimingComplete({
                    customTimes: [{ leaveTime: '12:00', time: '08:00' }],
                    driverCount: 2,
                    timeMode: 'custom'
                })
            ).toBe(false)
        })
    })

    it('is incomplete when no operators are sent', () => {
        expect(
            isAssignmentTimingComplete({ driverCount: 0, leaveTime: '12:00', time: '08:00', timeMode: 'stagger' })
        ).toBe(false)
    })

    it('is incomplete for an empty or null assignment', () => {
        expect(isAssignmentTimingComplete(null)).toBe(false)
        expect(isAssignmentTimingComplete({})).toBe(false)
    })
})
