import { useEffect, useState } from 'react'

import { ReportService } from '../../services/ReportService'
import { ReportUtility } from '../../utils/ReportUtility'

/** Computes raw & adjusted YPH (yards per man-hour) for the current week,
 *  including hours received from other plants (subtracted from the
 *  denominator on the adjusted metric). Re-runs whenever the week, plant,
 *  or current form values change. */
export function useYphCalculation(weekIso, plantCode, form) {
    const [yph, setYph] = useState({ adjusted: 0, raw: 0 })
    const [grade, setGrade] = useState({ adjusted: '', raw: '' })
    const [label, setLabel] = useState({ adjusted: '', raw: '' })

    useEffect(() => {
        let mounted = true
        async function calculate() {
            const applyMetrics = (hoursReceived) => {
                const metrics = ReportUtility.getFullYphMetrics(form, hoursReceived)
                if (!mounted) return
                setYph({ adjusted: metrics.adjusted, raw: metrics.raw })
                setGrade({ adjusted: metrics.adjustedGrade, raw: metrics.rawGrade })
                setLabel({ adjusted: metrics.adjustedLabel, raw: metrics.rawLabel })
            }
            if (!weekIso || !plantCode) {
                applyMetrics(0)
                return
            }
            try {
                const [year] = weekIso.split('T')[0].split('-').map(Number)
                const allReports = await ReportService.fetchPlantManagerReportsForYear(year)
                if (!mounted) return
                const completedReports = (allReports || []).filter((r) => r.completed)
                const hoursReceived = ReportUtility.calculateHoursReceivedForWeek(completedReports, weekIso, plantCode)
                applyMetrics(hoursReceived)
            } catch (err) {
                console.error('Error calculating YPH:', err)
                applyMetrics(0)
            }
        }
        calculate()
        return () => {
            mounted = false
        }
    }, [weekIso, plantCode, form])

    return { grade, label, yph }
}
