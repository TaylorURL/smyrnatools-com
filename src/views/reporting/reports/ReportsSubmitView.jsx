/* eslint-disable max-lines, react/forbid-dom-props */
import React, { useEffect, useRef, useState } from 'react'

import ConfirmationModal from '../../../app/components/reports/ConfirmationModal'
import OperatorExclusionReasonModal from '../../../app/components/reports/OperatorExclusionReasonModal'
import ReportValidationErrorModal from '../../../app/components/reports/ReportValidationErrorModal'
import SubmitHeader from '../../../app/components/reports/SubmitHeader'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useSubmitData } from '../../../app/hooks/useSubmitData'
import { useSubmitForm } from '../../../app/hooks/useSubmitForm'
import ErrorReporterUtility from '../../../utils/ErrorReporterUtility'
import { exportGeneralManagerReport } from '../../../utils/ExportUtility'
import { ReportUtility } from '../../../utils/ReportUtility'
import { AggregateProductionSubmitPlugin } from './types/WeeklyAggregateProductionReport'
import { DistrictManagerSubmitPlugin } from './types/WeeklyDistrictManagerReport'
import { EfficiencySubmitPlugin } from './types/WeeklyEfficiencyReport'
import { GeneralManagerSubmitPlugin } from './types/WeeklyGeneralManagerReport'
import { QualityControlManagerSubmitPlugin } from './types/WeeklyQualityControlManagerReport'
import { ReadyMixInstructorSubmitPlugin } from './types/WeeklyReadyMixInstructorReport'
import { SafetyManagerSubmitPlugin } from './types/WeeklySafetyManagerReport'

/** Pre-submit AI validation gets a hard 15s budget. If the AI service
 *  hangs or rejects, we log the failure and let the user submit anyway —
 *  blocking submission on an external service that isn't responding is
 *  worse than letting a borderline comment through. */
const AI_VALIDATION_TIMEOUT_MS = 15000
const AI_VALIDATION_TIMEOUT = Symbol('ai-validation-timeout')

/** Races `promise` against `AI_VALIDATION_TIMEOUT_MS`. On timeout, logs a
 *  console error tagged with `label` and resolves `{ timedOut: true }`.
 *  Caller is responsible for falling through to submit on timeout. */
async function raceAiValidation(promise, label) {
    let timer
    const result = await Promise.race([
        promise,
        new Promise((resolve) => {
            timer = setTimeout(() => resolve(AI_VALIDATION_TIMEOUT), AI_VALIDATION_TIMEOUT_MS)
        })
    ])
    clearTimeout(timer)
    if (result === AI_VALIDATION_TIMEOUT) {
        console.error(
            `[${label}] AI validation did not complete within ${AI_VALIDATION_TIMEOUT_MS / 1000}s — bypassing and proceeding with submit.`
        )
        return { timedOut: true, value: null }
    }
    return { timedOut: false, value: result }
}

