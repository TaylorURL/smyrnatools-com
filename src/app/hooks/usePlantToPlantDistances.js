import { useEffect, useState } from 'react'

import { GeocodeService } from '../../services/GeocodeService'
import { RoutingService } from '../../services/RoutingService'

/* Concrete trucks average ~40 mph (~64 km/h) across mixed urban/highway
 * legs. Haversine-km × this factor + 25% routing slack gives a usable
 * fallback when OSRM is unreachable. Mirrors the constants in
 * `useAddressDistances` intentionally so plant-to-plant and plant-to-job
 * estimates use the same model. */
const KM_PER_MIN = 64 / 60
const ROUTING_SLACK = 1.25

const toRadians = (degrees) => (degrees * Math.PI) / 180

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
 * Geocodes the "from" plant and every other plant's address, then asks
 * `RoutingService` (OSRM) for real road-network driving minutes from the
 * "from" plant to each other plant. Falls back to a haversine estimate
 * when OSRM is unreachable.
 *
 * Used by the booking recommender to filter help-availability suggestions
 * to lender plants that are realistically reachable (≤ 1 hour drive) from
 * the plant that needs help — sending a truck further than that eats the
 * lender's whole shift and isn't viable dispatch practice.
 *
 * Results stream in incrementally as each plant resolves so the
 * recommender can re-rank against partial data.
 *
 * @param {object} args
 * @param {string} args.fromPlantCode - Plant code that's short on trucks.
 * @param {Array}  args.plants        - Plants with `plantCode` / `plantAddress`
 *                                      (snake_case equivalents supported).
 * @returns {{ minutesByPlantCode: Record<string, number>, isLoading: boolean }}
 */
export default function usePlantToPlantDistances({ fromPlantCode, plants }) {
    const [minutesByPlantCode, setMinutesByPlantCode] = useState({})
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (!fromPlantCode || !Array.isArray(plants) || plants.length === 0) {
            setMinutesByPlantCode({})
            setIsLoading(false)
            return undefined
        }

        const fromPlant = plants.find((p) => (p?.plantCode || p?.plant_code) === fromPlantCode)
        const fromAddress = fromPlant?.plantAddress || fromPlant?.plant_address
        if (!fromAddress) {
            setMinutesByPlantCode({})
            setIsLoading(false)
            return undefined
        }

        let cancelled = false
        setIsLoading(true)
        setMinutesByPlantCode({})

        const run = async () => {
            const fromCoord = await GeocodeService.geocode(fromAddress)
            if (cancelled) return
            if (!fromCoord) {
                setIsLoading(false)
                return
            }
            for (const plant of plants) {
                if (cancelled) return
                const plantCode = plant?.plantCode || plant?.plant_code
                if (!plantCode || plantCode === fromPlantCode) continue
                const plantAddress = plant?.plantAddress || plant?.plant_address
                if (!plantAddress) continue
                const plantCoord = await GeocodeService.geocode(plantAddress)
                if (cancelled) return
                if (!plantCoord) continue
                const routedMinutes = await RoutingService.getDrivingMinutes(fromCoord, plantCoord)
                if (cancelled) return
                const minutes = Number.isFinite(routedMinutes) ? routedMinutes : haversineMinutes(fromCoord, plantCoord)
                if (!Number.isFinite(minutes)) continue
                setMinutesByPlantCode((prev) => ({ ...prev, [plantCode]: minutes }))
            }
            if (!cancelled) setIsLoading(false)
        }

        run()

        return () => {
            cancelled = true
        }
    }, [fromPlantCode, plants])

    return { isLoading, minutesByPlantCode }
}
