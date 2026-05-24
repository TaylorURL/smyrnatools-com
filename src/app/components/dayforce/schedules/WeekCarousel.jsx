import React, { useEffect } from 'react'

import { WeekNavigator } from './WeekNavigator'
import { WeekTable } from './WeekTable'

/** Clamps the active week index when the underlying `weekTables` array
 *  changes shape (different time-range period, filter narrows the rows
 *  down to a single week, etc.). Snap back to the newest week so the
 *  user always lands on a valid week — never on an empty rendering
 *  slot because the previous index is now out of range. */
export function WeekCarousel({ accent, activeWeekIndex, setActiveWeekIndex, weekTables }) {
    useEffect(() => {
        if (activeWeekIndex >= weekTables.length && weekTables.length > 0) {
            setActiveWeekIndex(0)
        }
    }, [activeWeekIndex, setActiveWeekIndex, weekTables.length])

    const safeIndex = Math.max(0, Math.min(activeWeekIndex, weekTables.length - 1))
    const week = weekTables[safeIndex]
    if (!week) return null

    return (
        <>
            {weekTables.length > 1 && (
                <WeekNavigator
                    accentColor={accent}
                    count={weekTables.length}
                    label={week.weekLabel}
                    onIndexChange={setActiveWeekIndex}
                    position={safeIndex}
                />
            )}
            <WeekTable
                accent={accent}
                days={week.days}
                operatorRows={week.operatorRows}
                totalsByDay={week.totalsByDay}
                weekLabel={week.weekLabel}
                weekTotal={week.weekTotal}
                weekYardageTotal={week.weekYardageTotal}
            />
        </>
    )
}
