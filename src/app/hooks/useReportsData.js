import { useCallback, useEffect, useMemo, useState } from 'react'

import { Database } from '../../services/DatabaseService'
import { PlantService } from '../../services/PlantService'
import { UserService } from '../../services/UserService'
import { mapReportRow } from '../../utils/ReportsDataUtility'
import { ReportUtility } from '../../utils/ReportUtility'
import { usePreferences } from '../context/PreferencesContext'
import { oneOffReportTypes, reportTypes } from '../types/ReportTypes'
import { useReportsLostLoads } from './useReportsLostLoads'
import { useReportsUserProfiles } from './useReportsUserProfiles'

const REPORTS_START_DATE = new Date('2025-07-20')

/**
 * Loads all reports data: user's own reports, review permissions, assigned report types,
 * region-scoped plant lists, and reporter-to-plant mappings.
 */
export function useReportsData() {
    const [localReports, setLocalReports] = useState([])
    const [user, setUser] = useState(null)
    const [hasAssigned, setHasAssigned] = useState({})
    const [hasReviewPermission, setHasReviewPermission] = useState({})
    const [plants, setPlants] = useState([])
    const [regionType, setRegionType] = useState(null)
    const [regionPlantCodes, setRegionPlantCodes] = useState(null)
    const [regionPlantsWithDistricts, setRegionPlantsWithDistricts] = useState([])
    const [userPlantCode, setUserPlantCode] = useState('')
    const [userAdditionalPlants, setUserAdditionalPlants] = useState([])
    const [reporterPlantMap, setReporterPlantMap] = useState({})
    const [reviewedByCurrentUser, setReviewedByCurrentUser] = useState(new Set())
    const [reviewLoadedWeeks, setReviewLoadedWeeks] = useState(new Set())
    const [loadError, setLoadError] = useState('')
    const [isLoadingUser, setIsLoadingUser] = useState(true)
    const [isLoadingMy, setIsLoadingMy] = useState(true)
    const [isLoadingReview, setIsLoadingReview] = useState(true)
    const [isLoadingPermissions, setIsLoadingPermissions] = useState(true)
    const [loadingReporterPlants, setLoadingReporterPlants] = useState(false)
    const [refreshKey, setRefreshKey] = useState(0)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [hasLostLoadsPermission, setHasLostLoadsPermission] = useState(false)
    const [hasLostLoadsDeletePermission, setHasLostLoadsDeletePermission] = useState(false)
    const [hasQCStrengthPermission, setHasQCStrengthPermission] = useState(false)
    const [hasOneOffReviewPermission, setHasOneOffReviewPermission] = useState({})
    const { preferences } = usePreferences()

    const { fetchProfilesFor, getUserName, userProfiles } = useReportsUserProfiles()
    const { addLostLoadReport, deleteLostLoadReport, isLoadingLostLoads, loadLostLoadReports, lostLoadReports } =
        useReportsLostLoads({ fetchProfilesFor, isLoadingPermissions, user })

    const fetchReportsBatch = useCallback(
        async ({ weeks, scope }) => {
            if (!user || !Array.isArray(weeks) || weeks.length === 0) return
            // Break the week list into reasonable chunks so we never exceed the
            // PostgREST URL-length cap, and loop each chunk sequentially.
            const WEEK_CHUNK = 26
            if (weeks.length > WEEK_CHUNK) {
                for (let i = 0; i < weeks.length; i += WEEK_CHUNK) {
                    await loadChunk(weeks.slice(i, i + WEEK_CHUNK))
                }
                return
            }
            await loadChunk(weeks)
            async function loadChunk(chunkWeeks) {
                const dateStrs = chunkWeeks.map((w) => new Date(w).toISOString().slice(0, 10))
                const fullIsos = chunkWeeks.map((w) => new Date(w).toISOString())
                const weekFieldList = Array.from(new Set([...dateStrs, ...fullIsos]))
                const buildBaseQuery = () => {
                    let q = Database.from('reports')
                        .select(
                            'id,report_name,user_id,submitted_at,data,completed,report_date_range_start,report_date_range_end,week'
                        )
                        .in('week', weekFieldList)
                    if (scope === 'my') {
                        const allowedMy =
                            regionType === 'office'
                                ? hasAssigned['general_manager']
                                    ? ['general_manager']
                                    : []
                                : reportTypes.filter((rt) => hasAssigned[rt.name]).map((rt) => rt.name)
                        q = q.eq('user_id', user.id)
                        if (allowedMy.length > 0) q = q.in('report_name', allowedMy)
                    } else if (scope === 'review') {
                        const recurringAllowed =
                            regionType === 'office'
                                ? hasReviewPermission['general_manager']
                                    ? ['general_manager']
                                    : []
                                : reportTypes
                                      .filter((rt) => hasReviewPermission[rt.name] && rt.name !== 'general_manager')
                                      .map((rt) => rt.name)
                        const oneOffAllowed = oneOffReportTypes
                            .filter((rt) => hasOneOffReviewPermission[rt.name])
                            .map((rt) => rt.name)
                        const allowedReview = [...recurringAllowed, ...oneOffAllowed]
                        q = q.neq('user_id', user.id).eq('completed', true)
                        if (allowedReview.length > 0) q = q.in('report_name', allowedReview)
                    }
                    return q
                        .order('week', { ascending: false })
                        .order('submitted_at', { ascending: false, nullsFirst: false })
                        .order('id', { ascending: false })
                }
                const PAGE_SIZE = 1000
                const data = []
                let from = 0
                let fetchError = null
                let done = false
                // Paginate explicitly — Supabase caps a single response so we loop until
                // we receive a short page, guaranteeing we load every matching report.
                while (!done) {
                    const { data: pageData, error: pageError } = await buildBaseQuery().range(
                        from,
                        from + PAGE_SIZE - 1
                    )
                    if (pageError) {
                        fetchError = pageError
                        break
                    }
                    const page = Array.isArray(pageData) ? pageData : []
                    data.push(...page)
                    if (page.length < PAGE_SIZE) done = true
                    else from += PAGE_SIZE
                }
                if (fetchError) {
                    setLoadError(fetchError.message || 'Error fetching reports')
                    return
                }
                const reportIds = data.map((r) => r.id).filter((id) => id != null)
                if (reportIds.length > 0 && scope === 'review' && user?.id) {
                    // Chunk the `.in()` list so we never hit PostgREST's URL-length
                    // limit when the review result is large.
                    const CHUNK = 500
                    const reviewedAll = []
                    for (let i = 0; i < reportIds.length; i += CHUNK) {
                        const slice = reportIds.slice(i, i + CHUNK)
                        const { data: reviewedData } = await Database.from('reports_reviewed')
                            .select('report_id')
                            .in('report_id', slice)
                            .eq('reviewed_by_user_id', user.id)
                        if (Array.isArray(reviewedData)) reviewedAll.push(...reviewedData)
                    }
                    if (reviewedAll.length > 0) {
                        const reviewedSet = new Set(reviewedAll.map((r) => r.report_id))
                        setReviewedByCurrentUser((prev) => {
                            const newSet = new Set(prev)
                            reviewedSet.forEach((id) => newSet.add(id))
                            return newSet
                        })
                    }
                }
                setLocalReports((prev) => {
                    const existingIds = new Set(prev.map((r) => r.id))
                    const mapped = data.filter((r) => !existingIds.has(r.id)).map(mapReportRow)
                    return [...prev, ...mapped]
                })
                const ids = Array.from(new Set(data.map((r) => r.user_id).filter(Boolean)))
                await fetchProfilesFor(ids)
            }
        },
        [user, regionType, hasAssigned, hasReviewPermission, hasOneOffReviewPermission, fetchProfilesFor]
    )
    useEffect(() => {
        async function init() {
            setIsLoadingUser(true)
            try {
                const u = await UserService.getCurrentUser()
                setUser(u && typeof u.id === 'string' ? u : null)
            } catch (err) {
                setLoadError(err?.message || 'Error fetching user')
                setUser(null)
            } finally {
                setIsLoadingUser(false)
            }
        }
        init()
    }, [])
    useEffect(() => {
        if (!user?.id) return
        async function loadUserPlants() {
            const [mainPlant, additional] = await Promise.all([
                UserService.getUserPlant(user.id).catch(() => ''),
                UserService.getAdditionalAssignedPlants(user.id).catch(() => [])
            ])
            setUserPlantCode(mainPlant || '')
            setUserAdditionalPlants(Array.isArray(additional) ? additional : [])
        }
        loadUserPlants()
    }, [user?.id])
    useEffect(() => {
        async function checkAssignedAndReview() {
            if (!user?.id) {
                setHasAssigned({})
                setHasReviewPermission({})
                setIsLoadingPermissions(false)
                return
            }
            setIsLoadingPermissions(true)
            const assigned = {}
            const review = {}
            await Promise.all(
                reportTypes.map(async (rt) => {
                    assigned[rt.name] = await UserService.hasAnyPermission(user.id, rt.assignment)
                    review[rt.name] = (
                        await Promise.all(rt.review.map((perm) => UserService.hasPermission(user.id, perm)))
                    ).some(Boolean)
                })
            )
            const oneOffReview = {}
            await Promise.all(
                oneOffReportTypes
                    .filter((rt) => rt.reviewPermission)
                    .map(async (rt) => {
                        oneOffReview[rt.name] = await UserService.hasPermission(user.id, rt.reviewPermission)
                    })
            )
            const [lostLoads, lostLoadsDelete, qcStrength] = await Promise.all([
                UserService.hasPermission(user.id, 'reports.lostloads'),
                UserService.hasPermission(user.id, 'reports.lostloads.delete'),
                UserService.hasPermission(user.id, 'reports.qc_strength')
            ])
            setHasAssigned(assigned)
            setHasReviewPermission(review)
            setHasOneOffReviewPermission(oneOffReview)
            setHasLostLoadsPermission(lostLoads)
            setHasLostLoadsDeletePermission(lostLoadsDelete)
            setHasQCStrengthPermission(qcStrength)
            setIsLoadingPermissions(false)
        }
        checkAssignedAndReview()
    }, [user?.id])
    useEffect(() => {
        async function fetchPlants() {
            const { data, error } = await Database.from('plants')
                .select('plant_code,plant_name')
                .order('plant_code', { ascending: true })
            setPlants(!error && Array.isArray(data) ? data.filter((p) => p.plant_code && p.plant_name) : [])
        }
        fetchPlants()
    }, [])
    useEffect(() => {
        if (!user || isLoadingPermissions) return
        const now = new Date()
        const initialMyWeeks = ReportUtility.getLastNWeekIsos(
            ReportUtility.getTotalWeeksSince(REPORTS_START_DATE, now),
            now
        )
        async function loadInitial() {
            setIsLoadingMy(true)
            await fetchReportsBatch({ scope: 'my', weeks: initialMyWeeks })
            setIsLoadingMy(false)
        }
        loadInitial()
    }, [user, isLoadingPermissions, hasAssigned, regionType, refreshKey, fetchReportsBatch])
    useEffect(() => {
        const code = preferences.selectedRegion?.code || ''
        let cancelled = false
        async function loadRegion() {
            if (!code) {
                setRegionPlantCodes(null)
                setRegionType(null)
                return
            }
            try {
                const region = await PlantService.fetchRegionByCode(code)
                setRegionType(region?.type || null)
                const list = await PlantService.fetchRegionPlants(code)
                if (cancelled) return
                setRegionPlantCodes(new Set(list.map((p) => p.plantCode)))
                setRegionPlantsWithDistricts(list)
            } catch {
                setRegionPlantCodes(new Set())
                setRegionType(null)
            }
        }
        loadRegion()
        return () => {
            cancelled = true
        }
    }, [preferences.selectedRegion?.code])
    useEffect(() => {
        const ids = Array.from(
            new Set([
                ...localReports.filter((r) => r.completed && r.userId && r.userId !== user?.id).map((r) => r.userId)
            ])
        ).filter((id) => !(id in reporterPlantMap))
        if (ids.length === 0) return
        let cancelled = false
        async function loadReporterPlants() {
            setLoadingReporterPlants(true)
            try {
                const entries = await Promise.all(
                    ids.map(async (id) => [
                        id,
                        await Promise.race([
                            UserService.getUserPlant(id),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
                        ]).catch(() => '')
                    ])
                )
                if (!cancelled) {
                    setReporterPlantMap((prev) => ({
                        ...prev,
                        ...Object.fromEntries(entries)
                    }))
                }
            } finally {
                if (!cancelled) setLoadingReporterPlants(false)
            }
        }
        loadReporterPlants()
        return () => {
            cancelled = true
        }
    }, [localReports, user?.id, reporterPlantMap])
    useEffect(() => {
        const interval = setInterval(() => setRefreshKey((prev) => prev + 1), 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])
    /** Derive the Review-pill visibility from the *latest known* permission
     *  data, NOT from the loading flag. The permissions effect keeps the
     *  previous `hasReviewPermission` map intact while it re-fetches, so
     *  evaluating against it during a refresh keeps the pill visible
     *  instead of letting it pop in and out as `isLoadingPermissions`
     *  toggles. */
    const hasAnyReviewPermission = useMemo(() => {
        const allowedReviewTypes =
            regionType === 'office'
                ? hasReviewPermission['general_manager']
                    ? ['general_manager']
                    : []
                : reportTypes
                      .filter((rt) => hasReviewPermission[rt.name] && rt.name !== 'general_manager')
                      .map((rt) => rt.name)
        return allowedReviewTypes.length > 0
    }, [hasReviewPermission, regionType])
    const weeksToShow = useMemo(() => {
        const now = new Date()
        return ReportUtility.getLastNWeekIsos(ReportUtility.getTotalWeeksSince(REPORTS_START_DATE, now), now)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshKey triggers intentional recomputation
    }, [refreshKey])
    const myReportsByWeek = useMemo(() => {
        const grouped = {}
        weeksToShow.forEach((weekIso) => {
            reportTypes.forEach((rt) => {
                if (!user || !hasAssigned[rt.name] || (regionType === 'office' && rt.name !== 'general_manager')) return
                const existing = localReports.find(
                    (r) =>
                        r.name === rt.name &&
                        r.userId === user.id &&
                        r.week &&
                        new Date(r.week).toISOString().slice(0, 10) === weekIso
                )
                grouped[weekIso] = grouped[weekIso] || []
                grouped[weekIso].push({
                    ...rt,
                    completed: !!(existing && existing.completed),
                    report: existing || null,
                    weekIso
                })
            })
        })
        return grouped
    }, [weeksToShow, user, hasAssigned, localReports, regionType])
    const reviewableReports = useMemo(
        () =>
            localReports
                .filter(
                    (r) =>
                        r.completed &&
                        r.week &&
                        r.userId &&
                        r.userId !== user?.id &&
                        (hasReviewPermission[r.name] || hasOneOffReviewPermission[r.name]) &&
                        (regionType !== 'office' || r.name === 'general_manager')
                )
                .sort((a, b) => new Date(b.week).getTime() - new Date(a.week).getTime()),
        [localReports, hasReviewPermission, hasOneOffReviewPermission, user?.id, regionType]
    )
    const loadReviewReports = useCallback(
        async (priorityWeeks = null) => {
            if (!user || isLoadingPermissions) return
            const weeksSpan = Math.max(52, ReportUtility.getTotalWeeksSince(REPORTS_START_DATE))
            const allWeeks = ReportUtility.getLastNWeekIsos(weeksSpan, new Date())
            let toLoad
            if (Array.isArray(priorityWeeks) && priorityWeeks.length > 0) {
                toLoad = priorityWeeks.filter((w) => w && !reviewLoadedWeeks.has(w))
            } else {
                const newWeeks = allWeeks.filter((w) => !reviewLoadedWeeks.has(w))
                // Once all weeks are loaded, re-fetch the most recent 4 so freshly
                // submitted reports surface without a full page refresh.
                const recentWeeks = newWeeks.length === 0 ? allWeeks.slice(0, 4) : []
                toLoad = [...newWeeks, ...recentWeeks]
            }
            if (toLoad.length === 0) {
                if (isLoadingReview) setIsLoadingReview(false)
                return
            }
            setIsLoadingReview(true)
            await fetchReportsBatch({ scope: 'review', weeks: toLoad })
            setReviewLoadedWeeks((prev) => new Set([...toLoad, ...prev]))
            setIsLoadingReview(false)
        },
        [user, isLoadingPermissions, reviewLoadedWeeks, isLoadingReview, fetchReportsBatch]
    )
    // Background prefetch of any review weeks not yet loaded. Does not toggle
    // the loading flag — the UI keeps the active week visible while history
    // streams in behind it.
    const prefetchRemainingReviewWeeks = useCallback(async () => {
        if (!user || isLoadingPermissions) return
        const weeksSpan = Math.max(52, ReportUtility.getTotalWeeksSince(REPORTS_START_DATE))
        const allWeeks = ReportUtility.getLastNWeekIsos(weeksSpan, new Date())
        const toLoad = allWeeks.filter((w) => !reviewLoadedWeeks.has(w))
        if (toLoad.length === 0) return
        await fetchReportsBatch({ scope: 'review', weeks: toLoad })
        setReviewLoadedWeeks((prev) => new Set([...toLoad, ...prev]))
    }, [user, isLoadingPermissions, reviewLoadedWeeks, fetchReportsBatch])
    const triggerRefresh = useCallback(() => {
        setIsRefreshing(true)
        setRefreshKey((prev) => prev + 1)
        setTimeout(() => setIsRefreshing(false), 1000)
    }, [])
    const updateLocalReport = useCallback((reportData) => {
        setLocalReports((prev) => [...prev.filter((r) => r.id !== reportData.id), reportData])
    }, [])
    const markReportReviewed = useCallback((reportId) => {
        setReviewedByCurrentUser((prev) => {
            const newSet = new Set(prev)
            newSet.add(reportId)
            return newSet
        })
    }, [])
    /** True once at least one review week has been fetched. Lets the view
     *  keep the existing list rendered during subsequent reloads (week
     *  switches, manual refresh) instead of swapping in the full-page
     *  skeleton, which reads as the tab "going away and coming back". */
    const hasLoadedReviewOnce = reviewLoadedWeeks.size > 0
    return {
        addLostLoadReport,
        deleteLostLoadReport,
        fetchProfilesFor,
        getUserName,
        hasAnyReviewPermission,
        hasAssigned,
        hasLoadedReviewOnce,
        hasLostLoadsDeletePermission,
        hasLostLoadsPermission,
        hasOneOffReviewPermission,
        hasQCStrengthPermission,
        hasReviewPermission,
        isLoadingLostLoads,
        isLoadingMy,
        isLoadingPermissions,
        isLoadingReview,
        isLoadingUser,
        isRefreshing,
        loadError,
        loadLostLoadReports,
        loadReviewReports,
        loadingReporterPlants,
        localReports,
        lostLoadReports,
        markReportReviewed,
        myReportsByWeek,
        plants,
        preferences,
        prefetchRemainingReviewWeeks,
        regionPlantCodes,
        regionPlantsWithDistricts,
        regionType,
        reporterPlantMap,
        reviewableReports,
        reviewedByCurrentUser,
        setLoadError,
        triggerRefresh,
        updateLocalReport,
        user,
        userAdditionalPlants,
        userPlantCode,
        userProfiles,
        weeksToShow
    }
}
