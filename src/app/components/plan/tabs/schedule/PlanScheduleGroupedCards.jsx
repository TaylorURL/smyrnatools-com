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
    detailByOrderId,
    firstLoadOutByPlant,
    getCloserPlantForOrder,
    getTravelOverrides,
    groupedByPlant,
    isViewingToday,
    nowMin,
    onOpenLocation,
    onPickPlant,
    onPickProduct,
    onPickStatus,
    onViewOrder,
    onViewTickets,
    plantFilterSet,
    plantNameByCode
}) {
    return (
        /* Tighter group + card spacing on mobile so a long schedule scrolls in
         * fewer screens. Desktop keeps the original gap-4 / gap-2 rhythm. */
        <div className="flex flex-col gap-3 md:gap-4">
            {groupedByPlant.map(({ code, orders }) => {
                /* Per-plant 14h anchor — only THIS plant's first job /
                 * first outbound help. Looked up once per group so every
                 * card in the group shares the same scalar. */
                const groupFirstLoadOutMin = firstLoadOutByPlant?.get(code) ?? null
                return (
                    <div key={code} className="flex flex-col gap-1.5 md:gap-2">
                        <div className="flex items-center gap-2 px-1 text-[12px] md:text-[13px]">
                            <button type="button"
                                onClick={() => onPickPlant(code)}
                                className="border-none bg-transparent p-0 cursor-pointer active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                                title={
                                    plantFilterSet.has(code)
                                        ? 'Tap to remove plant from filter'
                                        : `Filter to plant ${code}`
                                }
                            >
                                <PlantBadge code={code} fallback={accentColor} name={plantNameByCode?.[code]} />
                            </button>
                            <span className="text-text-tertiary tabular-nums">
                                {orders.length} · {sumField(orders, 'yardage').toLocaleString()} yd
                            </span>
                        </div>
                        <div className="grid gap-1.5 md:gap-2 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                            {orders.map((o, idx) => (
                                <PlanScheduleOrderCard
                                    key={`${code}-${o.orderId || idx}`}
                                    accentColor={accentColor}
                                    closerPlant={getCloserPlantForOrder(o)}
                                    firstLoadOutMin={groupFirstLoadOutMin}
                                    isToday={isViewingToday}
                                    onOpenLocation={onOpenLocation}
                                    onPickPlant={onPickPlant}
                                    onPickProduct={onPickProduct}
                                    onPickStatus={onPickStatus}
                                    onViewOrder={onViewOrder}
                                    onViewTickets={onViewTickets}
                                    order={o}
                                    plantCode={code}
                                    plantName={plantNameByCode?.[code]}
                                    service={evaluateOrderService(
                                        o,
                                        o.orderId ? detailByOrderId[o.orderId] : null,
                                        nowMin
                                    )}
                                    travelOverrides={getTravelOverrides(o)}
                                />
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