/** Maps report type keys to their submit-mode plugin components. */
const PLUGINS = {
    aggregate_production: AggregateProductionSubmitPlugin,
    district_manager: DistrictManagerSubmitPlugin,
    general_manager: GeneralManagerSubmitPlugin,
    plant_production: EfficiencySubmitPlugin,
    quality_control_manager: QualityControlManagerSubmitPlugin,
    ready_mix_instructor: ReadyMixInstructorSubmitPlugin,
    safety_environmental_rep: SafetyManagerSubmitPlugin,
    safety_manager: SafetyManagerSubmitPlugin
}
const EXCLUDED_REPORT_TYPES = [
    'district_manager',
    'general_manager',
    'aggregate_production',
    'quality_control_manager',
    'safety_manager',
    'safety_environmental_rep'
]
const GM_REQUIRED_FIELD_SUFFIXES = [
    'active_operators',
    'runnable_trucks',
    'down_trucks',
    'operators_starting',
    'new_operators_training',
    'operators_leaving',
    'total_yardage',
    'total_hours'
]
const validateSafetyManager = (form) => {
    const issues = Array.isArray(form.issues) ? form.issues : []
    return issues.some((i) => !i.description || !i.plant || !i.tag)
        ? 'All issues must have a description, plant, and tag.'
        : null
}
const validateRequiredFields = (form, fields) => {
    for (const field of fields) {
        const val = form[field.name]
        if (
            field.required &&
            (val === undefined || val === null || val === '' || (Array.isArray(val) && !val.length))
        ) {
            return 'Please fill out all required fields before submitting.'
        }
    }
    return null
}
const validateGMFields = (form, plants) => {
    if (!plants.length) return null
    for (const plant of plants) {
        for (const suffix of GM_REQUIRED_FIELD_SUFFIXES) {
            const val = form[`${suffix}_${plant.plant_code}`]
            if (val === undefined || val === null || val === '') {
                return 'Please fill out all required fields before submitting.'
            }
        }
    }
    return null
}
const getEditingUserName = (managerEditUser, userProfiles) => {
    if (!managerEditUser) return ''
    const profile = userProfiles?.[managerEditUser]
    return profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : managerEditUser.slice(0, 8)
}
const getFieldIcon = (fieldName) => {
    const iconMap = { total_hours: 'fa-clock', yardage: 'fa-box' }
    return iconMap[fieldName] || 'fa-recycle'
}
/**
 * Generic report submission form. Delegates rendering to a type-specific
 * plugin component (e.g. EfficiencySubmitPlugin, PlantManagerSubmitPlugin).
 * Handles validation, draft auto-save, GM multi-plant field requirements,
 * operator exclusion reasons, and manager-on-behalf-of editing.
 */
