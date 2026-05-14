import { useCallback, useEffect, useMemo, useState } from 'react'

import { AIService } from '../../services/AIService'
import { ReportService } from '../../services/ReportService'

/** Returns the previous-week value for a GM form field, matching by exact
 *  key first, then by base+plantCode with case-insensitive / digits-only
 *  fallbacks. Mirrors the legacy `getLastWeekValue` resolver. */
export function buildLastWeekValueResolver(lastWeekGm) {
    return (field) => {
        const data = lastWeekGm?.data
        if (!data) return ''
        const key = String(field || '')
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const v = data[key]
            return v === undefined || v === null ? '' : v
        }
        const idx = key.lastIndexOf('_')
        if (idx <= 0 || idx === key.length - 1) return ''
        const base = key.slice(0, idx)
        const code = key.slice(idx + 1)
        const normalize = (s) => {
            const t = String(s || '').trim()
            const upp = t.toUpperCase()
            const digits = t.replace(/\D/g, '').replace(/^0+/, '') || t.replace(/\D/g, '')
            return { digits, upp }
        }
        const want = normalize(code)
        for (const k of Object.keys(data)) {
            if (!k.startsWith(base + '_')) continue
            const suf = k.slice(base.length + 1)
            const cand = normalize(suf)
            if (cand.upp === want.upp || (cand.digits && want.digits && cand.digits === want.digits)) {
                const v = data[k]
                return v === undefined || v === null ? '' : v
            }
        }
        return ''
    }
}

/** Assembles the AI analysis context payload from the current form,
 *  efficiency reports, and aggregate report data. */
function buildAnalysisContext({ aggReport, effReports, form, getLastWeekValue, plants, rmiReport, weekIso }) {
    const plantSummaries = plants.map((p) => {
        const code = p.plant_code
        return {
            downTrucks: form[`down_trucks_${code}`],
            hours: form[`total_hours_${code}`],
            lastWeekDown: getLastWeekValue(`down_trucks_${code}`),
            lastWeekHours: getLastWeekValue(`total_hours_${code}`),
            lastWeekOperators: getLastWeekValue(`active_operators_${code}`),
            lastWeekRunnable: getLastWeekValue(`runnable_trucks_${code}`),
            lastWeekYardage: getLastWeekValue(`total_yardage_${code}`),
            notes: form[`notes_${code}`],
            operators: form[`active_operators_${code}`],
            operatorsLeaving: form[`operators_leaving_${code}`],
            operatorsStarting: form[`operators_starting_${code}`],
            operatorsTraining: form[`new_operators_training_${code}`],
            plantCode: code,
            plantName: p.plant_name || code,
            runnableTrucks: form[`runnable_trucks_${code}`],
            yardage: form[`total_yardage_${code}`]
        }
    })
    const efficiencyReports = effReports.map((r) => {
        const insights = ReportService.getPlantProductionInsights(r.rows || [])
        return {
            avgLoadsPerHour: insights.avgLoadsPerHour,
            plantCode: r.plant_code,
            totalHours: insights.totalHours,
            totalLoads: insights.totalLoads
        }
    })
    return {
        aggregateData: aggReport?.data || null,
        efficiencyReports,
        plantSummaries,
        plants,
        rmiReport,
        weekIso
    }
}

/** Generates the AI regional analysis for a GM report — auto-runs when
 *  the form has data and `rmiLoading` flips false, and exposes a manual
 *  regenerate function for the "Try again" button. */
export function useGmAiAnalysis({ aggReport, effReports, form, lastWeekGm, plants, rmiLoading, rmiReport, weekIso }) {
    const [aiAnalysis, setAiAnalysis] = useState(null)
    const [aiLoading, setAiLoading] = useState(false)
    const [aiError, setAiError] = useState(false)

    const getLastWeekValue = useMemo(() => buildLastWeekValueResolver(lastWeekGm), [lastWeekGm])

    const runAnalysis = useCallback(async () => {
        try {
            const reportContext = buildAnalysisContext({
                aggReport,
                effReports,
                form,
                getLastWeekValue,
                plants,
                rmiReport,
                weekIso
            })
            const analysis = await AIService.generateGMReportAnalysis(reportContext)
            if (analysis) {
                setAiAnalysis(analysis)
            } else {
                setAiError(true)
            }
        } catch (err) {
            console.error('Error generating AI analysis:', err)
            setAiError(true)
        }
    }, [aggReport, effReports, form, getLastWeekValue, plants, rmiReport, weekIso])

    useEffect(() => {
        let cancelled = false
        async function generate() {
            if (!plants.length || !weekIso) return
            if (aiAnalysis) return
            setAiLoading(true)
            setAiError(false)
            await runAnalysis()
            if (!cancelled) setAiLoading(false)
        }
        const hasData = Object.keys(form).some((k) => form[k] !== undefined && form[k] !== '')
        if (hasData && !rmiLoading) generate()
        return () => {
            cancelled = true
        }
    }, [plants, weekIso, form, rmiLoading, aiAnalysis, runAnalysis])

    const regenerate = useCallback(async () => {
        setAiAnalysis(null)
        setAiLoading(true)
        setAiError(false)
        await runAnalysis()
        setAiLoading(false)
    }, [runAnalysis])

    return { aiAnalysis, aiError, aiLoading, getLastWeekValue, regenerate }
}
