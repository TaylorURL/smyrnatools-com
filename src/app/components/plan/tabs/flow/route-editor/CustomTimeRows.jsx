/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { MilitaryTimeInput } from '../../../../common/MilitaryTimeInput'

export function CustomTimeRows({ draft, driverCount, onUpdate }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="grid grid-cols-[28px_1fr_1fr] gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-text-tertiary px-1">
                <span>#</span>
                <span>Arrive</span>
                <span>Leave</span>
            </div>
            {Array.from({ length: driverCount }, (_, index) => {
                const rowTimes = draft.customTimes?.[index] || {}
                return (
                    <div key={index} className="grid grid-cols-[28px_1fr_1fr] gap-2 items-center">
                        <span className="font-mono tabular-nums text-[12px] font-semibold text-text-secondary text-center">
                            {index + 1}
                        </span>
                        <MilitaryTimeInput
                            compact
                            extraClass="w-full"
                            onChange={(next) => onUpdate(index, 'time', next)}
                            value={rowTimes.time || ''}
                        />
                        <MilitaryTimeInput
                            compact
                            extraClass="w-full"
                            onChange={(next) => onUpdate(index, 'leaveTime', next)}
                            value={rowTimes.leaveTime || ''}
                        />
                    </div>
                )
            })}
        </div>
    )
}
