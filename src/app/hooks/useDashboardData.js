import { useCallback, useEffect, useRef, useState } from 'react'

import { Database } from '../../services/DatabaseService'
import { EquipmentService } from '../../services/EquipmentService'
import { MixerService } from '../../services/MixerService'
import { OperatorService } from '../../services/OperatorService'
import { PickupTruckService } from '../../services/PickupTruckService'
import { TractorService } from '../../services/TractorService'
import { TrailerService } from '../../services/TrailerService'
import DashboardUtility from '../../utils/DashboardUtility'
import GrammarUtility from '../../utils/GrammarUtility'
import { DASHBOARD_CACHE_KEY, DASHBOARD_CACHE_TTL_MS } from '../constants/dashboardConstants'

/**
 * Loads every fleet asset the dashboard summarizes — mixers, tractors,
 * trailers, equipment, pickups, and operators — into the caller's refs.
 *
 * Each list is slimmed to the handful of fields the dashboard actually reads
 * before it is stored, which is what makes the whole fleet small enough to
 * hold in sessionStorage. A cache entry newer than the TTL is applied and
 * rendered right away while the network fetch runs behind it, so a returning
 * user sees the dashboard without waiting on six requests.
 *
 * Individual services fail independently: a service that errors contributes an
 * empty list rather than blanking the dashboard.
 */
