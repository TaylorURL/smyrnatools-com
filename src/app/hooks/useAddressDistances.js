import { useEffect, useState } from 'react'

import { GeocodeService } from '../../services/GeocodeService'

/* Concrete trucks average ~40 mph (~64 km/h) across the mixed urban / highway
 * legs of a typical Smyrna pour. We convert haversine-km to drive-time
 * minutes via this assumption, then add a 25% slack factor so a plant that
 * tests as a 60-min haul on flat distance doesn't sneak in once routing
 * detours and city traffic are factored in. */
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

/**
 * Geocodes the job address and every plant address via `GeocodeService`,
 * then returns an estimated one-way drive-time (in minutes) per plant code.
 *
 * Results stream in incrementally as each plant resolves, so the booking
 * recommender can re-rank against partial data without waiting for the
 * slowest geocode.
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
                const km = haversineKm(jobCoord, plantCoord)
                if (km == null) continue
                const minutes = Math.round((km / KM_PER_MIN) * ROUTING_SLACK)
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
