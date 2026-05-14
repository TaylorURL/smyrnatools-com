import React, { useEffect, useMemo, useState } from 'react'

import { DECORATIVE_CYCLE_MS } from '../../../../constants/bookOrderConstants'
import SchedulePreview from './SchedulePreview'

/** Idle-state filler — rotates through every plant with at least one
 *  scheduled order on the selected date, swapping the schedule preview
 *  every few seconds so the right-hand pane has motion / depth even
 *  before the dispatcher submits. The `key` on the inner preview forces
 *  a remount on each cycle so the row-level slide-in animations re-fire
 *  and each plant arrives with the same visual rhythm a real result
 *  does. */
export default function DecorativeSchedulePreview({ accentColor, mixerCountsByPlant, plantProduction, plants }) {
    const eligiblePlants = useMemo(() => {
        return (plants || []).filter((p) => {
            const code = p?.plantCode || p?.plant_code
            const orders = plantProduction?.[code]?.orders
            return Array.isArray(orders) && orders.length > 0
        })
    }, [plants, plantProduction])

    const [index, setIndex] = useState(0)

    useEffect(() => {
        if (eligiblePlants.length <= 1) return undefined
        const id = setInterval(() => {
            setIndex((i) => (i + 1) % eligiblePlants.length)
        }, DECORATIVE_CYCLE_MS)
        return () => clearInterval(id)
    }, [eligiblePlants.length])

    if (eligiblePlants.length === 0) return null

    const plant = eligiblePlants[index % eligiblePlants.length]
    const plantCode = plant?.plantCode || plant?.plant_code
    const plantName = plant?.plantName || plant?.plant_name || plantCode

    return (
        <SchedulePreview
            key={plantCode}
            accentColor={accentColor}
            existingOrders={plantProduction?.[plantCode]?.orders || []}
            newOrder={null}
            plantCode={plantCode}
            plantName={plantName}
            poolForPlant={mixerCountsByPlant?.[plantCode] || 0}
        />
    )
}
