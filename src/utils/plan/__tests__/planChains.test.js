import { buildSuppressedReturnIndexes } from '../planChains'

/** Build a plain help route (no direct-load job). */
const help = (fromPlant, toPlant, driverCount, returnPlant) => ({
    driverCount,
    fromPlant,
    returnPlant,
    toPlant
})

/** Build a direct-load route loading for a specific order. */
const directLoad = (fromPlant, toPlant, driverCount, returnPlant, forOrderId = 'ORD') => ({
    driverCount,
    forOrderId,
    fromPlant,
    returnPlant,
    toPlant
})

describe('buildSuppressedReturnIndexes', () => {
    it('suppresses a help route whose whole crew continues onward via a direct-load home', () => {
        // 408 → 401 help, then 401 → job → 408 direct-load: the 401 → 408
        // return would otherwise animate (and credit 408) twice.
        const assignments = [help('408', '401', 3, '408'), directLoad('401', '406', 3, '408')]
        expect(buildSuppressedReturnIndexes(assignments)).toEqual(new Set([0]))
    })

    it('keeps the return when the onward direct-load covers only part of the crew', () => {
        // 3 sent to 401, but only 2 continue — the other driver really goes home.
        const assignments = [help('408', '401', 3, '408'), directLoad('401', '406', 2, '408')]
        expect(buildSuppressedReturnIndexes(assignments)).toEqual(new Set())
    })

    it('sums multiple onward direct-loads when deciding coverage', () => {
        const assignments = [
            help('408', '401', 5, '408'),
            directLoad('401', '406', 3, '408'),
            directLoad('401', '402', 2, '408', 'ORD2')
        ]
        expect(buildSuppressedReturnIndexes(assignments)).toEqual(new Set([0]))
    })

    it('suppresses even when the onward direct-load returns to a different plant', () => {
        // 408 → 401 help, then 401 loads that crew for a 406 job and turns
        // them back to Conroe. The crew never drives 401 → 408, so the help
        // return is still redundant — where the onward load ends up is the
        // onward load's own return leg to account for, not this one's.
        const assignments = [help('408', '401', 3, '408'), directLoad('401', '406', 3, 'Conroe')]
        expect(buildSuppressedReturnIndexes(assignments)).toEqual(new Set([0]))
    })

    it('consumes onward coverage so one onward crew suppresses only one help route', () => {
        // Two help crews land at 401, but only one crew (3) continues onward.
        // The first help route is covered; the second still drives home.
        const assignments = [
            help('408', '401', 3, '408'),
            help('410', '401', 3, '410'),
            directLoad('401', '406', 3, 'Conroe')
        ]
        expect(buildSuppressedReturnIndexes(assignments)).toEqual(new Set([0]))
    })

    it('never suppresses a direct-load route itself', () => {
        const assignments = [directLoad('401', '406', 3, '408'), directLoad('406', '407', 3, '408', 'ORD2')]
        expect(buildSuppressedReturnIndexes(assignments)).toEqual(new Set())
    })

    it('does not suppress a help route with no onward continuation', () => {
        const assignments = [help('408', '401', 3, '408'), help('410', '402', 2, '410')]
        expect(buildSuppressedReturnIndexes(assignments)).toEqual(new Set())
    })

    it("suppresses on onward continuation regardless of either route's return plant", () => {
        // Neither route names a returnPlant — irrelevant now. The help crew
        // dropped at 401 is fully carried onward by the direct-load leaving
        // 401, so the help return is redundant.
        const assignments = [help('408', '401', 2), directLoad('401', '406', 2)]
        expect(buildSuppressedReturnIndexes(assignments)).toEqual(new Set([0]))
    })

    it('ignores help routes with no operators', () => {
        const assignments = [help('408', '401', 0, '408'), directLoad('401', '406', 3, '408')]
        expect(buildSuppressedReturnIndexes(assignments)).toEqual(new Set())
    })

    it('returns an empty set for non-array input', () => {
        expect(buildSuppressedReturnIndexes(null)).toEqual(new Set())
        expect(buildSuppressedReturnIndexes(undefined)).toEqual(new Set())
    })
})
