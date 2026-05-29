/** Detect help routes whose return leg is made redundant by an onward
 *  direct-load.
 *
 *  When a plain help route drops a crew at a plant and one or more
 *  direct-load routes then carry that whole crew onward from that plant, the
 *  help route's own return is redundant: the operators don't drive home from
 *  the help destination, they continue to the job and home from there.
 *  Counting both legs debits the drop plant twice — once when the help
 *  "returns" and once when the onward load departs — which is the reported
 *  bug (408 → 401 help, 401 loads it for a 406 job and turns it back to
 *  Conroe, and 401 ends the day short the trucks it only passed through).
 *
 *  Where the onward load ultimately returns is irrelevant to this decision:
 *  that load carries its own return leg, which credits whatever plant the
 *  crew actually finishes at (Conroe, the original home, anywhere). All this
 *  function decides is whether the help crew left the drop plant by
 *  continuing onward rather than by driving home.
 *
 *  Coverage is counted by operators: a help route's return is only dropped
 *  when the onward direct-load(s) leaving the drop plant account for its
 *  entire crew. A partial continuation (fewer onward operators than were
 *  sent) keeps the return, since some of those operators really do drive
 *  straight home. Onward coverage is consumed as it is claimed, so two help
 *  routes feeding the same plant can't both be suppressed by a single
 *  onward crew.
 *
 *  Only plain help routes (no `forOrderId`) qualify — a direct-load's crew
 *  ends its day at a job site, not at a plant another route departs from.
 *
 *  @param {Array<object>} assignments — planner assignments.
 *  @returns {Set<number>} indices whose return leg should be dropped.
 */
export const buildSuppressedReturnIndexes = (assignments) => {
    if (!Array.isArray(assignments)) return new Set()

    // Onward direct-load operators departing each plant, summed across loads.
    const onwardOperatorsByOrigin = new Map()
    for (const assignment of assignments) {
        if (!assignment?.forOrderId || !assignment.fromPlant) continue
        const operators = parseInt(assignment.driverCount, 10) || 0
        if (operators <= 0) continue
        onwardOperatorsByOrigin.set(
            assignment.fromPlant,
            (onwardOperatorsByOrigin.get(assignment.fromPlant) || 0) + operators
        )
    }

    const suppressed = new Set()
    assignments.forEach((assignment, index) => {
        if (!assignment || assignment.forOrderId || !assignment.fromPlant || !assignment.toPlant) return
        const operatorsSent = parseInt(assignment.driverCount, 10) || 0
        if (operatorsSent <= 0) return
        const onwardAvailable = onwardOperatorsByOrigin.get(assignment.toPlant) || 0
        if (onwardAvailable < operatorsSent) return
        suppressed.add(index)
        onwardOperatorsByOrigin.set(assignment.toPlant, onwardAvailable - operatorsSent)
    })
    return suppressed
}
