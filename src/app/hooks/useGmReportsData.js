import { useEffect, useState } from 'react'

import { Database } from '../../services/DatabaseService'
import { ReportUtility } from '../../utils/ReportUtility'

const normalizeUpper = (s) =>
    String(s || '')
        .trim()
        .toUpperCase()

const normalizeNumeric = (s) => {
    const t = String(s || '').trim()
    const d = t.replace(/^0+/, '')
    return d.length ? d : t.toUpperCase()
}

const toMondayIso = (d) => {
    if (!d) return ''
    const dt = new Date(d)
    if (isNaN(dt)) return ''
    return ReportUtility.getMondayISO(dt)
}

const sameIsoDay = (a, b) => a && b && a.slice(0, 10) === b.slice(0, 10)

/** Builds a `[qStart, qEnd]` ISO window centered on the Monday of `weekIso`,
 *  extending one day back and 8 days forward. Used for all the lookups
 *  that filter by `week` BETWEEN. */
function buildWeekWindow(weekIso, weekOffset = 0) {
    const targetMondayIso = ReportUtility.getMondayISO(weekIso)
    if (!targetMondayIso) return null
    const targetMondayDate = new Date(targetMondayIso + 'T00:00:00Z')
    if (weekOffset) targetMondayDate.setUTCDate(targetMondayDate.getUTCDate() + weekOffset * 7)
    const prevSunday = new Date(targetMondayDate)
    prevSunday.setUTCDate(prevSunday.getUTCDate() - 1)
    const windowEnd = new Date(targetMondayDate)
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 8)
    return {
        qEnd: windowEnd.toISOString(),
        qStart: prevSunday.toISOString(),
        targetMondayIso: ReportUtility.getMondayISO(targetMondayDate)
    }
}

/** Query reports for the given report type within `window`, with a
 *  fallback to `report_date_range_start` when no rows match on `week`. */
async function fetchReportsInWindow(reportName, window, extraEq) {
    const baseSelect = 'id,data,week,report_date_range_start,completed,submitted_at'
    let query = Database.from('reports').select(baseSelect).eq('report_name', reportName)
    if (extraEq) query = query.eq(extraEq.field, extraEq.value)
    let { data } = await query.gte('week', window.qStart).lt('week', window.qEnd)
    if (!Array.isArray(data)) data = []
    if (data.length === 0) {
        let fallback = Database.from('reports').select(baseSelect).eq('report_name', reportName)
        if (extraEq) fallback = fallback.eq(extraEq.field, extraEq.value)
        const resp = await fallback
            .gte('report_date_range_start', window.qStart)
            .lt('report_date_range_start', window.qEnd)
        if (Array.isArray(resp.data)) data = resp.data
    }
    return data
}

/** Picks completed first, then most-recently-submitted, then any. */
function pickBestReport(reports) {
    const sorted = reports.slice().sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? -1 : 1
        return (b.submitted_at || '').localeCompare(a.submitted_at || '')
    })
    return sorted.find((a) => a.completed) || sorted[0] || null
}

/** Dedupes plant-production rows by normalized plant code, taking the
 *  completed-and-most-recent row per plant. */
function dedupeByPlant(reports) {
    const byPlant = new Map()
    reports.forEach((r) => {
        const k = normalizeUpper(r.data.plant)
        const prev = byPlant.get(k)
        if (!prev) {
            byPlant.set(k, r)
            return
        }
        const take =
            prev.completed !== r.completed
                ? r.completed
                    ? r
                    : prev
                : (prev.submitted_at || '') < (r.submitted_at || '')
                  ? r
                  : prev
        byPlant.set(k, take)
    })
    return [...byPlant.values()].sort((a, b) => {
        const da = String(a.data.plant || '')
        const db = String(b.data.plant || '')
        const na = parseInt(da.replace(/\D/g, ''), 10)
        const nb = parseInt(db.replace(/\D/g, ''), 10)
        const aIsN = Number.isFinite(na)
        const bIsN = Number.isFinite(nb)
        if (aIsN && bIsN && na !== nb) return na - nb
        if (aIsN && !bIsN) return -1
        if (!aIsN && bIsN) return 1
        return da.localeCompare(db, undefined, { numeric: true, sensitivity: 'base' })
    })
}

/** Loads this-week plant-production reports for the supplied plants,
 *  plus the matching aggregate-production report for the same week. */
