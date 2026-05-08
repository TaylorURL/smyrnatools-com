import { useEffect, useState } from 'react'

import { GeocodeService } from '../../services/GeocodeService'
import { RoutingService } from '../../services/RoutingService'

/* Fallback math when the OSRM router is unreachable. Concrete trucks
 * average ~40 mph (~64 km/h) across the mixed urban/highway legs of a
 * typical Smyrna pour. Haversine-km × this factor + 25% routing slack
 * gives a defensible estimate, but it's a straight-line guess — same
 * 3-digit ZIP region plants can sit on opposite sides of the metro and
 * read as equidistant. The OSRM lookup above is the primary signal;
 * this only kicks in when the routing call fails. */
const KM_PER_MIN = 64 / 60
const ROUTING_SLACK = 1.25

const toRadians = (degrees) => (degrees * Math.PI) / 180

/** Great-circle distance in kilometres between two `{ lat, lng }` points. */
const haversineKm = (a, b) => {
    if (!a || !b) return null
    const earthRadiusKm = 6371
    const dLat = toRadians(b.lat - a.lat)
    const dLng = toRadians(b.lng - a.lng)
    const lat1 = toRadians(a.lat)
    const lat2 = toRadians(b.lat)
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

const haversineMinutes = (a, b) => {
    const km = haversineKm(a, b)
    if (km == null) return null
    return Math.round((km / KM_PER_MIN) * ROUTING_SLACK)
}

/**
 * Geocodes the job address and every plant address via `GeocodeService`,
 * then asks `RoutingService` (OSRM's free public demo server) for
 * actual road-network driving minutes per plant. Falls back to a
 * haversine-based estimate when OSRM is unreachable so the recommender
 * always has SOME signal — but the OSRM number is far less ambiguous
 * for plants that share a 3-digit ZIP prefix but live on opposite sides
 * of the metro.
 *
 * Results stream in incrementally as each plant resolves, so the
 * booking recommender can re-rank against partial data without waiting
 * for the slowest lookup.
 *
 * @param {object} args
 * @param {string} args.jobAddress - Free-form job address typed by dispatch.
 * @param {Array}  args.plants     - Plants with `plantCode` / `plantAddress`
 *                                   (or snake_case equivalents).
 * @returns {{ minutesByPlantCode: Record<string, number>, isLoading: boolean }}
 */
export default function useAddressDistances({ jobAddress, plants }) {
    const [minutesByPlantCode, setMinutesByPlantCode] = useState({})
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (!jobAddress || !Array.isArray(plants) || plants.length === 0) {
            setMinutesByPlantCode({})
            setIsLoading(false)
            return undefined
        }

        let cancelled = false
        setIsLoading(true)
        setMinutesByPlantCode({})

        const run = async () => {
            const jobCoord = await GeocodeService.geocode(jobAddress)
            if (cancelled) return
            if (!jobCoord) {
                setIsLoading(false)
                return
            }
            for (const plant of plants) {
                if (cancelled) return
                const plantCode = plant?.plantCode || plant?.plant_code
                const plantAddress = plant?.plantAddress || plant?.plant_address
                if (!plantCode || !plantAddress) continue
                const plantCoord = await GeocodeService.geocode(plantAddress)
                if (cancelled) return
                if (!plantCoord) continue
                /* Real road-network minutes via OSRM first, then fall
                 * back to the haversine estimate when the router fails
                 * (rate limit, transient network error, etc.). */
                const routedMinutes = await RoutingService.getDrivingMinutes(plantCoord, jobCoord)
                if (cancelled) return
                const minutes = Number.isFinite(routedMinutes) ? routedMinutes : haversineMinutes(jobCoord, plantCoord)
                if (!Number.isFinite(minutes)) continue
                setMinutesByPlantCode((prev) => ({ ...prev, [plantCode]: minutes }))
            }
            if (!cancelled) setIsLoading(false)
        }

        run()

        return () => {
            cancelled = true
        }
    }, [jobAddress, plants])

    return { isLoading, minutesByPlantCode }
}
