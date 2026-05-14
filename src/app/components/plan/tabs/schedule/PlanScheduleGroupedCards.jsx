import React from 'react'

import { evaluateOrderService, sumField } from '../../../../../utils/PlanScheduleUtility'
import { PlantBadge } from './PlanScheduleBadges'
import PlanScheduleOrderCard from './PlanScheduleOrderCard'

/**
 * Card / grouped view of the schedule — orders bucketed by plant code,
 * each plant header acts as a filter chip (tap to add/remove the plant
 * from the active filter). Used on mobile by default and on desktop
 * when the dispatcher toggles Cards mode.
 */
export default function PlanScheduleGroupedCards({
    accentColor,
    cardFirstLoadOutMin,
    detailByOrderId,
    getCloserPlantForOrder,
    getTravelOverrides,
    groupedByPlant,
    isViewingToday,
    nowMin,
    onOpenLocation,
    onPickPlant,
    onPickProduct,
    onPickStatus,
    plantFilterSet,
    plantNameByCode
}) {
    return (
        <div className="flex flex-col gap-4">
            {groupedByPlant.map(({ code, orders }) => (
                <div key={code} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 px-1 text-[13px]">
                        <button
                            type="button"
                            onClick={() => onPickPlant(code)}
                            className="border-none bg-transparent p-0 cursor-pointer"
                            title={
                                plantFilterSet.has(code) ? 'Tap to remove plant from filter' : `Filter to plant ${code}`
                            }
                        >
                            <PlantBadge code={code} fallback={accentColor} name={plantNameByCode?.[code]} />
                        </button>
                        <span className="text-text-tertiary">
                            {orders.length} order{orders.length === 1 ? '' : 's'} ·{' '}
                            {sumField(orders, 'yardage').toLocaleString()} yd
                        </span>
                    </div>
                    <div className="grid gap-2 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                        {orders.map((o, idx) => (
                            <PlanScheduleOrderCard
                                key={`${code}-${o.orderId || idx}`}
                                accentColor={accentColor}
                                closerPlant={getCloserPlantForOrder(o)}
                                firstLoadOutMin={cardFirstLoadOutMin}
                                isToday={isViewingToday}
                                onOpenLocation={onOpenLocation}
                                onPickPlant={onPickPlant}
                                onPickProduct={onPickProduct}
                                onPickStatus={onPickStatus}
                                order={o}
                                plantCode={code}
                                plantName={plantNameByCode?.[code]}
                                service={evaluateOrderService(o, o.orderId ? detailByOrderId[o.orderId] : null, nowMin)}
                                travelOverrides={getTravelOverrides(o)}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