function useEffReports(plants, weekIso) {
    const [effReports, setEffReports] = useState([])
    const [aggReport, setAggReport] = useState(null)

    useEffect(() => {
        let cancelled = false
        async function loadEff() {
            const codes = Array.isArray(plants) ? plants.map((p) => p.plant_code).filter(Boolean) : []
            if (!weekIso || codes.length === 0) {
                if (!cancelled) {
                    setEffReports([])
                    setAggReport(null)
                }
                return
            }
            const window = buildWeekWindow(weekIso)
            if (!window) {
                if (!cancelled) {
                    setEffReports([])
                    setAggReport(null)
                }
                return
            }
            const setU = new Set(codes.map(normalizeUpper))
            const setN = new Set(codes.map(normalizeNumeric))
            const prod = await fetchReportsInWindow('plant_production', window)
            const anchorMatches = (r) => {
                const weekField = r.week || r.report_date_range_start || r?.data?.report_date
                return sameIsoDay(toMondayIso(weekField), window.targetMondayIso)
            }
            const effRaw = prod.filter(anchorMatches).filter((r) => {
                const pc = r?.data?.plant
                if (!pc) return false
                return setU.has(normalizeUpper(pc)) || setN.has(normalizeNumeric(pc))
            })
            const effFinal = dedupeByPlant(effRaw)
            if (cancelled) return
            setEffReports(
                effFinal.map((r) => ({
                    completed: r.completed,
                    data: r.data,
                    id: r.id,
                    plant_code: r.data.plant,
                    plant_name: r.data.plant,
                    report_date: r.data.report_date || '',
                    rows: Array.isArray(r.data.rows) ? r.data.rows : [],
                    submitted_at: r.submitted_at
                }))
            )
            const agg = await fetchReportsInWindow('aggregate_production', window)
            const aggFiltered = agg.filter((r) =>
                sameIsoDay(toMondayIso(r.week || r.report_date_range_start), window.targetMondayIso)
            )
            if (!cancelled) setAggReport(pickBestReport(aggFiltered))
        }
        loadEff()
        return () => {
            cancelled = true
        }
    }, [plants, weekIso])

    return { aggReport, effReports }
}

/** Loads the previous-week aggregate report for variance comparison. */
function useLastWeekAgg(weekIso) {
    const [lastWeekAgg, setLastWeekAgg] = useState(null)
    useEffect(() => {
        let cancelled = false
        async function load() {
            if (!weekIso) {
                if (!cancelled) setLastWeekAgg(null)
                return
            }
            const window = buildWeekWindow(weekIso, -1)
            if (!window) {
                if (!cancelled) setLastWeekAgg(null)
                return
            }
            const agg = await fetchReportsInWindow('aggregate_production', window)
            const aggFiltered = agg.filter((r) =>
                sameIsoDay(toMondayIso(r.week || r.report_date_range_start), window.targetMondayIso)
            )
            if (!cancelled) setLastWeekAgg(pickBestReport(aggFiltered))
        }
        load()
        return () => {
            cancelled = true
        }
    }, [weekIso])
    return lastWeekAgg
}

/** Loads the previous-week general_manager report for this user — used
 *  to compute Last Week / Variance columns. */
function useLastWeekGm(weekIso, userId) {
    const [lastWeekGm, setLastWeekGm] = useState(null)
    useEffect(() => {
        let cancelled = false
        async function load() {
            if (!weekIso) {
                setLastWeekGm(null)
                return
            }
            const window = buildWeekWindow(weekIso, -1)
            if (!window) {
                setLastWeekGm(null)
                return
            }
            const reports = await fetchReportsInWindow('general_manager', window, { field: 'user_id', value: userId })
            if (!cancelled) setLastWeekGm(pickBestReport(reports))
        }
        load()
        return () => {
            cancelled = true
        }
    }, [weekIso, userId])
    return lastWeekGm
}

/** Loads the matching Ready Mix Instructor report for this week. */
function useRmiReport(weekIso, plants) {
    const [rmiReport, setRmiReport] = useState(null)
    const [rmiLoading, setRmiLoading] = useState(true)
    useEffect(() => {
        async function fetchRMIReport() {
            if (!weekIso || !plants?.length) {
                setRmiReport(null)
                setRmiLoading(false)
                return
            }
            const window = buildWeekWindow(weekIso)
            if (!window) {
                setRmiReport(null)
                setRmiLoading(false)
                return
            }
            try {
                let { data: reports } = await Database.from('reports')
                    .select('id,data,week,submitted_at,completed')
                    .eq('report_name', 'ready_mix_instructor')
                    .gte('week', window.qStart)
                    .lt('week', window.qEnd)
                if (!Array.isArray(reports)) reports = []
                const filtered = reports.filter((r) => {
                    const mondayIso = r.week ? ReportUtility.getMondayISO(r.week) : ''
                    return mondayIso === window.targetMondayIso
                })
                if (filtered.length > 0) {
                    const sorted = filtered.sort((a, b) => {
                        if (a.completed !== b.completed) return b.completed ? 1 : -1
                        return (b.submitted_at || '') > (a.submitted_at || '') ? 1 : -1
                    })
                    setRmiReport(sorted[0].data)
                } else {
                    setRmiReport(null)
                }
            } catch (error) {
                setRmiReport(null)
            } finally {
                setRmiLoading(false)
            }
        }
        fetchRMIReport()
    }, [weekIso, plants])
    return { rmiLoading, rmiReport }
}

/** Top-level hook for the General Manager report — exposes:
 *  - effReports / aggReport (this week)
 *  - lastWeekAgg / lastWeekGm (previous week for variance)
 *  - rmiReport (embedded Ready Mix Instructor summary). */
export function useGmReportsData(plants, weekIso, userId) {
    const { effReports, aggReport } = useEffReports(plants, weekIso)
    const lastWeekAgg = useLastWeekAgg(weekIso)
    const lastWeekGm = useLastWeekGm(weekIso, userId)
    const { rmiReport, rmiLoading } = useRmiReport(weekIso, plants)
    return { aggReport, effReports, lastWeekAgg, lastWeekGm, rmiLoading, rmiReport }
}
