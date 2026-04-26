import React, { useEffect, useRef, useState } from 'react'

import ConfirmationModal from '../../../app/components/reports/ConfirmationModal'
import ErrorModal from '../../../app/components/reports/ErrorModal'
import OperatorExclusionReasonModal from '../../../app/components/reports/OperatorExclusionReasonModal'
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
import { PlantManagerSubmitPlugin } from './types/WeeklyPlantManagerReport'
import { QualityControlManagerSubmitPlugin } from './types/WeeklyQualityControlManagerReport'
import { ReadyMixInstructorSubmitPlugin } from './types/WeeklyReadyMixInstructorReport'
import { SafetyManagerSubmitPlugin } from './types/WeeklySafetyManagerReport'
/** Maps report type keys to their submit-mode plugin components. */
const PLUGINS = {
    aggregate_production: AggregateProductionSubmitPlugin,
    district_manager: DistrictManagerSubmitPlugin,
    general_manager: GeneralManagerSubmitPlugin,
    plant_manager: PlantManagerSubmitPlugin,
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
        fetchHoursReceived,
        fetchOperatorsAndMixers,
        forcedReportDate,
        hoursReceivedFromOtherPlants,
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
        lost,
        lostGrade,
        lostLabel,
        removeOperatorRow,
        reportDateVerbose,
        setCarouselIndex,
        setForm,
        setHasUnsavedChanges,
        setInitialFormSnapshot,
        yph,
        yphGrade,
        yphLabel
    } = useSubmitForm({
        forcedReportDate,
        hoursReceivedFromOtherPlants,
        initialData,
        operatorOptions,
        plants,
        report,
        user
    })
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
            setAiValidating(true)
            setAiValidationProgress({ current: 0, total: 1 })
            try {
                const { AIService } = await import('../../../services/AIService')
                const validation = await AIService.validatePlantManagerMetrics(form)
                setAiValidating(false)
                if (validation.error) {
                    ErrorReporterUtility.reportError(new Error('AI validation failed for plant manager report'), {
                        context: `validatePlantManagerMetrics returned error — yardage: ${form.yardage}, total_hours: ${form.total_hours}`
                    })
                } else if (validation.needsReview) {
                    showError(
                        'AI analysis flagged a potential data entry issue — please double-check your yardage and total hours before confirming.'
                    )
                }
            } catch (error) {
                setAiValidating(false)
                ErrorReporterUtility.reportError(error instanceof Error ? error : new Error(String(error)), {
                    context: 'Unexpected error during AI validation of plant manager report'
                })
            }
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
                const v = await ReportUtility.validatePlantProduction(form, operatorOptions)
                setAiValidating(false)
                if (v) return showError(v)
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
    useEffect(() => {
        if (report.name === 'plant_manager') fetchHoursReceived(form.plant || user?.plant_code, report.weekIso)
    }, [report.name, report.weekIso, user?.plant_code, form.plant, fetchHoursReceived])
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
                <div
                    className="flex h-6 w-6 items-center justify-center rounded shrink-0"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                    <i className="fas fa-stopwatch text-[11px]" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                        Production
                    </div>
                    <div className="text-[12.5px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                        Operator Timing Entry
                    </div>
                    <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        Enter punch + load timing for each active operator. Carousel below cycles between operators.
                    </div>
                </div>
            </div>

            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                <div
                    className="flex flex-col gap-1.5 rounded p-2.5"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                >
                    <label className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                        Plant
                        <span className="ml-0.5" style={{ color: '#dc2626' }}>
                            *
                        </span>
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
                <div
                    className="flex flex-col gap-1.5 rounded p-2.5"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                >
                    <label className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                        Report Date
                        <span className="ml-0.5" style={{ color: '#dc2626' }}>
                            *
                        </span>
                    </label>
                    <input
                        type="date"
                        value={form.report_date ?? ''}
                        required
                        disabled
                        className={FORM_FIELD_BASE_CLASS}
                        style={FORM_FIELD_STYLE}
                    />
                    <div className="text-[10.5px]" style={{ color: 'var(--text-tertiary)' }}>
                        Next report {ReportUtility.formatDate(nextForcedReportDate)}
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <label className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                    Operators
                </label>

                {!form.plant && (
                    <div
                        className="flex items-center gap-2 rounded p-2.5 text-[12px]"
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px dashed var(--border-medium)',
                            color: 'var(--text-tertiary)'
                        }}
                    >
                        <i className="fas fa-circle-notch fa-spin text-[11px]" />
                        Loading plant assignment…
                    </div>
                )}
                {form.plant && !form.rows?.length && !excludedOperators.length && (
                    <div
                        className="flex items-center gap-2 rounded p-2.5 text-[12px]"
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px dashed var(--border-medium)',
                            color: 'var(--text-tertiary)'
                        }}
                    >
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
                                        className="inline-flex items-center justify-center rounded text-[11.5px] font-bold cursor-pointer border-none tabular-nums"
                                        style={{
                                            background: active ? accentColor : 'var(--bg-secondary)',
                                            border: `1px solid ${active ? accentColor : 'var(--border-light)'}`,
                                            color: active ? '#fff' : 'var(--text-secondary)',
                                            height: 26,
                                            minWidth: 26,
                                            padding: '0 8px'
                                        }}
                                    >
                                        {idx + 1}
                                    </button>
                                )
                            })}
                        </div>
                        <div
                            className="rounded p-3"
                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                        >
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
                            <div
                                className="flex items-center justify-between gap-2 mt-3 pt-2.5 flex-wrap"
                                style={{ borderTop: '1px solid var(--border-light)' }}
                            >
                                <button
                                    type="button"
                                    onClick={() => removeOperatorRow(carouselIndex)}
                                    className="inline-flex items-center gap-1.5 rounded text-[11.5px] font-semibold uppercase tracking-wider px-2.5 py-1.5 cursor-pointer border-none"
                                    style={{
                                        background: 'rgba(220, 38, 38, 0.1)',
                                        border: '1px solid rgba(220, 38, 38, 0.3)',
                                        color: '#b91c1c'
                                    }}
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
                                    <span
                                        className="text-[11.5px] tabular-nums"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        Operator <b style={{ color: 'var(--text-primary)' }}>{carouselIndex + 1}</b> of{' '}
                                        <b style={{ color: 'var(--text-primary)' }}>{form.rows.length}</b>
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
                                        className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11.5px] font-semibold cursor-pointer border-none"
                                        style={{
                                            background: 'rgba(14, 165, 233, 0.12)',
                                            border: '1px solid rgba(14, 165, 233, 0.35)',
                                            color: '#0369a1'
                                        }}
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
                <div
                    className="flex h-6 w-6 items-center justify-center rounded shrink-0"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                    <i className="fas fa-clipboard-list text-[11px]" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                        Production
                    </div>
                    <div className="text-[12.5px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                        Weekly Production Data
                    </div>
                    <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
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
                            className="flex flex-col gap-1.5 rounded p-2.5"
                            style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-light)'
                            }}
                        >
                            <label className="flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
                                <i
                                    className={`fas ${getFieldIcon(field.name)} text-[10px]`}
                                    style={{ color: accentColor }}
                                />
                                <span className={FORM_SECTION_LABEL_CLASS}>
                                    {field.name === 'yardage' ? 'Total Yardage' : field.label}
                                    {field.required && (
                                        <span className="ml-0.5" style={{ color: '#dc2626' }}>
                                            *
                                        </span>
                                    )}
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
                        className="flex flex-col gap-1.5 rounded p-2.5"
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-light)'
                        }}
                    >
                        <label className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                            {field.name === 'yardage' ? 'Total Yardage' : field.label}
                            {field.required && (
                                <span className="ml-0.5" style={{ color: '#dc2626' }}>
                                    *
                                </span>
                            )}
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
                    <div
                        className="rounded p-3"
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                    >
                        {renderFormSection()}
                    </div>
                )}
                {PluginComponent && (
                    <PluginComponent
                        form={form}
                        yph={yph}
                        yphGrade={yphGrade}
                        yphLabel={yphLabel}
                        lost={lost}
                        lostGrade={lostGrade}
                        lostLabel={lostLabel}
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
            {showErrorModal && error && <ErrorModal error={error} onClose={() => setShowErrorModal(false)} />}
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
            {aiValidating && (
                <AIValidatingModal progress={aiValidationProgress} reportName={report.name} accentColor={accentColor} />
            )}
        </div>
    )
}
const AIValidatingModal = ({ progress, reportName, accentColor }) => (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-4">
        <div className="bg-white rounded p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 flex items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-amber-200 border-3 border-amber-500 text-amber-500 text-2xl animate-spin">
                    <i className="fas fa-robot"></i>
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-bold m-0 mb-1" style={{ color: accentColor }}>
                        AI Validation in Progress
                    </h2>
                    <p className="text-slate-500 text-sm m-0">Analyzing efficiency report comments...</p>
                </div>
            </div>
            <div className="bg-slate-50 border border-border-light rounded-lg mb-4 p-4">
                <div className="flex items-center gap-3 mb-3">
                    <i className="fas fa-clipboard-check text-amber-500 text-lg"></i>
                    <span className="text-gray-700 text-sm font-semibold">
                        Validating operator explanations for timing issues
                    </span>
                </div>
                {progress.total > 0 && (
                    <div>
                        <div className="text-slate-500 text-xs mb-2">
                            Checking {progress.total} operator{progress.total !== 1 ? 's' : ''} with performance issues
                        </div>
                        <div className="bg-slate-200 rounded-lg h-2 overflow-hidden w-full">
                            <div
                                className="bg-gradient-to-r from-amber-500 to-amber-400 h-full transition-all duration-300"
                                style={{
                                    width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%'
                                }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>
            <div className="bg-gradient-to-br from-amber-100 to-amber-200 border border-amber-300 border-l-4 border-l-amber-500 rounded-md text-amber-800 text-xs p-3">
                <div className="flex gap-2">
                    <i className="fas fa-info-circle text-amber-500 flex-shrink-0 mt-0.5"></i>
                    <div>
                        {reportName === 'plant_manager'
                            ? 'AI is checking if your hours, yardage, lost yardage, and resold yardage values make sense together. This helps catch data entry errors.'
                            : 'AI is ensuring all comments provide specific explanations for delayed starts, delayed washouts, low loads, or excessive hours.'}
                    </div>
                </div>
            </div>
        </div>
    </div>
)
export default ReportsSubmitView
