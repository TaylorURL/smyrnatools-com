import { useCallback, useMemo, useState } from 'react'

import { formatMinutesClock } from '../../utils/PlanUtility'

const COPY_FEEDBACK_MS = 1500

/**
 * Operator clock-in roster for the currently filtered single plant —
 * sorted earliest first, then padded out to the plant's raw base count
 * with "off" rows so removed/unneeded operators stay visible to the
 * dispatcher. Empty when zero or 2+ plants are selected (the roster
 * is a per-plant artifact).
 *
 * Also exposes a `copyOperatorRoster` callback + 1.5s "copied!" feedback
 * flag for the FilterDrawer's Copy Roster button.
 */
export function usePlanScheduleRoster({ clockInRows, poolSourceByCode, singlePlant }) {
    const operatorRosterText = useMemo(() => {
        if (!singlePlant) return ''
        const sortedTimes = clockInRows
            .filter((r) => r.plantCode === singlePlant)
            .map((r) => (Number.isFinite(r.time) ? Math.round(r.time / 5) * 5 : r.time))
            .sort((a, b) => a - b)
        const rawBase = poolSourceByCode?.[singlePlant]?.rawBase ?? sortedTimes.length
        const slotCount = Math.max(rawBase, sortedTimes.length)
        if (slotCount === 0) return ''
        return Array.from({ length: slotCount }, (_, i) => {
            const time = sortedTimes[i]
            return `Operator ${i + 1}: ${Number.isFinite(time) ? formatMinutesClock(time) : 'off'}`
        }).join('\n')
    }, [clockInRows, singlePlant, poolSourceByCode])

    const [operatorRosterCopied, setOperatorRosterCopied] = useState(false)
    const copyOperatorRoster = useCallback(async () => {
        if (!operatorRosterText) return
        try {
            await navigator.clipboard.writeText(operatorRosterText)
            setOperatorRosterCopied(true)
            setTimeout(() => setOperatorRosterCopied(false), COPY_FEEDBACK_MS)
        } catch {
            // Clipboard write can fail in insecure contexts — silently no-op.
        }
    }, [operatorRosterText])

    return { copyOperatorRoster, operatorRosterCopied, operatorRosterText }
}