function ReportsSubmitView({
    report,
    initialData,
    onBack,
    onSubmit,
    user,
    readOnly,
    allReports,
    managerEditUser,
    userProfiles
}) {
    const isGM = report?.name === 'general_manager' || /general manager/i.test(report?.title || '')
    const PluginComponent = PLUGINS[report.name]
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'
    const {
        fetchOperatorsAndMixers,
        forcedReportDate,
        isCompleted,
        loadingPlants,
        maintenanceItems,
        mixers,
        nextForcedReportDate,
        operatorOptions,
        plants,
        targetUserId,
        userPlantCode,
        weekVerbose
    } = useSubmitData({ initialData, managerEditUser, report, user })
    const {
        addOperatorRow,
        carouselIndex,
        clearRows,
        excludedOperators,
        form,
        handleChange,
        hasUnsavedChanges,
        initializeRows,
        removeOperatorRow,
        reportDateVerbose,
        setCarouselIndex,
        setForm,
        setHasUnsavedChanges,
        setInitialFormSnapshot
    } = useSubmitForm({ forcedReportDate, initialData, operatorOptions, plants, report, user })
    const [submitting, setSubmitting] = useState(false)
    const [savingDraft, setSavingDraft] = useState(false)
    const [aiValidating, setAiValidating] = useState(false)
    const [aiValidationProgress, setAiValidationProgress] = useState({ current: 0, total: 0 })
    const [error, setError] = useState('')
    const [showErrorModal, setShowErrorModal] = useState(false)
    const [success, setSuccess] = useState(false)
    const [summaryTab, setSummaryTab] = useState('summary')
    const [saveMessage, setSaveMessage] = useState('')
    const [showConfirmationModal, setShowConfirmationModal] = useState(false)
    const [confirmationChecks, setConfirmationChecks] = useState([false, false])
    const [exporting, setExporting] = useState(false)
    const [exportError, setExportError] = useState('')
    const [showExclusionReasonModal, setShowExclusionReasonModal] = useState(false)
    const rowsInitializedRef = useRef(false)
    const hasInitializedExclusionCheckRef = useRef(false)
    const showError = (msg) => {
        setError(msg)
        setShowErrorModal(true)
    }
    const clearMessages = () => {
        setError('')
        setShowErrorModal(false)
        setSuccess(false)
    }
    // Show exclusion reason modal immediately when the last operator is excluded
    useEffect(() => {
        if (report.name !== 'plant_production') return
        if (!hasInitializedExclusionCheckRef.current) {
            if (operatorOptions.length > 0) hasInitializedExclusionCheckRef.current = true
            return
        }
        const allExcluded = excludedOperators.length === operatorOptions.length && operatorOptions.length > 0
        if (allExcluded && !form.operator_exclusion_reason) {
            setShowExclusionReasonModal(true)
        }
        // Clear the stored reason when operators are re-included
        if (!allExcluded && form.operator_exclusion_reason) {
            setForm((f) => {
                const { operator_exclusion_reason: _, ...rest } = f
                return rest
            })
        }
    }, [excludedOperators, operatorOptions, report.name, form.operator_exclusion_reason, setForm])
    const editingUserName = getEditingUserName(managerEditUser, userProfiles)
    const handleSubmit = async (e) => {
        e.preventDefault()
        clearMessages()
        if (report.name === 'plant_manager') {
            /* AI validation removed — it only checked the yardage ÷ hours
             * ratio, and yardage no longer lives on this report (lives on
             * the Plan Help & Cross-Loading view instead). The hours
             * acknowledgment checkbox in `ConfirmationModal` is still
             * the last gate before submission. */
            const err = validateRequiredFields(form, report.fields)
            if (err) return showError(err)
            setShowConfirmationModal(true)
            return
        }
        if (report.name === 'safety_manager' || report.name === 'safety_environmental_rep') {
            const err = validateSafetyManager(form)
            if (err) return showError(err)
        }
        if (report.name !== 'general_manager') {
            const err = validateRequiredFields(form, report.fields)
            if (err) return showError(err)
        } else {
            const err = validateGMFields(form, plants)
            if (err) return showError(err)
        }
        if (report.name === 'plant_production') {
            const allExcluded = excludedOperators.length === operatorOptions.length && operatorOptions.length > 0
            if (allExcluded && !form.operator_exclusion_reason) {
                setShowExclusionReasonModal(true)
                return
            }
            if (!allExcluded) {
                setAiValidating(true)
                setAiValidationProgress({ current: 0, total: 0 })
                /* Hard 15s budget — beyond that we bypass and let the user
                 * submit, logging to console + Sentry. Blocking submission
                 * on an unresponsive external service is worse than letting
                 * the occasional borderline comment through. The try/finally
                 * guarantees the modal closes on every path (success,
                 * timeout, thrown error). */
                try {
                    const raceResult = await raceAiValidation(
                        ReportUtility.validatePlantProduction(form, operatorOptions, {
                            onProgress: ({ current, total }) => setAiValidationProgress({ current, total })
                        }),
                        'plant_production'
                    )
                    if (!raceResult.timedOut && raceResult.value) return showError(raceResult.value)
                } catch (err) {
                    console.error('[plant_production] AI validation threw — bypassing:', err)
                    ErrorReporterUtility.reportError(err instanceof Error ? err : new Error(String(err)), {
                        context: 'Unexpected error during AI validation of plant_production report'
                    })
                } finally {
                    setAiValidating(false)
                }
            }
        }
        setSubmitting(true)
        try {
            await onSubmit(form, 'submit')
            setSuccess(true)
        } catch (err) {
            showError(err?.message || 'Error submitting report')
        }
        setSubmitting(false)
    }
    const handleConfirmedSubmit = async () => {
        setShowConfirmationModal(false)
        setSubmitting(true)
        clearMessages()
        try {
            const submitData = { ...form }
            if (report.name === 'plant_manager' && user?.plant_code && !submitData.plant)
                submitData.plant = user.plant_code
            await onSubmit(submitData, 'submit')
            setSuccess(true)
        } catch (err) {
            showError(err?.message || 'Error submitting report')
        }
        setSubmitting(false)
    }
    const handleExclusionReasonConfirm = (reason) => {
        setShowExclusionReasonModal(false)
        setForm((f) => ({ ...f, operator_exclusion_reason: reason }))
    }
    const handleSaveDraft = async (e) => {
        e.preventDefault()
        clearMessages()
        setSaveMessage('')
        setSavingDraft(true)
        try {
            await onSubmit(form, 'draft')
            setSaveMessage('Changes saved.')
            setInitialFormSnapshot(JSON.stringify(form))
            setHasUnsavedChanges(false)
        } catch (err) {
            showError(err?.message || 'Error saving draft')
        }
        setSavingDraft(false)
    }
    const handleBackClick = () => {
        if (hasUnsavedChanges) {
            handleSaveDraft({ preventDefault: () => {} })
            setTimeout(onBack, 800)
        } else {
            onBack()
        }
    }
    const handleExport = async () => {
        if (exporting || loadingPlants || !plants.length) return
        setExportError('')
        setExporting(true)
        try {
            await exportGeneralManagerReport({ form, plants, weekIso: report.weekIso })
        } catch (e) {
            setExportError(e?.message || 'Export failed')
        }
        setExporting(false)
    }
    useEffect(() => {
        if (report.name !== 'plant_production') return
        if (!form.plant) {
            clearRows()
            rowsInitializedRef.current = false
            return
        }
        fetchOperatorsAndMixers(form.plant).then((result) => {
            if (!readOnly && !initialData?.rows?.length && !form.rows?.length && !rowsInitializedRef.current) {
                initializeRows(result.activeOperators, result.mixers)
                rowsInitializedRef.current = true
            }
            if (form.rows?.length > 0) {
                rowsInitializedRef.current = true
            }
        })
    }, [report.name, form.plant, readOnly, initialData, clearRows, fetchOperatorsAndMixers, initializeRows, form.rows])
    /* Plan-tab style for the form-fields card. CSS custom properties so the
     * card adapts to dark mode, compact 12px inputs, and the `SECTION_LABEL`
     * pattern used by the redesigned report sections. */
    const FORM_SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
    const FORM_FIELD_BASE_CLASS =
        'w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none box-border disabled:opacity-90'
    const FORM_FIELD_STYLE = {
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-light)',
        color: 'var(--text-primary)'
    }
    const renderPlantProductionForm = () => (
        <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary text-text-secondary">
                    <i className="fas fa-stopwatch text-[11px]" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                        Production
                    </div>
                    <div className="text-[12.5px] font-semibold leading-tight text-text-primary">
                        Operator Timing Entry
                    </div>
                    <div className="text-[10.5px] mt-0.5 text-text-tertiary">
                        Enter punch + load timing for each active operator. Carousel below cycles between operators.
                    </div>
                </div>
            </div>

            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5 rounded p-2.5 bg-bg-secondary border border-border-light">
                    <label className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                        Plant
                        <span className="ml-0.5 text-red-600">*</span>
                    </label>
                    <select
                        value={form.plant ?? ''}
                        onChange={(e) => {
                            setForm((f) => ({ ...f, plant: e.target.value, rows: [] }))
                            setCarouselIndex(0)
                        }}
                        required
                        disabled={readOnly}
                        className={`${FORM_FIELD_BASE_CLASS} appearance-none cursor-pointer pr-8`}
                        style={FORM_FIELD_STYLE}
                    >
                        <option value="">Select Plant…</option>
                        {plants.map((p) => (
                            <option key={p.plant_code} value={p.plant_code}>
                                {p.plant_name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1.5 rounded p-2.5 bg-bg-secondary border border-border-light">
                    <label className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                        Report Date
                        <span className="ml-0.5 text-red-600">*</span>
                    </label>
                    <input
                        type="date"
                        value={form.report_date ?? ''}
                        required
                        disabled
                        className={FORM_FIELD_BASE_CLASS}
                        style={FORM_FIELD_STYLE}
                    />
                    <div className="text-[10.5px] text-text-tertiary">
                        Next report {ReportUtility.formatDate(nextForcedReportDate)}
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                    Operators
                </label>

                {!form.plant && (
                    <div className="flex items-center gap-2 rounded p-2.5 text-[12px] bg-bg-secondary border border-border-medium text-text-tertiary">
                        <i className="fas fa-circle-notch fa-spin text-[11px]" />
                        Loading plant assignment…
                    </div>
                )}
                {form.plant && !form.rows?.length && !excludedOperators.length && (
                    <div className="flex items-center gap-2 rounded p-2.5 text-[12px] bg-bg-secondary border border-border-medium text-text-tertiary">
                        <i className="fas fa-info-circle text-[11px]" />
                        No active operators for this plant.
                    </div>
                )}

                {form.rows?.length > 0 && (
                    <>
                        <div className="flex flex-wrap gap-1">
                            {form.rows.map((_, idx) => {
                                const active = idx === carouselIndex
                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setCarouselIndex(idx)}
                                        className="inline-flex items-center justify-center rounded text-[11.5px] font-bold cursor-pointer border-none tabular-nums h-[26px]"
                                        style={{
                                            background: active ? accentColor : 'var(--bg-secondary)',
                                            border: `1px solid ${active ? accentColor : 'var(--border-light)'}`,
                                            color: active ? '#fff' : 'var(--text-secondary)',
                                            minWidth: 26,
                                            padding: '0 8px'
                                        }}
                                    >
                                        {idx + 1}
                                    </button>
                                )
                            })}
                        </div>
                        <div className="rounded p-3 bg-bg-secondary border border-border-light">
                            {form.rows[carouselIndex] && (
                                <div className="flex flex-col gap-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
                                        <div className="flex flex-col gap-1">
                                            <label
                                                className={FORM_SECTION_LABEL_CLASS}
                                                style={{ color: 'var(--text-tertiary)' }}
                                            >
                                                Name
                                            </label>
                                            <input
                                                type="text"
                                                value={
                                                    operatorOptions.find(
                                                        (opt) => opt.value === form.rows[carouselIndex]?.name
                                                    )?.label ?? ''
                                                }
                                                disabled
                                                className={FORM_FIELD_BASE_CLASS}
                                                style={FORM_FIELD_STYLE}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label
                                                className={FORM_SECTION_LABEL_CLASS}
                                                style={{ color: 'var(--text-tertiary)' }}
                                            >
                                                Truck #
                                            </label>
                                            <input
                                                type="text"
                                                value={
                                                    ReportUtility.getTruckNumberForOperator(
                                                        form.rows[carouselIndex],
                                                        mixers
                                                    ) ?? ''
                                                }
                                                disabled
                                                className={`${FORM_FIELD_BASE_CLASS} tabular-nums`}
                                                style={FORM_FIELD_STYLE}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {[
                                            { field: 'start_time', label: 'Start Time' },
                                            { field: 'first_load', label: '1st Load' },
                                            { field: 'eod_in_yard', label: 'EOD In Yard' },
                                            { field: 'punch_out', label: 'Punch Out' }
                                        ].map(({ field, label }) => (
                                            <div key={field} className="flex flex-col gap-1">
                                                <label
                                                    className={FORM_SECTION_LABEL_CLASS}
                                                    style={{ color: 'var(--text-tertiary)' }}
                                                >
                                                    {label}
                                                </label>
                                                <input
                                                    type="time"
                                                    value={form.rows[carouselIndex]?.[field] ?? ''}
                                                    onChange={(e) => handleChange(e, 'rows', carouselIndex, field)}
                                                    disabled={!!readOnly}
                                                    className={`${FORM_FIELD_BASE_CLASS} tabular-nums`}
                                                    style={FORM_FIELD_STYLE}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
                                        <div className="flex flex-col gap-1">
                                            <label
                                                className={FORM_SECTION_LABEL_CLASS}
                                                style={{ color: 'var(--text-tertiary)' }}
                                            >
                                                Total Loads
                                            </label>
                                            <input
                                                type="number"
                                                value={form.rows[carouselIndex]?.loads ?? ''}
                                                onChange={(e) => handleChange(e, 'rows', carouselIndex, 'loads')}
                                                disabled={readOnly}
                                                className={`${FORM_FIELD_BASE_CLASS} tabular-nums`}
                                                style={FORM_FIELD_STYLE}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label
                                                className={FORM_SECTION_LABEL_CLASS}
                                                style={{ color: 'var(--text-tertiary)' }}
                                            >
                                                Comments
                                            </label>
                                            <input
                                                type="text"
                                                value={form.rows[carouselIndex]?.comments ?? ''}
                                                onChange={(e) => handleChange(e, 'rows', carouselIndex, 'comments')}
                                                disabled={readOnly}
                                                className={FORM_FIELD_BASE_CLASS}
                                                style={FORM_FIELD_STYLE}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 flex-wrap border-t border-border-light">
                                <button
                                    type="button"
                                    onClick={() => removeOperatorRow(carouselIndex)}
                                    className="inline-flex items-center gap-1.5 rounded text-[11.5px] font-semibold uppercase tracking-wider px-2.5 py-1.5 cursor-pointer border-none bg-[rgba(220,_38,_38,_0.1)] border border-[rgba(220,_38,_38,_0.3)] text-red-700"
                                >
                                    <i className="fas fa-user-minus text-[10px]" />
                                    Exclude
                                </button>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setCarouselIndex((i) => Math.max(i - 1, 0))}
                                        disabled={carouselIndex === 0}
                                        className="inline-flex items-center gap-1.5 rounded text-[11.5px] font-bold uppercase tracking-wider text-white px-2.5 py-1.5 cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed"
                                        style={{ background: accentColor }}
                                    >
                                        <i className="fas fa-arrow-left text-[10px]" />
                                        Prev
                                    </button>
                                    <span className="text-[11.5px] tabular-nums text-text-secondary">
                                        Operator <b className="text-text-primary">{carouselIndex + 1}</b> of{' '}
                                        <b className="text-text-primary">{form.rows.length}</b>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setCarouselIndex((i) => Math.min(i + 1, form.rows.length - 1))}
                                        disabled={carouselIndex === form.rows.length - 1}
                                        className="inline-flex items-center gap-1.5 rounded text-[11.5px] font-bold uppercase tracking-wider text-white px-2.5 py-1.5 cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed"
                                        style={{ background: accentColor }}
                                    >
                                        Next
                                        <i className="fas fa-arrow-right text-[10px]" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {excludedOperators.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-1">
                        <div className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                            Excluded Operators · click to re-include
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {excludedOperators.map((opId) => {
                                const op = operatorOptions.find((opt) => opt.value === opId)
                                return (
                                    <button
                                        key={opId}
                                        type="button"
                                        onClick={() => addOperatorRow(opId, mixers)}
                                        className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11.5px] font-semibold cursor-pointer border-none bg-[rgba(14,_165,_233,_0.12)] border border-[rgba(14,_165,_233,_0.35)] text-[#0369a1]"
                                    >
                                        <i className="fas fa-user-plus text-[10px]" />
                                        {op?.label || opId}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
    const renderPlantManagerForm = () => (
        <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary text-text-secondary">
                    <i className="fas fa-clipboard-list text-[11px]" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                        Production
                    </div>
                    <div className="text-[12.5px] font-semibold leading-tight text-text-primary">
                        Weekly Production Data
                    </div>
                    <div className="text-[10.5px] mt-0.5 text-text-tertiary">
                        Key production metrics for this reporting period.
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {report.fields
                    .filter((f) => f.name !== 'issues' && f.type !== 'table')
                    .map((field) => (
                        <div
                            key={field.name}
                            className="flex flex-col gap-1.5 rounded p-2.5 bg-bg-secondary border border-border-light"
                        >
                            <label className="flex items-center gap-1.5 text-text-tertiary">
                                <i
                                    className={`fas ${getFieldIcon(field.name)} text-[10px]`}
                                    style={{ color: accentColor }}
                                />
                                <span className={FORM_SECTION_LABEL_CLASS}>
                                    {field.name === 'yardage' ? 'Total Yardage' : field.label}
                                    {field.required && <span className="ml-0.5 text-red-600">*</span>}
                                </span>
                            </label>
                            {renderFieldInput(field, FORM_FIELD_BASE_CLASS)}
                        </div>
                    ))}
            </div>
        </div>
    )
    const renderFieldInput = (field, className = '') => {
        const value = form[field.name] ?? ''
        const baseClass = className || FORM_FIELD_BASE_CLASS
        const props = {
            className: baseClass,
            disabled: readOnly,
            onChange: (e) => handleChange(e, field.name),
            required: field.required,
            style: FORM_FIELD_STYLE,
            value
        }
        if (field.type === 'textarea')
            return <textarea {...props} className={`${baseClass} resize-y min-h-[88px]`} rows={4} />
        if (field.type === 'select')
            return (
                <select {...props} className={`${baseClass} appearance-none cursor-pointer pr-8`}>
                    <option value="">Select...</option>
                    {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                            {opt}
                        </option>
                    ))}
                </select>
            )
        return <input type={field.type} {...props} />
    }
    const renderDefaultForm = () => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {report.fields
                .filter((f) => f.name !== 'issues' && f.type !== 'table')
                .map((field) => (
                    <div
                        key={field.name}
                        className="flex flex-col gap-1.5 rounded p-2.5 bg-bg-secondary border border-border-light"
                    >
                        <label className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                            {field.name === 'yardage' ? 'Total Yardage' : field.label}
                            {field.required && <span className="ml-0.5 text-red-600">*</span>}
                        </label>
                        {renderFieldInput(field)}
                    </div>
                ))}
        </div>
    )
    const renderFormSection = () => {
        if (report.name === 'plant_production') return renderPlantProductionForm()
        if (report.name === 'plant_manager') return renderPlantManagerForm()
        if (!EXCLUDED_REPORT_TYPES.includes(report.name)) return renderDefaultForm()
        return null
    }
    return (
        <div className="bg-slate-50 min-h-screen w-full">
            <SubmitHeader
                report={report}
                weekVerbose={weekVerbose}
                reportDateVerbose={reportDateVerbose}
                isCompleted={isCompleted}
                readOnly={readOnly}
                isGM={isGM}
                exporting={exporting}
                loadingPlants={loadingPlants}
                exportError={exportError}
                managerEditUser={managerEditUser}
                editingUserName={editingUserName}
                formPlant={form.plant}
                onBack={handleBackClick}
                onExport={handleExport}
            />
            <form className="w-full px-3 py-4 sm:px-4 sm:py-6 md:px-6 flex flex-col gap-2.5" onSubmit={handleSubmit}>
                {!EXCLUDED_REPORT_TYPES.includes(report.name) && (
                    <div className="rounded p-3 bg-bg-primary border border-border-light">{renderFormSection()}</div>
                )}
                {PluginComponent && (
                    <PluginComponent
                        form={form}
                        summaryTab={summaryTab}
                        setSummaryTab={setSummaryTab}
                        maintenanceItems={maintenanceItems}
                        operatorOptions={operatorOptions}
                        setDebugMsg={() => {}}
                        allReports={report.name === 'general_manager' ? allReports : undefined}
                        weekIso={
                            [
                                'general_manager',
                                'aggregate_production',
                                'plant_manager',
                                'ready_mix_instructor',
                                'district_manager'
                            ].includes(report.name)
                                ? report.weekIso
                                : undefined
                        }
                        setForm={setForm}
                        plants={plants}
                        readOnly={readOnly}
                        user={user}
                        userId={targetUserId}
                        userPlantCode={userPlantCode}
                        onChange={handleChange}
                    />
                )}
                {success && (
                    <div className="bg-green-100 text-green-700 p-4 rounded-lg mx-4 my-4 text-sm font-medium">
                        Report submitted successfully.
                    </div>
                )}
                {saveMessage && (
                    <div className="bg-green-100 text-green-700 p-4 rounded-lg mx-4 my-4 text-sm font-medium">
                        {saveMessage}
                    </div>
                )}
                {!readOnly && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 sm:pt-6 border-t border-border-light mt-4 sm:mt-6">
                        <button
                            type="button"
                            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors order-3 sm:order-1"
                            onClick={handleBackClick}
                            disabled={submitting || savingDraft}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-sky-100 text-sky-700 rounded-lg text-sm font-semibold hover:bg-sky-200 transition-colors order-2"
                            onClick={handleSaveDraft}
                            disabled={submitting || savingDraft}
                        >
                            {savingDraft ? 'Saving...' : 'Save Changes'}
                        </button>
                        {!managerEditUser && (
                            <button
                                type="submit"
                                className="px-4 sm:px-6 py-2.5 sm:py-3 text-white rounded-lg text-sm font-semibold transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed order-1 sm:order-3"
                                style={{ background: accentColor }}
                                disabled={submitting || savingDraft}
                            >
                                {submitting
                                    ? report.name === 'plant_production'
                                        ? 'Validating...'
                                        : 'Submitting...'
                                    : 'Submit'}
                            </button>
                        )}
                    </div>
                )}
            </form>
            {showConfirmationModal && (
                <ConfirmationModal
                    confirmationChecks={confirmationChecks}
                    setConfirmationChecks={setConfirmationChecks}
                    onCancel={() => setShowConfirmationModal(false)}
                    onConfirm={handleConfirmedSubmit}
                />
            )}
            {showErrorModal && error && (
                <ReportValidationErrorModal error={error} onClose={() => setShowErrorModal(false)} />
            )}
            {showExclusionReasonModal && (
                <OperatorExclusionReasonModal
                    onConfirm={handleExclusionReasonConfirm}
                    onCancel={() => {
                        setShowExclusionReasonModal(false)
                        // Re-include the last excluded operator since they declined to give a reason
                        if (excludedOperators.length > 0) {
                            addOperatorRow(excludedOperators[excludedOperators.length - 1], mixers)
                        }
                    }}
                />
            )}
            {aiValidating && <AIValidatingModal progress={aiValidationProgress} accentColor={accentColor} />}
        </div>
    )
}

/** Pre-submit validation modal — single accent color, compact typography,
 *  no marketing copy. Progress bar fills as each operator's comment is
 *  checked; for the plant_manager path the row count is just 1 so the
 *  bar reads as a generic loader. */
const AIValidatingModal = ({ progress, accentColor }) => {
    const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4"
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <div
                className="w-full max-w-sm rounded-lg overflow-hidden bg-bg-primary border border-border-light"
                style={{ boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)' }}
            >
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border-light">
                    <div
                        className="flex h-9 w-9 items-center justify-center rounded shrink-0"
                        style={{ background: 'var(--bg-tertiary)' }}
                    >
                        <i
                            className="fas fa-circle-notch fa-spin text-[14px]"
                            style={{ color: accentColor }}
                            aria-hidden="true"
                        />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[13px] font-semibold leading-tight text-text-primary">
                            Validating report
                        </div>
                        <div className="text-[11px] mt-0.5 text-text-tertiary">Running pre-submission checks</div>
                    </div>
                </div>
                <div className="px-5 py-4">
                    {progress.total > 0 ? (
                        <>
                            <div className="flex items-center justify-between text-[11px] mb-2 text-text-tertiary tabular-nums">
                                <span>
                                    {progress.current} of {progress.total} operator
                                    {progress.total === 1 ? '' : 's'}
                                </span>
                                <span className="font-mono">{pct}%</span>
                            </div>
                            <div
                                className="h-1.5 w-full rounded-full overflow-hidden"
                                style={{ background: 'var(--bg-tertiary)' }}
                            >
                                <div
                                    className="h-full transition-all duration-300"
                                    style={{ background: accentColor, width: `${pct}%` }}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-2 text-[12px] text-text-tertiary">
                            <i className="fas fa-circle-notch fa-spin text-[10px]" aria-hidden="true" />
                            <span>Preparing…</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ReportsSubmitView
