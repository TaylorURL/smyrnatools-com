import { useCallback, useEffect, useRef, useState } from 'react'

import { createRealtimeChannel, Database, subscribeRealtimeChannel } from '../../services/DatabaseService'
import { OperatorService } from '../../services/OperatorService'
import { PlantService } from '../../services/PlantService'

/**
 * Centralizes all data fetching, realtime subscriptions, and region-scoped
 * plant filtering for the unified AssetView component. The asset type is
 * supplied entirely by `config`, so this hook knows nothing about mixers,
 * tractors, trailers, or equipment beyond the fields that config declares.
 *
 * Asset types with VIN search keep two lists: `items` is what the view
 * renders and a VIN query replaces it wholesale with server-side results,
 * while `allItems` holds the region-scoped set to restore when the query
 * clears. Every other type leaves `allItems` empty and uses `items` alone.
 */
export default function useAssetData({
    config,
    onResetSelectedPlant,
    preferences,
    searchText,
    selectedPlant,
    updateFilterRef
}) {
    const { service } = config

    const [allItems, setAllItems] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRegionLoading, setIsRegionLoading] = useState(false)
    const [items, setItems] = useState([])
    const [itemsLoaded, setItemsLoaded] = useState(false)
    const [operators, setOperators] = useState([])
    const [operatorsLoaded, setOperatorsLoaded] = useState(false)
    const [plants, setPlants] = useState([])
    const [regionPlantCodes, setRegionPlantCodes] = useState(null)
    const [tractors, setTractors] = useState([])

    // Read through refs inside the fetch callbacks so a new operator list or a
    // region change does not rebuild them and re-fire every effect that
    // depends on their identity.
    const operatorsRef = useRef(operators)
    operatorsRef.current = operators
    const regionCodeRef = useRef(preferences.selectedRegion?.code)
    regionCodeRef.current = preferences.selectedRegion?.code

    const attachIsVerified = useCallback(
        (obj) => {
            if (!obj || !config.attachIsVerified) return obj
            return config.attachIsVerified(obj)
        },
        [config]
    )

    const loadDetailCounts = useCallback(
        async (itemsList) => {
            if (!itemsList?.length) return
            const ids = itemsList.map((p) => p.id).filter(Boolean)
            if (!ids.length) return
            try {
                const [commentsCounts, issuesCounts] = await Promise.all([
                    service.fetchAllCommentsCounts(ids),
                    service.fetchAllIssuesCounts(ids)
                ])
                const mergeCounts = (prev) =>
                    prev.map((p) => ({
                        ...p,
                        commentsCount: commentsCounts[p.id] || 0,
                        openIssuesCount: issuesCounts[p.id] || 0
                    }))
                setItems(mergeCounts)
                if (config.hasVinSearch) setAllItems(mergeCounts)
            } catch (e) {
                console.error(`Error loading ${config.singularLabel} details:`, e)
            }
        },
        [config.hasVinSearch, config.singularLabel, service]
    )

    // Some asset types can detect and repair stale verification state as a
    // side effect of loading. A repair invalidates the list that was just
    // fetched, so the whole set is re-fetched rather than patched.
    const runVerificationCheck = useCallback(
        async (itemsToCheck) => {
            if (!config.verification?.cleanupCheck || !itemsToCheck?.length) return
            try {
                const result = await config.verification.cleanupCheck(itemsToCheck, operatorsRef.current)
                if (result.fixed > 0) {
                    const codes = await PlantService.getAllowedPlantCodes(regionCodeRef.current)
                    const refreshed = config.fetchItems ? await config.fetchItems(codes) : await service.fetchAll(codes)
                    setItems(refreshed)
                    if (config.hasVinSearch) setAllItems(refreshed)
                    loadDetailCounts(refreshed)
                }
            } catch {
                // Best-effort repair: a failure leaves the already-rendered
                // list intact rather than disrupting the view.
            }
        },
        [config, loadDetailCounts, service]
    )

    const fetchAllItems = useCallback(
        async (codes) => {
            try {
                const rawItems = config.fetchItems ? await config.fetchItems(codes) : await service.fetchAll(codes)
                const list = Array.isArray(rawItems) ? rawItems : []

                // Cleanup rewrites rows (mixers and tractors normalize
                // placeholder operator ids to null), so anything it repaired
                // makes the list just fetched stale and forces a second read.
                if (config.postFetchCleanup) {
                    const cleanupResult = await config.postFetchCleanup(list)
                    if (cleanupResult.fixed > 0) {
                        const refreshed = config.fetchItems
                            ? await config.fetchItems(codes)
                            : await service.fetchAll(codes)
                        setItems(refreshed)
                        if (config.hasVinSearch) setAllItems(refreshed)
                        setItemsLoaded(true)
                        loadDetailCounts(refreshed)
                        setTimeout(() => runVerificationCheck(refreshed), 1000)
                        return
                    }
                }

                setItems(list)
                if (config.hasVinSearch) setAllItems(list)
                setItemsLoaded(true)
                loadDetailCounts(list)
                if (config.verification?.cleanupCheck) {
                    setTimeout(() => runVerificationCheck(list), 1000)
                }
            } catch (error) {
                console.error(`[ASSET VIEW] Error fetching ${config.pluralLabel}:`, error)
                setItems([])
                if (config.hasVinSearch) setAllItems([])
            }
        },
        [config, loadDetailCounts, runVerificationCheck, service]
    )

    // Operators carry their own comment-count badge in the asset cards and
    // rows, so the counts are folded onto each operator here rather than
    // fetched again per rendered row.
    const fetchOperators = useCallback(async () => {
        if (!config.hasOperatorAssignment) return
        try {
            const data = await OperatorService.fetchOperators()
            const ops = Array.isArray(data) ? data : []
            const ids = ops.map((op) => op.employeeId).filter(Boolean)
            if (ids.length) {
                const counts = await OperatorService.fetchAllCommentsCounts(ids)
                ops.forEach((op) => {
                    op.commentsCount = counts[op.employeeId] || 0
                })
            }
            setOperators(ops)
            setOperatorsLoaded(true)
        } catch {
            setOperators([])
        }
    }, [config.hasOperatorAssignment])

    // Only trailers declare a tractor assignment; every other asset type
    // leaves this list empty.
    const fetchTractors = useCallback(async () => {
        if (!config.hasTractorAssignment) return
        try {
            const data = await config.fetchTractors()
            setTractors(Array.isArray(data) ? data : [])
        } catch {
            setTractors([])
        }
    }, [config])

    const fetchPlants = useCallback(async (codes) => {
        try {
            const regionCode = regionCodeRef.current
            if (regionCode) {
                // District membership only exists on the region-to-plant
                // relation, so the region-scoped read is the only one that
                // yields plants the district filter can group.
                const regionData = await PlantService.fetchRegionPlants(regionCode)
                setPlants(Array.isArray(regionData) ? regionData : [])
            } else {
                const data = await PlantService.fetchPlants(codes)
                setPlants(Array.isArray(data) ? data : [])
            }
        } catch {
            setPlants([])
        }
    }, [])

    const handleRealtimeUpdate = useCallback(
        (eventType, data) => {
            const updateItemInList = (setter) => {
                setter((prev) => {
                    if (eventType === 'UPDATE' && data.new) {
                        return prev.map((item) => {
                            if (item.id !== data.new.id) return item
                            const patched = { ...item }
                            for (const [dbCol, modelProp] of Object.entries(config.realtimeFieldMap)) {
                                if (data.new[dbCol] !== undefined) {
                                    patched[modelProp] = data.new[dbCol] ?? item[modelProp]
                                }
                            }
                            return attachIsVerified(patched)
                        })
                    }
                    if (eventType === 'INSERT' && data.new) {
                        if (regionPlantCodes && !regionPlantCodes.has(data.new.assigned_plant)) return prev
                        if (prev.some((p) => p.id === data.new.id)) return prev
                        const newItem = {
                            createdAt: data.new.created_at ?? new Date().toISOString(),
                            id: data.new.id
                        }
                        for (const [dbCol, modelProp] of Object.entries(config.realtimeFieldMap)) {
                            newItem[modelProp] = data.new[dbCol] ?? ''
                        }
                        return [...prev, attachIsVerified(newItem)]
                    }
                    if (eventType === 'DELETE' && data.old) {
                        return prev.filter((item) => item.id !== data.old.id)
                    }
                    return prev
                })
            }
            updateItemInList(setItems)
            if (config.hasVinSearch) updateItemInList(setAllItems)
        },
        [attachIsVerified, config.hasVinSearch, config.realtimeFieldMap, regionPlantCodes]
    )

    // The handler is rebuilt whenever the region scope changes, so the
    // subscription reads it through a ref. Depending on it directly would tear
    // the channel down and rebuild it on every region change, dropping events
    // in the gap.
    const handleRealtimeUpdateRef = useRef(handleRealtimeUpdate)
    handleRealtimeUpdateRef.current = handleRealtimeUpdate

    // A channel that drops and rejoins resumes the stream without replaying
    // what it missed, so the list is re-read on recovery. It goes through a
    // ref for the same reason the handler does: the fetch is rebuilt whenever
    // the region scope changes, and depending on it would tear the channel
    // down and rebuild it.
    const refetchItemsRef = useRef(null)
    refetchItemsRef.current = () => fetchAllItems(regionPlantCodes)

    // The list and the statistics dashboard both run this hook against the same
    // asset config, and the shell swaps one for the other in a single commit, so
    // the topic has to be unique per subscription rather than per asset type.
    useEffect(() => {
        const channel = subscribeRealtimeChannel(
            createRealtimeChannel(config.channelName).on(
                'postgres_changes',
                { event: '*', schema: 'public', table: config.tableName },
                (payload) => {
                    handleRealtimeUpdateRef.current(payload.eventType, { new: payload.new, old: payload.old })
                }
            ),
            (reason) => console.error(`${config.singularLabel} realtime subscription error: ${reason}`),
            () => refetchItemsRef.current?.()
        )
        return () => Database.removeChannel(channel)
    }, [config.channelName, config.singularLabel, config.tableName])

    // Region scope is the only preference this load reads, and it is the only
    // one it may depend on. One run re-fetches the whole item list, the
    // plants, and where the asset type has them the operators and tractors, so
    // widening the dependency to the preferences object puts that behind every
    // write to any preference — a filter, a sort, a view mode, each of which
    // rewrites it — and working the filters stacks whole-fleet reads on top of
    // each other until one outlives its timeout and is aborted in flight.
    useEffect(() => {
        async function fetchAllData() {
            setIsLoading(true)
            try {
                const codes = await PlantService.getAllowedPlantCodes(preferences.selectedRegion?.code)
                setRegionPlantCodes(codes)
                const promises = [fetchAllItems(codes), fetchPlants(codes)]
                if (config.hasOperatorAssignment) promises.push(fetchOperators())
                if (config.hasTractorAssignment) promises.push(fetchTractors())
                await Promise.all(promises)
            } finally {
                setIsLoading(false)
            }
        }
        fetchAllData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preferences.selectedRegion?.code])

    useEffect(() => {
        let cancelled = false
        async function loadAllowedPlants() {
            const code = preferences.selectedRegion?.code
            if (code) setIsRegionLoading(true)
            try {
                const codes = await PlantService.getAllowedPlantCodes(code)
                if (cancelled) return
                setRegionPlantCodes(codes)
                // Switching regions can strand the selected plant outside the
                // new scope, which would show an empty list with no visible
                // cause. Clear the selection instead.
                const sel = String(selectedPlant || '')
                    .trim()
                    .toUpperCase()
                if (sel && codes && !codes.has(sel)) {
                    onResetSelectedPlant?.()
                    updateFilterRef.current?.('selectedPlant', '')
                }
            } catch {
                if (!cancelled) setRegionPlantCodes(null)
            } finally {
                if (!cancelled) setIsRegionLoading(false)
            }
        }
        loadAllowedPlants()
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preferences.selectedRegion?.code])

    // A full 17-character alphanumeric search term is treated as a VIN and
    // queried server-side, because a VIN can identify an asset outside the
    // region-scoped set already in memory. The result is still narrowed to
    // the region so the scope selector keeps its meaning. Anything shorter
    // falls back to the in-memory list and the ordinary text filters.
    useEffect(() => {
        if (!config.hasVinSearch || !config.vinSearchFn) return

        async function searchByVin() {
            const normalizedSearch = searchText.trim().toLowerCase().replace(/\s+/g, '')
            if (normalizedSearch.length >= 17 && /^[a-z0-9]+$/i.test(normalizedSearch)) {
                setIsLoading(true)
                try {
                    const vinItems = await config.vinSearchFn(normalizedSearch)
                    const filtered = regionPlantCodes
                        ? vinItems.filter((m) =>
                              regionPlantCodes.has(
                                  String(m.assignedPlant || '')
                                      .trim()
                                      .toUpperCase()
                              )
                          )
                        : vinItems
                    setItems(filtered)
                    setItemsLoaded(true)
                } catch {
                    // Leave the current list in place; an empty result would
                    // read as "no such VIN" rather than a failed lookup.
                }
                setIsLoading(false)
            } else {
                setItems(allItems)
            }
        }

        if (searchText.trim().length >= 1) {
            searchByVin()
        } else {
            setItems(allItems)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchText, allItems, regionPlantCodes])

    return {
        allItems,
        fetchAllItems,
        isLoading,
        isRegionLoading,
        items,
        itemsLoaded,
        operators,
        operatorsLoaded,
        plants,
        regionPlantCodes,
        setAllItems,
        setIsLoading,
        setItems,
        tractors
    }
}
