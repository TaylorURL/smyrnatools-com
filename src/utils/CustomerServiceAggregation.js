/** Aggregate a list of per-order service verdicts into the customer-level
 *  rollup the Statistics → Customer Lookup detail uses. Same shape so the
 *  Call List can render the exact same context card by calling the same
 *  primitive instead of re-deriving counts inline.
 *
 *  Each input order is the shape produced by `scoreOrderExperience` +
 *  light wrapping (date, plantCode, kicker fields). Unmeasured orders
 *  should be filtered out before calling this — every row in the input
 *  contributes to `jobs`.
 *
 *  Returns `null` when given an empty list so the caller can short-circuit
 *  the rendering. */
export const aggregateCustomerVerdicts = (orders) => {
    if (!Array.isArray(orders) || orders.length === 0) return null
    let lateJobs = 0
    let slowJobs = 0
    let lateLatenessSum = 0
    let worstLateMin = 0
    let badJobs = 0
    let lastPourDate = ''
    const tierCounts = { bad: 0, good: 0, notGood: 0, veryBad: 0 }
    for (const m of orders) {
        if (m.isBad) badJobs += 1
        if (m.isLate) {
            lateJobs += 1
            lateLatenessSum += m.latenessMin || 0
            if ((m.latenessMin || 0) > worstLateMin) worstLateMin = m.latenessMin || 0
        }
        if (m.isSlow) slowJobs += 1
        if (m.tier && tierCounts[m.tier] != null) tierCounts[m.tier] += 1
        if (m.date && m.date > lastPourDate) lastPourDate = m.date
    }
    const jobs = orders.length
    const goodJobs = jobs - badJobs
    return {
        avgLateMin: lateJobs > 0 ? lateLatenessSum / lateJobs : 0,
        badJobs,
        goodJobs,
        goodPct: jobs > 0 ? goodJobs / jobs : 0,
        jobs,
        lastPourDate,
        lateJobs,
        slowJobs,
        tierCounts,
        worstLateMin
    }
}