export function useDashboardAssets({
    allEquipmentRef,
    allMixersRef,
    allOperatorsRef,
    allPickupsRef,
    allTractorsRef,
    allTrailersRef,
    computeStats,
    refreshKey
}) {
    const [loading, setLoading] = useState(true)
    const [dataReady, setDataReady] = useState(false)
    const [error, setError] = useState('')
    const [trainingOperators, setTrainingOperators] = useState([])
    const [pendingStartOperators, setPendingStartOperators] = useState([])
    const allOperatorsFullRef = useRef([])
    const initialLoadRef = useRef(true)
    useEffect(() => {
        let cancelled = false
        let readyTimerId
        async function fetchAssets() {
            setError('')
            const now = Date.now()
            if (initialLoadRef.current) {
                try {
                    const raw = sessionStorage.getItem(DASHBOARD_CACHE_KEY)
                    if (raw) {
                        const parsed = JSON.parse(raw)
                        if (parsed && now - (parsed.savedAt || 0) < DASHBOARD_CACHE_TTL_MS) {
                            allMixersRef.current = (parsed.mixers || []).map(DashboardUtility.slimMixer)
                            allTractorsRef.current = (parsed.tractors || []).map(DashboardUtility.slimTractor)
                            allTrailersRef.current = (parsed.trailers || []).map(DashboardUtility.slimTrailer)
                            allEquipmentRef.current = (parsed.equipment || []).map(DashboardUtility.slimEquipment)
                            allPickupsRef.current = (parsed.pickups || []).map(DashboardUtility.slimPickup)
                            allOperatorsRef.current = (parsed.operators || []).map(DashboardUtility.slimOperator)
                            computeStats()
                            setDataReady(true)
                            setLoading(false)
                        }
                    }
                } catch (e) {
                    console.error('Failed to read dashboard cache from sessionStorage:', e)
                }
            }
            try {
                const [mix, trac, trail, equip, pick, ops] = await Promise.all([
                    MixerService.getAllMixers().catch(() => []),
                    TractorService.getAllTractors().catch(() => []),
                    TrailerService.fetchTrailers().catch(() => []),
                    EquipmentService.getAllEquipments().catch(() => []),
                    PickupTruckService.getAll().catch(() => []),
                    OperatorService.getAllOperators().catch(() => [])
                ])
                if (cancelled) return
                allMixersRef.current = mix.map(DashboardUtility.slimMixer)
                allTractorsRef.current = trac.map(DashboardUtility.slimTractor)
                allTrailersRef.current = trail.map(DashboardUtility.slimTrailer)
                allEquipmentRef.current = equip.map(DashboardUtility.slimEquipment)
                allPickupsRef.current = pick.map(DashboardUtility.slimPickup)
                allOperatorsFullRef.current = ops
                allOperatorsRef.current = ops.map(DashboardUtility.slimOperator)
                const operatorsById = new Map(ops.map((o) => [o.employeeId, o]))
                const training = ops
                    .filter((o) => o.status === 'Training')
                    .map((o) => {
                        const trainer = o.assignedTrainer ? operatorsById.get(o.assignedTrainer) : null
                        return {
                            id: o.employeeId,
                            operatorName: o.name || '',
                            operatorPlant: o.plantCode || '',
                            operatorPosition: o.position || '',
                            trainerName: trainer?.name || '',
                            trainerPlant: trainer?.plantCode || ''
                        }
                    })
                setTrainingOperators(training)
                const pending = ops
                    .filter((o) => o.status === 'Pending Start')
                    .map((o) => {
                        const trainer = o.assignedTrainer ? operatorsById.get(o.assignedTrainer) : null
                        return {
                            id: o.employeeId,
                            operatorName: o.name || '',
                            operatorPlant: o.plantCode || '',
                            pendingDate: o.pendingStartDate || '',
                            trainerPlant: trainer?.plantCode || ''
                        }
                    })
                setPendingStartOperators(pending)
                computeStats()
                try {
                    sessionStorage.setItem(
                        DASHBOARD_CACHE_KEY,
                        JSON.stringify({
                            equipment: allEquipmentRef.current,
                            mixers: allMixersRef.current,
                            operators: allOperatorsRef.current,
                            pickups: allPickupsRef.current,
                            savedAt: Date.now(),
                            tractors: allTractorsRef.current,
                            trailers: allTrailersRef.current
                        })
                    )
                } catch (e) {
                    console.error('Failed to write dashboard cache to sessionStorage:', e)
                }
            } catch (err) {
                console.error('Dashboard data fetch error:', err)
                if (!cancelled) setError('Failed to load dashboard data')
            } finally {
                if (!cancelled) {
                    // `dataReady` gates the skeleton and the follow-on fetches
                    // that read these refs, so it trails `loading` by a beat
                    // rather than flipping in the same commit the refs are
                    // filled in.
                    setLoading(false)
                    readyTimerId = setTimeout(() => setDataReady(true), 300)
                }
            }
        }
        fetchAssets()
        return () => {
            cancelled = true
            clearTimeout(readyTimerId)
        }
    }, [
        refreshKey,
        computeStats,
        allEquipmentRef,
        allMixersRef,
        allOperatorsRef,
        allPickupsRef,
        allTractorsRef,
        allTrailersRef
    ])
    return {
        allOperatorsFullRef,
        dataReady,
        error,
        loading,
        pendingStartOperators,
        trainingOperators
    }
}
/**
 * Collects open-issue and comment counts for every loaded asset, plus a flat
 * list of issue details the dashboard renders directly.
 *
 * Counts land in `countsRef` rather than state because they are read during
 * stat computation, which the caller drives; only the issue list, which is
 * rendered, is state. A maintenance record counts as an open issue until it
 * carries a completion time, but resolved records still appear in the detail
 * list so the dashboard can show recent activity alongside outstanding work.
 */
