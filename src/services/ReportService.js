import { reportTypes } from '../app/types/ReportTypes'
import APIUtility from '../utils/APIUtility'
import CacheUtility from '../utils/CacheUtility'
import * as ReportComputationUtility from '../utils/ReportComputationUtility'
import { ReportUtility } from '../utils/ReportUtility'
import { Database } from './DatabaseService'
import { PlantService } from './PlantService'
import { UserService } from './UserService'

const REPORT_FUNCTION = '/report-service'
const postReport = (endpoint, body) => APIUtility.post(`${REPORT_FUNCTION}/${endpoint}`, body)
const TTL_SHORT = 5 * 60 * 1000
const TTL_MED = 10 * 60 * 1000
/** Sorts plants by plant_code numerically, falling back to string comparison. */
function sortPlants(plants) {
    return (plants || [])
        .filter((p) => p.plant_code && p.plant_name)
        .sort((a, b) => {
            const aNum = parseInt(a.plant_code, 10)
            const bNum = parseInt(b.plant_code, 10)
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
            return String(a.plant_code).localeCompare(String(b.plant_code))
        })
}
/**
 * Weekly report management service handling plant manager, general manager,
 * efficiency, and RMI reports. Provides date utilities, production insights,
 * yardage metrics, overdue assignment detection, and cached data fetching.
 */
