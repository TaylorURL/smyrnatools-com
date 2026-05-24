import { useEffect, useMemo, useState } from 'react'

import { formatOrderAddress } from '../../../../utils/AddressUtility'
import { geocodeAddress, getCachedGeocode } from '../../../../utils/GeocodingUtility'
import { getCachedRoute, getDrivingRoute } from '../../../../utils/RoutingUtility'
import {
    haversineMiles,
    inferStateCodeFromAddress,
    MAX_JOB_DRIVE_SECONDS,
    MAX_JOB_STRAIGHT_LINE_MILES
} from './flowMapShared'

/** Resolve via-job routes when assignments target a specific order.
 *  Mirrors the Find-a-Spot address pipeline: compose the order's street +
 *  city with `formatOrderAddress`, geocode with the same `geocodeAddress`
 *  helper (which already handles state hints and fallback variants), then
 *  stitch two OSRM legs (fromPlant → job and job → returnPlant) into one
 *  continuous polyline. Falls back silently to the plain plant-to-plant
 *  route if any step misses. */
export function useJobRoutes({ assignments, geocodedPlants, plantProduction, plants, stateHint }) {
    const [jobRoutesByIdx, setJobRoutesByIdx] = useState({})

    /** Map of plant_code → { address, state }. State is inferred from the
     *  plant's address so a Texas plant geocodes its orders with Texas as
     *  the hint regardless of the region's global default. */
    const plantMetaByCode = useMemo(() => {
        const out = {}
        ;(plants || []).forEach((plant) => {
            const code = plant?.plant_code
            if (!code) return
            out[code] = {
                address: plant.plant_address || '',
                state: inferStateCodeFromAddress(plant.plant_address) || null
            }
        })
        return out
    }, [plants])

    useEffect(() => {
        const eligible = assignments
            .map((a, idx) => ({ a, idx }))
            .filter(({ a }) => a?.forOrderId && a?.fromPlant && a?.toPlant)
        const plantsByCode = new Map(geocodedPlants.map((p) => [p.code, p]))
        // Drop entries whose underlying assignment no longer routes via a
        // specific job so we don't render stale geometry after edits.
        const activeIdxSet = new Set(eligible.map(({ idx }) => idx))
        setJobRoutesByIdx((prev) => {
            const next = {}
            Object.entries(prev).forEach(([k, v]) => {
                const idx = Number(k)
                if (activeIdxSet.has(idx)) next[k] = v
            })
            return next
        })
        if (eligible.length === 0) return undefined

        let cancelled = false
        ;(async () => {
            const updates = {}
            for (const { a, idx } of eligible) {
                if (cancelled) return
                const destPlant = plantProduction?.[a.toPlant]
                const order = (destPlant?.orders || []).find((o) => (o.orderId || o.orderNum) === a.forOrderId)
                if (!order) continue
                const street = String(order.address || '').trim()
                const city = String(order.city || '').trim()
                if (!street && !city) continue
                const composedLabel = formatOrderAddress(order, ', ')
                const destAnchor = plantsByCode.get(a.toPlant)
                if (!destAnchor) continue
                const orderStateHint = plantMetaByCode[a.toPlant]?.state || stateHint
                // Reject coords that are wildly far from the destination
                // plant — those are Nominatim picking the wrong state /
                // city ("Memphis, TN" → "Memphis, NY"). Cap is a cheap
                // pre-filter; the OSRM drive-time check below catches the
                // borderline cases.
                const validate = (coords) =>
                    haversineMiles(coords, { lat: destAnchor.lat, lng: destAnchor.lng }) <= MAX_JOB_STRAIGHT_LINE_MILES
                const cachedJob = getCachedGeocode(street, city, orderStateHint, { validate })
                const jobCoords = cachedJob || (await geocodeAddress(street, city, orderStateHint, { validate }))
                if (cancelled) return
                if (!jobCoords) continue
                const from = plantsByCode.get(a.fromPlant)
                const returnCode = a.returnPlant || a.fromPlant
                const ret = plantsByCode.get(returnCode)
                if (!from || !ret) continue
                const fromKey = { lat: from.lat, lng: from.lng }
                const jobKey = { lat: jobCoords.lat, lng: jobCoords.lng }
                const retKey = { lat: ret.lat, lng: ret.lng }
                const outRoute = getCachedRoute(fromKey, jobKey) || (await getDrivingRoute(fromKey, jobKey))
                if (cancelled) return
                // Hard cap — any leg over two hours is unrealistic for a
                // ready-mix delivery (concrete sets in ~90 min from water
                // contact) and almost certainly reflects a geocoder
                // misfire that slipped past the straight-line filter.
                // Fall back to plain plant-to-plant routing in that case.
                if (outRoute && outRoute.duration > MAX_JOB_DRIVE_SECONDS) continue
                const backRoute = getCachedRoute(jobKey, retKey) || (await getDrivingRoute(jobKey, retKey))
                if (cancelled) return
                if (backRoute && backRoute.duration > MAX_JOB_DRIVE_SECONDS) continue
                const outCoords =
                    outRoute?.coords?.length >= 2
                        ? outRoute.coords
                        : [
                              [from.lat, from.lng],
                              [jobCoords.lat, jobCoords.lng]
                          ]
                const backCoords =
                    backRoute?.coords?.length >= 2
                        ? backRoute.coords
                        : [
                              [jobCoords.lat, jobCoords.lng],
                              [ret.lat, ret.lng]
                          ]
                const outDistance = outRoute?.distance || 0
                const backDistance = backRoute?.distance || 0
                const outDuration = outRoute?.duration || 0
                const backDuration = backRoute?.duration || 0
                updates[idx] = {
                    backCoords,
                    backDistance,
                    backDuration,
                    backLegMinutes: backDuration ? Math.round(backDuration / 60) : null,
                    forOrderId: a.forOrderId,
                    fromPlant: a.fromPlant,
                    jobCoords,
                    jobLabel: composedLabel || order.customer || `Order ${order.orderNum || ''}`.trim(),
                    outCoords,
                    outDistance,
                    outDuration,
                    outLegMinutes: outDuration ? Math.round(outDuration / 60) : null,
                    returnCode
                }
            }
            if (!cancelled && Object.keys(updates).length) {
                setJobRoutesByIdx((prev) => ({ ...prev, ...updates }))
            }
        })()
        return () => {
            cancelled = true
        }
    }, [assignments, geocodedPlants, plantMetaByCode, plantProduction, stateHint])

    return jobRoutesByIdx
}