export function useIssueCommentCounts({
    allEquipmentRef,
    allMixersRef,
    allTractorsRef,
    allTrailersRef,
    computeStats,
    countsRef: externalCountsRef
}) {
    const internalCountsRef = useRef({ equipment: {}, mixers: {}, tractors: {}, trailers: {} })
    const countsRef = externalCountsRef || internalCountsRef
    const [assetIssueDetails, setAssetIssueDetails] = useState([])
    const fetchIssueCommentCounts = useCallback(async () => {
        try {
            const mixerIds = allMixersRef.current.map((m) => m.id).filter(Boolean)
            const tractorIds = allTractorsRef.current.map((t) => t.id).filter(Boolean)
            const trailerIds = allTrailersRef.current.map((t) => t.id).filter(Boolean)
            const equipmentIds = allEquipmentRef.current.map((e) => e.id).filter(Boolean)
            if (!mixerIds.length && !tractorIds.length && !trailerIds.length && !equipmentIds.length) return
            const [mMaint, mCom, tMaint, tCom, trMaint, trCom, eMaint, eCom] = await Promise.all([
                mixerIds.length
                    ? Database.from('mixers_maintenance').select('*').in('mixer_id', mixerIds)
                    : Promise.resolve({ data: [] }),
                mixerIds.length
                    ? Database.from('mixers_comments').select('id,mixer_id').in('mixer_id', mixerIds)
                    : Promise.resolve({ data: [] }),
                tractorIds.length
                    ? Database.from('tractors_maintenance').select('*').in('tractor_id', tractorIds)
                    : Promise.resolve({ data: [] }),
                tractorIds.length
                    ? Database.from('tractors_comments').select('id,tractor_id').in('tractor_id', tractorIds)
                    : Promise.resolve({ data: [] }),
                trailerIds.length
                    ? Database.from('trailers_maintenance').select('*').in('trailer_id', trailerIds)
                    : Promise.resolve({ data: [] }),
                trailerIds.length
                    ? Database.from('trailers_comments').select('id,trailer_id').in('trailer_id', trailerIds)
                    : Promise.resolve({ data: [] }),
                equipmentIds.length
                    ? Database.from('heavy_equipment_maintenance').select('*').in('equipment_id', equipmentIds)
                    : Promise.resolve({ data: [] }),
                equipmentIds.length
                    ? Database.from('heavy_equipment_comments')
                          .select('id,equipment_id')
                          .in('equipment_id', equipmentIds)
                    : Promise.resolve({ data: [] })
            ])
            const counts = { equipment: {}, mixers: {}, tractors: {}, trailers: {} }
            const issueDetails = []
            const mixersMap = new Map(allMixersRef.current.map((a) => [a.id, a]))
            const tractorsMap = new Map(allTractorsRef.current.map((a) => [a.id, a]))
            const trailersMap = new Map(allTrailersRef.current.map((a) => [a.id, a]))
            const equipmentMap = new Map(allEquipmentRef.current.map((a) => [a.id, a]))
            const processMaintenanceRecords = (records, assetMap, assetType, idField, identifierField) => {
                const recordsList = records || []
                recordsList.forEach((record) => {
                    const isResolved = !!record.time_completed
                    const assetId = record[idField]
                    if (!isResolved) {
                        counts[assetType][assetId] = counts[assetType][assetId] || { comments: 0, issues: 0 }
                        counts[assetType][assetId].issues++
                    }
                    const asset = assetMap.get(assetId)
                    const identifier = asset?.[identifierField] || ''
                    const raw = record.description || record.issue || record.details || record.notes || ''
                    const desc = GrammarUtility.cleanDescription(raw || 'Issue')
                    issueDetails.push({
                        assetId,
                        description: desc || 'Issue',
                        identifier,
                        plant: asset?.plantCode || '',
                        resolved: isResolved,
                        type: assetType.charAt(0).toUpperCase() + assetType.slice(1, -1)
                    })
                })
            }
            const processCommentRecords = (records, assetType, idField) => {
                const recordsList = records || []
                recordsList.forEach((record) => {
                    const assetId = record[idField]
                    counts[assetType][assetId] = counts[assetType][assetId] || { comments: 0, issues: 0 }
                    counts[assetType][assetId].comments++
                })
            }
            processMaintenanceRecords(mMaint.data, mixersMap, 'mixers', 'mixer_id', 'truckNumber')
            processCommentRecords(mCom.data, 'mixers', 'mixer_id')
            processMaintenanceRecords(tMaint.data, tractorsMap, 'tractors', 'tractor_id', 'truckNumber')
            processCommentRecords(tCom.data, 'tractors', 'tractor_id')
            processMaintenanceRecords(trMaint.data, trailersMap, 'trailers', 'trailer_id', 'identifyingNumber')
            processCommentRecords(trCom.data, 'trailers', 'trailer_id')
            processMaintenanceRecords(eMaint.data, equipmentMap, 'equipment', 'equipment_id', 'identifyingNumber')
            processCommentRecords(eCom.data, 'equipment', 'equipment_id')
            countsRef.current = counts
            setAssetIssueDetails(issueDetails)
            computeStats()
        } catch (e) {
            console.error('Failed to fetch issue/comment counts:', e)
        }
    }, [allMixersRef, allTractorsRef, allTrailersRef, allEquipmentRef, computeStats, countsRef])
    return { assetIssueDetails, countsRef, fetchIssueCommentCounts }
}
/**
 * Resolves the dashboard's plant selector into the set of plant codes in scope,
 * and a predicate that tests a plant code against it.
 *
 * `dashboardPlant` is a single string carrying five different kinds of
 * selection: empty (the whole current region), `MY_PLANTS`, `REGION:<code>`,
 * `DISTRICT:<name>`, or a bare plant code. An empty result set means "no
 * filter", so the predicate admits everything.
 *
 * Home Office is the region that owns no plants of its own, which makes it the
 * exception in most of the branches below: its scope is every plant in the org
 * rather than a region's roster.
 */
