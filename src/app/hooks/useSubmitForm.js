import { useCallback, useEffect, useMemo, useState } from 'react'

import { ReportUtility } from '../../utils/ReportUtility'

/* Yardage / YPH / lost-yardage have moved off the Plant Manager Report
 * onto the Plan tab's Help & Cross-Loading view, which derives them
 * from live dispatch tickets instead of self-reported entries. This
 * hook no longer exposes those fields — every consumer was updated to
 * stop reading them. */

/**
 * Manages report form state, validation, AI-powered metric validation,
 * and field-level change handlers for the report submission wizard.
 */
export function useSubmitForm({ report, initialData, user, forcedReportDate, plants, operatorOptions }) {
    const [form, setForm] = useState(() => {
        if (initialData) {
            if (initialData.data) {
                return {
                    ...Object.fromEntries(report.fields.map((f) => [f.name, f.type === 'table' ? [] : ''])),
                    ...initialData.data,
                    ...(initialData.rows ? { rows: initialData.rows } : {})
                }
            }
            return {
                ...Object.fromEntries(report.fields.map((f) => [f.name, f.type === 'table' ? [] : ''])),
                ...initialData
            }
        }
        return Object.fromEntries(report.fields.map((f) => [f.name, f.type === 'table' ? [] : '']))
    })
    const [excludedOperators, setExcludedOperators] = useState([])
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [initialFormSnapshot, setInitialFormSnapshot] = useState(null)
    const [carouselIndex, setCarouselIndex] = useState(0)
    const plantCode = useMemo(() => {
        if (form.plant) return form.plant
        if (Array.isArray(form.rows) && form.rows.length > 0) return form.rows[0].plant_code || ''
        return ''
    }, [form.plant, form.rows])
    const reportDateVerbose = form.report_date ? ReportUtility.formatVerboseDate(form.report_date) : ''
    const handleChange = useCallback(
        (e, name, idx, colName) => {
            if (report.name === 'plant_production' && name === 'rows') {
                if (colName === 'name' || colName === 'truck_number') return
                setForm((f) => {
                    const updatedRows = [...(f.rows || [])]
                    updatedRows[idx][colName] = e.target.value
                    return { ...f, rows: updatedRows }
                })
                return
            }
            if (report.name === 'general_manager' && name.startsWith('plant_field_')) {
                setForm((f) => ({ ...f, [name]: e.target.value }))
                return
            }
            const value = e.target.value
            setForm((f) => ({ ...f, [name]: value }))
        },
        [report.name]
    )
    useEffect(() => {
        if (initialData) {
            if (initialData.data) {
                setForm({
                    ...Object.fromEntries(report.fields.map((f) => [f.name, f.type === 'table' ? [] : ''])),
                    ...initialData.data,
                    ...(initialData.rows ? { rows: initialData.rows } : {})
                })
            } else {
                setForm({
                    ...Object.fromEntries(report.fields.map((f) => [f.name, f.type === 'table' ? [] : ''])),
                    ...initialData
                })
            }
        }
    }, [initialData, report.fields])
    useEffect(() => {
        if (report.name === 'plant_production' && !form.plant && user && plants.length > 0) {
            const userPlant =
                user?.plant_code && plants.some((p) => p.plant_code === user.plant_code)
                    ? user.plant_code
                    : plants[0]?.plant_code || ''
            setForm((f) => ({ ...f, plant: userPlant }))
        }
    }, [report.name, form.plant, user, plants])
    useEffect(() => {
        if (report.name === 'plant_manager' && user && user.plant_code) {
            setForm((f) => ({ ...f, plant: user.plant_code }))
        }
    }, [report.name, user])
    useEffect(() => {
        if (report.name === 'plant_production' && forcedReportDate) {
            setForm((f) => ({ ...f, report_date: forcedReportDate }))
        }
    }, [report.name, forcedReportDate])
    useEffect(() => {
        if (report.name === 'plant_production' && Array.isArray(form.rows) && Array.isArray(operatorOptions)) {
            const excluded = ReportUtility.getExcludedOperators(form.rows, operatorOptions)
            setExcludedOperators(excluded)
        }
    }, [form.rows, operatorOptions, report.name])
    useEffect(() => {
        if (
            report.name !== 'plant_production' ||
            (report.name === 'plant_production' &&
                plants.length > 0 &&
                operatorOptions.length > 0 &&
                Array.isArray(form.rows))
        ) {
            if (initialFormSnapshot === null) {
                setInitialFormSnapshot(JSON.stringify(form))
            }
        }
    }, [report.name, plants, operatorOptions, form.rows, initialFormSnapshot, form])
    useEffect(() => {
        if (initialFormSnapshot !== null) {
            setHasUnsavedChanges(JSON.stringify(form) !== initialFormSnapshot)
        }
    }, [form, initialFormSnapshot])
    const addOperatorRow = useCallback(
        (operatorId, mixers) => {
            if (!operatorId) return
            const mixer = mixers.find((m) => m.assigned_operator === operatorId)
            const newRow = {
                comments: '',
                eod_in_yard: '',
                first_load: '',
                loads: '',
                name: operatorId,
                punch_out: '',
                start_time: '',
                truck_number: mixer?.truck_number || ''
            }
            setForm((f) => {
                const rows = [...(f.rows || []), newRow]
                return { ...f, rows }
            })
            setCarouselIndex(form.rows ? form.rows.length : 0)
        },
        [form.rows]
    )
    const removeOperatorRow = useCallback((idx) => {
        setForm((f) => {
            const rows = [...(f.rows || [])]
            rows.splice(idx, 1)
            return { ...f, rows }
        })
        setCarouselIndex((prev) => Math.max(0, prev - 1))
    }, [])
    const initializeRows = useCallback((activeOperators, mixers) => {
        const rows = activeOperators.map((op) => {
            const mixer = mixers.find((m) => m.assigned_operator === op.employee_id)
            return {
                comments: '',
                eod_in_yard: '',
                first_load: '',
                loads: '',
                name: op.employee_id,
                punch_out: '',
                start_time: '',
                truck_number: mixer?.truck_number || ''
            }
        })
        setForm((f) => ({ ...f, rows }))
        setCarouselIndex(0)
    }, [])
    const clearRows = useCallback(() => {
        setForm((f) => ({ ...f, rows: [] }))
    }, [])
    return {
        addOperatorRow,
        carouselIndex,
        clearRows,
        excludedOperators,
        form,
        handleChange,
        hasUnsavedChanges,
        initializeRows,
        plantCode,
        removeOperatorRow,
        reportDateVerbose,
        setCarouselIndex,
        setForm,
        setHasUnsavedChanges,
        setInitialFormSnapshot
    }
}