class ReportServiceImpl {
    /** Formats a week ISO into a human-readable "MM-DD-YY through MM-DD-YY" range. */
    getWeekRangeFromIso(...args) {
        return ReportComputationUtility.getWeekRangeFromIso(...args)
    }
    /** Calculates the Monday and Saturday bounding a given date. */
    getMondayAndSaturday(...args) {
        return ReportComputationUtility.getMondayAndSaturday(...args)
    }
    /** Returns the ISO date string (YYYY-MM-DD) for the Monday of a given date's week. */
    getMondayISO(...args) {
        return ReportComputationUtility.getMondayISO(...args)
    }
    /** Formats two Date objects into a "MM-DD-YY through MM-DD-YY" range string. */
    getWeekRangeString(...args) {
        return ReportComputationUtility.getWeekRangeString(...args)
    }
    /** Extracts the plant code from a report's data structure. */
    getPlantNameFromReport(...args) {
        return ReportComputationUtility.getPlantNameFromReport(...args)
    }
    getPlantNameFromWeekItem(...args) {
        return ReportComputationUtility.getPlantNameFromWeekItem(...args)
    }
    /** Parses a "HH:MM" time string into total minutes. */
    parseTimeToMinutes(...args) {
        return ReportComputationUtility.parseTimeToMinutes(...args)
    }
    /** Resolves an operator's display name from row data and operator options. */
    getOperatorName(...args) {
        return ReportComputationUtility.getOperatorName(...args)
    }
    /**
     * Computes yardage efficiency metrics (yards per hour, lost yardage)
     * with performance grades from form data using multiple possible field name formats.
     */
    getYardageMetrics(...args) {
        return ReportComputationUtility.getYardageMetrics(...args)
    }
    /** Maps a yardage performance grade to its Tailwind text color class. */
    getYphColor(...args) {
        return ReportComputationUtility.getYphColor(...args)
    }
    /**
     * Analyzes per-row production data for a plant, computing totals, averages,
     * and flagging efficiency warnings (late starts, long hours, low loads).
     */
    getPlantProductionInsights(...args) {
        return ReportComputationUtility.getPlantProductionInsights(...args)
    }
    /** Fetches active mixer operator counts (assigned + unassigned) grouped by plant code. */
    async fetchActiveMixerCountsByPlant(plantCodes = []) {
        if (!plantCodes || plantCodes.length === 0) return {}
        const [mixersResult, operatorsResult] = await Promise.all([
            Database.from('mixers')
                .select('assigned_plant, assigned_operator')
                .eq('status', 'Active')
                .in('assigned_plant', plantCodes),
            Database.from('operators')
                .select('employee_id, plant_code')
                .eq('status', 'Active')
                .eq('position', 'Mixer Operator')
                .in('plant_code', plantCodes)
        ])
        const counts = {}
        plantCodes.forEach((code) => {
            counts[code] = 0
        })
        if (mixersResult.error || !Array.isArray(mixersResult.data)) return counts
        const assignedOperatorIds = new Set()
        mixersResult.data.forEach((m) => {
            if (m.assigned_operator) assignedOperatorIds.add(m.assigned_operator)
        })
        if (!operatorsResult.error && Array.isArray(operatorsResult.data)) {
            operatorsResult.data.forEach((op) => {
                if (op.plant_code && counts[op.plant_code] !== undefined) {
                    counts[op.plant_code]++
                }
            })
        }
        return counts
    }
    /** Fetches all plants sorted by code with a 10-minute cache. The
     *  Plan → Planner tab consumes `latitude` / `longitude` from these
     *  rows to anchor each plant marker to its real location on the
     *  map, so include them in the select — otherwise plants with
     *  authoritative DB coords silently fall back to geocoding (or fail
     *  outright when their address isn't in OSM). */
    async fetchPlantsSorted() {
        // Cache key bumped to `:v4` because the select now includes
        // `colocated_alias_codes` — older cache entries were missing it
        // and would silently strip the phantom-code co-location
        // mappings for everyone with a warm cache when this lands.
        const cacheKey = 'plants:all:v4'
        const cached = CacheUtility.get(cacheKey)
        if (cached) return cached
        const { data, error } = await Database.from('plants')
            .select('plant_code,plant_name,plant_address,latitude,longitude,location_group_id,colocated_alias_codes')
            .order('plant_code', { ascending: true })
        const plants = !error && Array.isArray(data) ? sortPlants(data) : []
        CacheUtility.set(cacheKey, plants, TTL_MED)
        return plants
    }
    /**
     * Fetches plants accessible to a user based on their profile plant
     * and region memberships, with a 5-minute cache.
     */
    async fetchPlantsForUser(userId) {
        if (!userId) return []
        const cacheKey = `plants:user:${userId}`
        const cached = CacheUtility.get(cacheKey)
        if (cached) return cached
        const basePlants = await this.fetchPlantsSorted()
        try {
            const userPlant = await UserService.getUserPlant(userId)
            if (!userPlant) {
                CacheUtility.set(cacheKey, [], TTL_SHORT)
                return []
            }
            const regions = await PlantService.fetchRegionsByPlantCode(userPlant)
            const regionCodes = Array.isArray(regions) ? regions.map((r) => r.regionCode).filter(Boolean) : []
            if (regionCodes.length === 0) {
                CacheUtility.set(cacheKey, [], TTL_SHORT)
                return []
            }
            const results = await Promise.all(regionCodes.map((rc) => PlantService.fetchRegionPlants(rc)))
            const allowedCodes = new Set()
            results.forEach((list) => {
                const listArr = list || []
                listArr.forEach((rp) => {
                    const c = rp.plantCode || rp.plant_code
                    if (c) allowedCodes.add(String(c).trim())
                })
            })
            const filtered = basePlants.filter((p) => allowedCodes.has(String(p.plant_code).trim()))
            CacheUtility.set(cacheKey, filtered, TTL_SHORT)
            return filtered
        } catch {
            CacheUtility.set(cacheKey, [], TTL_SHORT)
            return []
        }
    }
    /** Fetches operator name/ID options for a plant for use in report dropdowns. */
    async fetchOperatorOptions(plantCode) {
        if (!plantCode) return []
        const key = `operators:${plantCode}`
        const cached = CacheUtility.get(key)
        if (cached) return cached
        const { data, error } = await Database.from('operators').select('employee_id, name').eq('plant_code', plantCode)
        const options = !error && Array.isArray(data) ? data.map((u) => ({ label: u.name, value: u.employee_id })) : []
        CacheUtility.set(key, options, TTL_SHORT)
        return options
    }
    /** Fetches active operators and mixers for a plant for report context. */
    async fetchActiveOperatorsAndMixers(plantCode) {
        if (!plantCode) return { activeOperators: [], mixers: [], operatorOptions: [] }
        const key = `activeOpsAndMixers:${plantCode}`
        const cached = CacheUtility.get(key)
        if (cached) return cached
        const [opsRes, mixRes] = await Promise.all([
            Database.from('operators')
                .select('employee_id, name, status, plant_code, position')
                .eq('plant_code', plantCode)
                .eq('status', 'Active')
                .eq('position', 'Mixer Operator'),
            Database.from('mixers').select('assigned_operator, truck_number').eq('assigned_plant', plantCode)
        ])
        const operatorOptions =
            !opsRes.error && Array.isArray(opsRes.data)
                ? opsRes.data.map((u) => ({ label: u.name, value: u.employee_id }))
                : []
        const mixers = !mixRes.error && Array.isArray(mixRes.data) ? mixRes.data : []
        const result = { activeOperators: opsRes.data || [], mixers, operatorOptions }
        CacheUtility.set(key, result, TTL_SHORT)
        return result
    }
    /** Fetches completed maintenance items within a week's date range. */
    async fetchMaintenanceItems(weekIso) {
        if (!weekIso) return []
        const key = `maintenance:${weekIso}`
        const cached = CacheUtility.get(key)
        if (cached) return cached
        const { monday, saturday } = ReportUtility.getWeekDatesFromIso(weekIso)
        if (!monday || !saturday) return []
        const { data, error } = await Database.from('list_items')
            .select('*')
            .eq('completed', true)
            .gte('completed_at', monday.toISOString())
            .lte('completed_at', saturday.toISOString())
        const items = !error && Array.isArray(data) ? data : []
        CacheUtility.set(key, items, TTL_SHORT)
        return items
    }
    /**
     * Fetches every plant_manager report for a given year (drafts + completed) with
     * narrowed columns and a 2-minute cache. Multiple consumers within the review
     * flow (hours-received calc, weekly trends, yearly totals, YPH calc) share one
     * network call instead of each issuing its own SELECT * across thousands of rows.
     */
    async fetchPlantManagerReportsForYear(year) {
        if (!year || Number.isNaN(Number(year))) return []
        const cacheKey = `plantManagerReports:year:${year}`
        const cached = CacheUtility.get(cacheKey)
        if (cached) return cached
        const startOfYear = new Date(year, 0, 1).toISOString()
        const endOfYear = new Date(year, 11, 31, 23, 59, 59).toISOString()
        const { data, error } = await Database.from('reports')
            .select('id, user_id, week, completed, submitted_at, updated_at, data')
            .eq('report_name', 'plant_manager')
            .gte('week', startOfYear)
            .lte('week', endOfYear)
        const reports = !error && Array.isArray(data) ? data : []
        CacheUtility.set(cacheKey, reports, 2 * 60 * 1000)
        return reports
    }
    /**
     * Detects overdue report assignments by cross-referencing user permissions
     * against submitted reports across the last 52 weeks. Checks multiple report
     * date fields (week, date range, submitted_at) to handle format variations.
     */
    async fetchOverdueAssignments(today = new Date(), options = {}) {
        const force = !!options.force
        const allowedReview = Array.isArray(options.allowedReview) ? options.allowedReview.filter(Boolean) : null
        const cacheKey = `overdue:${today.toISOString().slice(0, 10)}:${(allowedReview || []).join(',')}`
        const cached = !force ? CacheUtility.get(cacheKey) : null
        if (cached) return cached
        const candidateWeeks = ReportUtility.getLastNWeekIsos(52, today)
        const weekIsos = candidateWeeks.filter((iso) => {
            const cutoff = ReportUtility.getLateCutoff(iso)
            return cutoff && cutoff < today
        })
        if (weekIsos.length === 0) {
            CacheUtility.set(cacheKey, [], TTL_SHORT)
            return []
        }
        const { data: profiles, error: profilesError } = await Database.from('users_profiles').select(
            'id, first_name, last_name, plant_code'
        )
        if (profilesError || !Array.isArray(profiles) || profiles.length === 0) {
            CacheUtility.set(cacheKey, [], TTL_SHORT)
            return []
        }
        const assignedMap = new Map()
        await Promise.all(
            profiles.map(async (p) => {
                const userId = p.id
                const userPerms = await UserService.getUserPermissions(userId)
                const permsSet = new Set(Array.isArray(userPerms) ? userPerms : [])
                const names = []
                reportTypes.forEach((rt) => {
                    if (allowedReview && allowedReview.length > 0 && !allowedReview.includes(rt.name)) return
                    const perms = Array.isArray(rt.assignment) ? rt.assignment : []
                    if (perms.length === 0) return
                    const has = perms.some((perm) => permsSet.has(perm))
                    if (has) names.push(rt.name)
                })
                if (names.length > 0) assignedMap.set(userId, { reportNames: names, user: p })
            })
        )
        const candidateUserIds = Array.from(assignedMap.keys())
        if (candidateUserIds.length === 0) {
            CacheUtility.set(cacheKey, [], TTL_SHORT)
            return []
        }
        const mondayFullIsoList = weekIsos.map((d) => new Date(d).toISOString())
        const mondayDateStrList = weekIsos
        const saturdayFullIsoList = weekIsos.map((iso) => ReportUtility.getWeekDatesFromIso(iso).saturday.toISOString())
        const saturdayDateStrList = weekIsos.map((iso) =>
            ReportUtility.getWeekDatesFromIso(iso).saturday.toISOString().slice(0, 10)
        )
        const weekFieldList = Array.from(new Set([...mondayFullIsoList, ...mondayDateStrList]))
        const startFieldList = weekFieldList
        const endFieldList = Array.from(new Set([...saturdayFullIsoList, ...saturdayDateStrList]))
        const dataWeekList = mondayDateStrList
        let weekEq = Database.from('reports')
            .select('user_id, report_name, completed, week')
            .in('user_id', candidateUserIds)
            .in('week', weekFieldList)
            .eq('completed', true)
        let rangeEq = Database.from('reports')
            .select('user_id, report_name, completed, report_date_range_start')
            .in('user_id', candidateUserIds)
            .in('report_date_range_start', startFieldList)
            .eq('completed', true)
        let endEq = Database.from('reports')
            .select('user_id, report_name, completed, report_date_range_end')
            .in('user_id', candidateUserIds)
            .in('report_date_range_end', endFieldList)
            .eq('completed', true)
        let dataWeekEq = Database.from('reports')
            .select('user_id, report_name, completed, data')
            .in('user_id', candidateUserIds)
            .in('data->>week', dataWeekList)
            .eq('completed', true)
        if (allowedReview && allowedReview.length > 0) {
            weekEq = weekEq.in('report_name', allowedReview)
            rangeEq = rangeEq.in('report_name', allowedReview)
            endEq = endEq.in('report_name', allowedReview)
            dataWeekEq = dataWeekEq.in('report_name', allowedReview)
        }
        const [reportsWeekEqRes, reportsRangeEqRes, reportsEndEqRes, reportsDataWeekEqRes] = await Promise.all([
            weekEq,
            rangeEq,
            endEq,
            dataWeekEq
        ])
        const reportsWeekEq = reportsWeekEqRes.data
        const reportsWeekEqError = reportsWeekEqRes.error
        const reportsRangeEq = reportsRangeEqRes.data
        const reportsRangeEqError = reportsRangeEqRes.error
        const reportsEndEq = reportsEndEqRes.data
        const reportsEndEqError = reportsEndEqRes.error
        const reportsDataWeekEq = reportsDataWeekEqRes.data
        const reportsDataWeekEqError = reportsDataWeekEqRes.error
        const weekRanges = weekIsos.map((iso) => {
            const { monday, saturday } = ReportUtility.getWeekDatesFromIso(iso)
            const startIso = monday ? monday.toISOString() : null
            const endIso = saturday ? new Date(saturday.getTime() + 86399999).toISOString() : null
            return { endIso, iso, startIso }
        })
        const submittedQueries = await Promise.all(
            weekRanges.map(async (wr) => {
                if (!wr.startIso || !wr.endIso) return { data: [], error: null }
                let q = Database.from('reports')
                    .select('user_id, report_name, completed, submitted_at')
                    .in('user_id', candidateUserIds)
                    .gte('submitted_at', wr.startIso)
                    .lte('submitted_at', wr.endIso)
                    .eq('completed', true)
                if (allowedReview && allowedReview.length > 0) q = q.in('report_name', allowedReview)
                return q
            })
        )
        const submittedResults = await Promise.all(submittedQueries)
        if (
            reportsWeekEqError &&
            reportsRangeEqError &&
            reportsEndEqError &&
            reportsDataWeekEqError &&
            submittedResults.every((r) => r.error)
        ) {
            CacheUtility.set(cacheKey, [], TTL_SHORT)
            return []
        }
        const allReports = []
            .concat(Array.isArray(reportsWeekEq) ? reportsWeekEq : [])
            .concat(Array.isArray(reportsRangeEq) ? reportsRangeEq : [])
            .concat(Array.isArray(reportsEndEq) ? reportsEndEq : [])
            .concat(Array.isArray(reportsDataWeekEq) ? reportsDataWeekEq : [])
        const existing = new Map()
        const allReportsArr = allReports || []
        allReportsArr.forEach((r) => {
            let rawDay = ''
            if (r.week) rawDay = new Date(r.week).toISOString().slice(0, 10)
            else if (r.report_date_range_start) rawDay = new Date(r.report_date_range_start).toISOString().slice(0, 10)
            else if (r.report_date_range_end) rawDay = new Date(r.report_date_range_end).toISOString().slice(0, 10)
            else if (r.data && r.data.week) rawDay = new Date(r.data.week).toISOString().slice(0, 10)
            if (!rawDay) return
            const mondayKey = ReportUtility.getMondayISO(rawDay)
            if (!mondayKey) return
            const k = `${r.user_id}::${r.report_name}::${mondayKey}`
            const prev = existing.get(k) || false
            const isCompleted = !!r.completed
            existing.set(k, prev || isCompleted)
        })
        submittedResults.forEach((res) => {
            const rows = Array.isArray(res.data) ? res.data : []
            rows.forEach((r) => {
                const submittedDay = r.submitted_at ? new Date(r.submitted_at).toISOString().slice(0, 10) : ''
                if (!submittedDay) return
                const mondayKey = ReportUtility.getMondayISO(submittedDay)
                if (!mondayKey) return
                const k = `${r.user_id}::${r.report_name}::${mondayKey}`
                const prev = existing.get(k) || false
                const isCompleted = !!r.completed
                existing.set(k, prev || isCompleted)
            })
        })
        const overdue = []
        for (const [userId, info] of assignedMap.entries()) {
            for (const rtName of info.reportNames) {
                for (const day of weekIsos) {
                    const key = `${userId}::${rtName}::${day}`
                    const done = existing.get(key)
                    if (!done) {
                        overdue.push({
                            first_name: info.user.first_name || '',
                            last_name: info.user.last_name || '',
                            plant_code: info.user.plant_code || '',
                            report_name: rtName,
                            userId,
                            week: day
                        })
                    }
                }
            }
        }
        CacheUtility.set(cacheKey, overdue, TTL_SHORT)
        return overdue
    }
    /** Fetches completed plant manager reports for a given week, excluding a specific plant. */
    async fetchPlantManagerReportsForWeek(weekIso, excludePlantCode) {
        if (!weekIso) return { data: [], error: null }
        try {
            const weekStart = weekIso.split('T')[0]
            const [year, month, day] = weekStart.split('-').map(Number)
            const startDate = new Date(year, month - 1, day)
            const weekStartStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
            const weekEndDate = new Date(year, month - 1, day + 6)
            const weekEndStr = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth() + 1).padStart(2, '0')}-${String(weekEndDate.getDate()).padStart(2, '0')}`
            const { data, error } = await Database.from('reports')
                .select('*')
                .eq('report_name', 'plant_manager')
                .eq('completed', true)
                .gte('week', weekStartStr)
                .lte('week', weekEndStr + 'T23:59:59.999Z')
            if (error) return { data: [], error }
            const excludePlantCodeStr = String(excludePlantCode || '')
            const filteredData = (data || []).filter((report) => {
                const reportPlant = String(report.data?.plant || '')
                return reportPlant && reportPlant !== excludePlantCodeStr
            })
            return { data: filteredData, error: null }
        } catch (err) {
            console.error('Error fetching plant manager reports for week:', err)
            return { data: [], error: err }
        }
    }
    async saveReport({ existingId, upsertData }) {
        const { json } = await postReport('save-report', { existingId, upsertData })
        return { data: json, error: null }
    }
    async saveExclusionReason(reportId, reason) {
        if (!reportId || !reason) return
        await postReport('save-exclusion-reason', { reason, reportId })
    }
    async deleteReport(reportId) {
        if (!reportId) throw new Error('Report ID is required')
        const { res, json } = await postReport('delete-report', { reportId })
        if (!res?.ok || json !== true) throw new Error(json?.error || 'Failed to delete report')
    }
    async markReviewed(reportId, userId) {
        if (!reportId || !userId) return false
        const { json } = await postReport('mark-reviewed', { reportId, userId })
        return !!json
    }
}
export const ReportService = new ReportServiceImpl()