export function usePlantFilter(
    dashboardRegionCode,
    dashboardPlant,
    regionPlants,
    allPlants,
    myPlantCodes,
    regionGroups
) {
    const plantSetRef = useRef(new Set())
    const updatePlantSet = useCallback(
        (regionType) => {
            const isOffice = regionType === 'Office'
            const plantSet = new Set()
            // `regionPlants` is empty in Office mode, so a district pick there
            // has to scan every plant in the org instead. This only comes into
            // play on the plant-by-plant fallback below, when the pre-computed
            // region groups are unavailable.
            const plantSource = dashboardPlant?.startsWith('DISTRICT:') && isOffice ? allPlants : regionPlants
            if (dashboardPlant === 'MY_PLANTS' && myPlantCodes?.size > 0) {
                myPlantCodes.forEach((code) => plantSet.add(String(code).trim()))
            } else if (dashboardPlant?.startsWith('REGION:')) {
                const regionCode = dashboardPlant.slice(7)
                const group = (regionGroups || []).find((g) => g.code === regionCode)
                const codes = group?.plantCodes || []
                codes.forEach((code) => plantSet.add(String(code).trim()))
            } else if (dashboardPlant?.startsWith('DISTRICT:')) {
                // District membership only rides along on per-region plant
                // fetches, so `allPlants` cannot answer a district query. In
                // Office mode the pre-computed region groups carry it instead;
                // within a real region the plants already have their districts
                // and the plant-by-plant scan works.
                const districtName = dashboardPlant.slice(9)
                if (isOffice && regionGroups?.length) {
                    regionGroups.forEach((region) => {
                        ;(region.districts || []).forEach((district) => {
                            if (district.name === districtName) {
                                district.plantCodes.forEach((code) => plantSet.add(String(code).trim()))
                            }
                        })
                    })
                } else {
                    const plants = plantSource || []
                    plants.forEach((p) => {
                        const code = p.plantCode || p.plant_code
                        const dists = p.districts || []
                        if (dists.some((d) => (typeof d === 'string' ? d : d?.name) === districtName)) {
                            plantSet.add(String(code).trim())
                        }
                    })
                }
            } else if (dashboardPlant) {
                // A named plant is checked before the Office catch-all, so
                // picking one plant while anchored to Home Office narrows the
                // dashboard instead of falling through to every plant.
                plantSet.add(String(dashboardPlant).trim())
            } else if (isOffice) {
                allPlants.forEach((p) => {
                    const code = p.plantCode || p.plant_code
                    if (code) plantSet.add(String(code).trim())
                })
            } else {
                const plants = regionPlants || []
                plants.forEach((p) => {
                    const code = p.plantCode || p.plant_code
                    if (code) plantSet.add(String(code).trim())
                })
            }
            plantSetRef.current = plantSet
            return plantSet
        },
        [dashboardPlant, regionPlants, allPlants, myPlantCodes, regionGroups]
    )
    const createFilterFn = useCallback((plantSet) => {
        const filterActive = plantSet.size > 0
        return (plantCode) => !filterActive || plantSet.has(String(plantCode || '').trim())
    }, [])
    return { createFilterFn, plantSetRef, updatePlantSet }
}
