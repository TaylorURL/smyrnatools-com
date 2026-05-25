/* eslint-disable react/forbid-dom-props */
import React, { useCallback, useEffect, useRef, useState } from 'react'

import ConfirmationModal from '../../../app/components/reports/ConfirmationModal'
import OperatorExclusionReasonModal from '../../../app/components/reports/OperatorExclusionReasonModal'
import ReportValidationErrorModal from '../../../app/components/reports/ReportValidationErrorModal'
import SubmitHeader from '../../../app/components/reports/SubmitHeader'
import { EXCLUDED_REPORT_TYPES, PLUGINS, WEEK_ISO_PLUGIN_REPORTS } from '../../../app/constants/reportsSubmitConstants'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useAutosaveDraft } from '../../../app/hooks/useAutosaveDraft'
import { useEfficiencyDayforcePunches } from '../../../app/hooks/useEfficiencyDayforcePunches'
import { useEfficiencyTicketAggregates } from '../../../app/hooks/useEfficiencyTicketAggregates'
import { usePlantEfficiencyAutofill } from '../../../app/hooks/usePlantEfficiencyAutofill'
import { useSubmitData } from '../../../app/hooks/useSubmitData'
import { useSubmitForm } from '../../../app/hooks/useSubmitForm'
import ErrorReporterUtility from '../../../utils/ErrorReporterUtility'
import { exportGeneralManagerReport } from '../../../utils/ExportUtility'
import { ReportUtility } from '../../../utils/ReportUtility'
import AIValidatingModal from './submit/AIValidatingModal'
import { raceAiValidation } from './submit/aiValidation'
import DefaultReportForm from './submit/DefaultReportForm'
import PlantManagerForm from './submit/PlantManagerForm'
import PlantProductionForm from './submit/PlantProductionForm'
import SubmitActions from './submit/SubmitActions'
import {
    getEditingUserName,
    validateGMFields,
    validateRequiredFields,
    validateSafetyManager
} from './submit/submitValidators'

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
        clearRows,
        excludedOperators,
        form,
        handleChange,
        hasUnsavedChanges,
        initializeRows,
        removeOperatorRow,
        reportDateVerbose,
        setForm,
        setHasUnsavedChanges,
        setInitialFormSnapshot,
        setRowField,
        setRowOverride
    } = useSubmitForm({ forcedReportDate, initialData, operatorOptions, plants, report, user })
    // Auto-fill `first_load` + `loads` on the Plant Efficiency Report from
    // live dispatch tickets for the SINGLE report day. Scope is one day,
    // not the week — the report represents one operational day's data,
    // and aggregating across the week would multiply the ticket counts.
    // The hook no-ops until the form has rows + operatorOptions + a valid
    // report_date so we don't burn fetches before the matching keys are
    // ready.
    const isPlantProduction = report.name === 'plant_production'
    const efficiencyTicketsEnabled =
        isPlantProduction && !!form.report_date && Array.isArray(form.rows) && form.rows.length > 0
    const {
        aggregatesByOperatorId: efficiencyAggregates,
        loading: efficiencyTicketsLoading,
        ready: efficiencyTicketsReady
    } = useEfficiencyTicketAggregates({
        enabled: efficiencyTicketsEnabled,
        operatorOptions,
        reportDate: form.report_date,
        rows: form.rows
    })
    // Dayforce shift punches → start_time + punch_out auto-fill (parallel
    // to tickets above). eod_in_yard stays manual — it's the truck-back-in-yard
    // time, distinct from the operator's clock-out.
    const {
        loading: dayforcePunchesLoading,
        punchesByOperatorId: dayforcePunches,
        ready: dayforcePunchesReady
    } = useEfficiencyDayforcePunches({
        enabled: efficiencyTicketsEnabled,
        operatorOptions,
        reportDate: form.report_date
    })
    usePlantEfficiencyAutofill({
        dayforcePunches,
        dayforcePunchesReady,
        efficiencyAggregates,
        efficiencyTicketsReady,
        isPlantProduction,
        setForm
    })
    // Debounced autosave. Writes the draft 1.2s after the last mutation
    // so a stream of keystrokes coalesces into one round-trip. Pauses
    // when the form is read-only, before the plant is picked, or before
    // any rows exist (otherwise the initial render's empty form would
    // immediately overwrite a draft that's still being hydrated).
    const autosaveOnSave = useCallback(
        async (payload) => {
            await onSubmit(payload, 'draft')
            setInitialFormSnapshot(JSON.stringify(payload))
            setHasUnsavedChanges(false)
        },
        [onSubmit, setHasUnsavedChanges, setInitialFormSnapshot]
    )
    const autosaveEnabled =
        !readOnly && !!form.plant && (report.name !== 'plant_production' || (form.rows?.length || 0) > 0)
    useAutosaveDraft({
        enabled: autosaveEnabled,
        form,
        onSave: autosaveOnSave
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
    const renderFormSection = () => {
        if (report.name === 'plant_production')
            return (
                <PlantProductionForm
                    accentColor={accentColor}
                    addOperatorRow={addOperatorRow}
                    dayforcePunches={dayforcePunches}
                    dayforcePunchesLoading={dayforcePunchesLoading}
                    dayforcePunchesReady={dayforcePunchesReady}
                    efficiencyAggregates={efficiencyAggregates}
                    efficiencyTicketsEnabled={efficiencyTicketsEnabled}
                    efficiencyTicketsLoading={efficiencyTicketsLoading}
                    efficiencyTicketsReady={efficiencyTicketsReady}
                    excludedOperators={excludedOperators}
                    form={form}
                    mixers={mixers}
                    nextForcedReportDate={nextForcedReportDate}
                    operatorOptions={operatorOptions}
                    plants={plants}
                    readOnly={readOnly}
                    removeOperatorRow={removeOperatorRow}
                    setForm={setForm}
                    setRowField={setRowField}
                    setRowOverride={setRowOverride}
                />
            )
        if (report.name === 'plant_manager')
            return (
                <PlantManagerForm
                    accentColor={accentColor}
                    form={form}
                    handleChange={handleChange}
                    readOnly={readOnly}
                    report={report}
                />
            )
        if (!EXCLUDED_REPORT_TYPES.includes(report.name))
            return <DefaultReportForm form={form} handleChange={handleChange} readOnly={readOnly} report={report} />
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
                        weekIso={WEEK_ISO_PLUGIN_REPORTS.includes(report.name) ? report.weekIso : undefined}
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
                    <div className="bg-green-100 text-text-primary p-4 rounded-lg mx-4 my-4 text-sm font-medium">
                        Report submitted successfully.
                    </div>
                )}
                {saveMessage && (
                    <div className="bg-green-100 text-text-primary p-4 rounded-lg mx-4 my-4 text-sm font-medium">
                        {saveMessage}
                    </div>
                )}
                {!readOnly && (
                    <SubmitActions
                        accentColor={accentColor}
                        isPlantProduction={isPlantProduction}
                        managerEditUser={managerEditUser}
                        onCancel={handleBackClick}
                        onSaveDraft={handleSaveDraft}
                        savingDraft={savingDraft}
                        submitting={submitting}
                    />
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

export default ReportsSubmitView
