import React, { useEffect, useRef, useState } from 'react'

import { OPERATOR_EXCLUSION_REASONS } from '../../../app/constants/reportConstants'
import { useReviewData } from '../../../app/hooks/useReviewData'
import { exportGeneralManagerReport } from '../../../utils/ExportUtility'
import { DistrictManagerReviewPlugin } from './types/WeeklyDistrictManagerReport'
import { EfficiencyReviewPlugin } from './types/WeeklyEfficiencyReport'
import { GeneralManagerReviewPlugin } from './types/WeeklyGeneralManagerReport'
import { QualityControlManagerReviewPlugin } from './types/WeeklyQualityControlManagerReport'
import { ReadyMixInstructorReviewPlugin } from './types/WeeklyReadyMixInstructorReport'
import { SafetyManagerReviewPlugin } from './types/WeeklySafetyManagerReport'

const PLUGINS = {
    district_manager: DistrictManagerReviewPlugin,
    general_manager: GeneralManagerReviewPlugin,
    plant_production: EfficiencyReviewPlugin,
    quality_control_manager: QualityControlManagerReviewPlugin,
    ready_mix_instructor: ReadyMixInstructorReviewPlugin,
    safety_environmental_rep: SafetyManagerReviewPlugin,
    safety_manager: SafetyManagerReviewPlugin
}

const PLUGIN_ONLY_REPORTS = [
    'plant_production',
    'general_manager',
    'aggregate_production',
    'district_manager',
    'quality_control_manager',
    'ready_mix_instructor'
]

const FOCUS_RING =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'

const REVIEW_SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider text-text-tertiary'
const REVIEW_FIELD_CLASS =
    'w-full rounded-md border border-border-light bg-bg-secondary px-2.5 py-1.5 text-[12.5px] text-text-primary outline-none box-border opacity-90 [color-scheme:light] dark:[color-scheme:dark] focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40'

const getFieldIcon = (fieldName) => {
    const iconMap = { total_hours: 'fa-clock' }
    return iconMap[fieldName] || 'fa-recycle'
}

const StatusBadge = ({ isSubmitted }) => (
    <div
        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-semibold ${
            isSubmitted
                ? 'bg-status-active/15 text-status-active border border-status-active/30'
                : 'bg-status-warning/15 text-status-warning border border-status-warning/30'
        }`}
    >
        <i className={`fas ${isSubmitted ? 'fa-check-circle' : 'fa-save'}`} aria-hidden="true" />
        <span className="hidden xs:inline">{isSubmitted ? 'Submitted' : 'Draft'}</span>
    </div>
)

const MetaItem = ({ icon, label, value }) => (
    <div className="flex items-center gap-2 text-sm text-text-secondary">
        <i className={`${icon} text-text-tertiary`} aria-hidden="true" />
        <span>{label}</span>
        <strong className="font-semibold text-text-primary">{value}</strong>
    </div>
)

/**
 * Read-only review view for a submitted report. Delegates rendering to a
 * type-specific review plugin (e.g. GeneralManagerReviewPlugin). Shows
 * computed metrics (YPH, grades), submission metadata, and a "Manager Edit"
 * button for users with that permission. Supports GM report export.
 */
function ReportsReviewView({ report, initialData, onBack, user, completedByUser, onManagerEdit }) {
    const containerRef = useRef(null)
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        let scrollable = el.parentElement
        while (scrollable && scrollable.scrollHeight <= scrollable.clientHeight) {
            scrollable = scrollable.parentElement
        }
        const target = scrollable || window
        target.scrollTo(0, 0)
    }, [])
    const {
        assignedPlant,
        form,
        hasManagerEditPermission,
        isPlantShutdown,
        isSubmitted,
        loadingPlants,
        maintenanceItems,
        operatorExclusionReason,
        operatorOptions,
        ownerName,
        plants,
        reportDateVerbose,
        showManagerEditButton,
        submittedAt,
        weekIso,
        weekVerbose
    } = useReviewData({ completedByUser, initialData, report, user })
    const [summaryTab, setSummaryTab] = useState('summary')
    const [exporting, setExporting] = useState(false)
    const [exportError, setExportError] = useState('')
    const PluginComponent = PLUGINS[report.name]
    const handleExport = async () => {
        if (exporting || loadingPlants || !plants.length) return
        setExportError('')
        setExporting(true)
        try {
            await exportGeneralManagerReport({ form, plants, weekIso })
        } catch (e) {
            setExportError(e?.message || 'Export failed')
        }
        setExporting(false)
    }

    const renderPlantManagerForm = () => (
        <div className="rounded-card p-3 mb-2.5 bg-bg-primary border border-border-light">
            <div className="flex items-center gap-2 mb-2">
                <div className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary text-text-secondary">
                    <i className="fas fa-clipboard-list text-[11px]" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className={REVIEW_SECTION_LABEL_CLASS}>Production</div>
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
                            className="flex flex-col gap-1.5 rounded-md p-2.5 bg-bg-secondary border border-border-light"
                        >
                            <label className="flex items-center gap-1.5">
                                <i
                                    className={`fas ${getFieldIcon(field.name)} text-[10px] text-accent`}
                                    aria-hidden="true"
                                />
                                <span className={REVIEW_SECTION_LABEL_CLASS}>{field.label}</span>
                            </label>
                            <input
                                type={field.type}
                                value={form[field.name] ?? ''}
                                readOnly
                                disabled
                                className={REVIEW_FIELD_CLASS}
                            />
                        </div>
                    ))}
            </div>
        </div>
    )

    const renderDefaultForm = () => (
        <div className="rounded-card p-3 mb-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-bg-primary border border-border-light">
            {report.fields
                .filter(
                    (f) =>
                        !(
                            ['safety_manager', 'safety_environmental_rep'].includes(report.name) && f.name === 'issues'
                        ) && f.type !== 'table'
                )
                .map((field) => (
                    <div
                        key={field.name}
                        className="flex flex-col gap-1.5 rounded-md p-2.5 bg-bg-secondary border border-border-light"
                    >
                        <label className={REVIEW_SECTION_LABEL_CLASS}>
                            {field.label}
                            {field.required && <span className="ml-0.5 text-status-danger">*</span>}
                        </label>
                        {field.type === 'textarea' ||
                        (typeof form[field.name] === 'string' && form[field.name].length > 80) ? (
                            <textarea
                                value={form[field.name] ?? ''}
                                readOnly
                                disabled
                                rows={4}
                                className={`${REVIEW_FIELD_CLASS} resize-y min-h-[88px]`}
                            />
                        ) : field.type === 'select' ? (
                            <select
                                value={form[field.name] ?? ''}
                                readOnly
                                disabled
                                className={`${REVIEW_FIELD_CLASS} appearance-none cursor-not-allowed pr-8`}
                            >
                                <option value="">Select...</option>
                                {field.options?.map((opt) => (
                                    <option key={opt} value={opt}>
                                        {opt}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type={field.type}
                                value={form[field.name] ?? ''}
                                readOnly
                                disabled
                                className={REVIEW_FIELD_CLASS}
                            />
                        )}
                    </div>
                ))}
        </div>
    )

    const renderAggregateTable = () => (
        <div className="bg-bg-primary rounded-card border border-border-light overflow-hidden mb-6">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className="bg-bg-secondary px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary border-b border-border-light">
                            Material
                        </th>
                        <th className="bg-bg-secondary px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary border-b border-border-light">
                            Amount
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {report.fields.map((field) => (
                        <tr key={field.name} className="transition-colors duration-150 hover:bg-bg-hover">
                            <td className="px-4 py-3 text-sm text-text-primary border-b border-border-light">
                                {field.label}
                            </td>
                            <td className="px-4 py-3 text-sm text-text-primary border-b border-border-light tabular-nums">
                                {form[field.name] || 0}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )

    return (
        <div ref={containerRef} className="bg-bg-secondary min-h-screen w-full">
            <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4 bg-bg-primary border-b border-border-light px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-40">
                <div className="flex items-center gap-4">
                    <button type="button"
                        className={`w-10 h-10 flex items-center justify-center bg-bg-secondary text-text-secondary rounded-md hover:bg-bg-hover hover:text-text-primary transition-colors duration-150 active:scale-[0.98] ${FOCUS_RING}`}
                        onClick={onBack}
                        type="button"
                        aria-label="Back"
                    >
                        <i className="fas fa-arrow-left" aria-hidden="true" />
                    </button>
                    <div>
                        <h1 className="font-heading text-xl font-semibold tracking-tight text-text-primary m-0">
                            {report.title || 'Report Review'}
                        </h1>
                        <p className="text-sm text-text-secondary m-0">{weekVerbose}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <StatusBadge isSubmitted={isSubmitted} />
                    {report.name === 'general_manager' && (
                        <button type="button"
                            type="button"
                            className={`inline-flex items-center gap-2 px-4 py-2 bg-status-active text-white rounded-md text-sm font-semibold transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS_RING}`}
                            disabled={exporting}
                            onClick={handleExport}
                        >
                            <i className="fas fa-file-export" aria-hidden="true" />
                            {exporting ? 'Exporting...' : 'Export'}
                        </button>
                    )}
                    {hasManagerEditPermission && showManagerEditButton && (
                        <button type="button"
                            type="button"
                            className={`inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-md text-sm font-semibold transition-all duration-150 hover:bg-accent-hover active:scale-[0.98] ${FOCUS_RING}`}
                            onClick={() => onManagerEdit(report, initialData)}
                        >
                            <i className="fas fa-edit" aria-hidden="true" />
                            Manager Edit
                        </button>
                    )}
                </div>
            </div>
            <div className="flex items-center flex-wrap gap-x-6 gap-y-2 bg-bg-secondary border-b border-border-light px-4 sm:px-6 py-3 sm:py-4">
                {reportDateVerbose && (
                    <MetaItem icon="far fa-calendar-check" label="Report Date:" value={reportDateVerbose} />
                )}
                {ownerName && <MetaItem icon="fas fa-user" label="Submitted By:" value={ownerName} />}
                {assignedPlant && <MetaItem icon="fas fa-industry" label="Plant:" value={assignedPlant} />}
                {submittedAt && (
                    <MetaItem icon="far fa-clock" label={isSubmitted ? 'Submitted:' : 'Saved:'} value={submittedAt} />
                )}
            </div>
            {exportError && (
                <div
                    className="flex items-center gap-2 rounded-card border border-status-danger/30 bg-status-danger/10 p-4 mx-6 my-4 text-sm font-medium text-text-primary animate-fade-slide-in"
                    role="alert"
                >
                    <i className="fas fa-exclamation-circle text-status-danger" aria-hidden="true" />
                    <span>{exportError}</span>
                </div>
            )}
            {isPlantShutdown && (
                <div className="mx-6 mt-4 rounded-card border border-status-warning/30 bg-status-warning/10 p-5">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-md bg-status-warning/20 flex items-center justify-center flex-shrink-0">
                            <i
                                className={`fas ${
                                    operatorExclusionReason === 'operators_sent_to_other_location'
                                        ? 'fa-truck-loading'
                                        : 'fa-industry'
                                } text-status-warning text-sm`}
                                aria-hidden="true"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                                All Operators Excluded
                            </span>
                            <span className="text-sm font-semibold text-text-primary">
                                {OPERATOR_EXCLUSION_REASONS[operatorExclusionReason] || 'Plant was shut down'}
                            </span>
                            {reportDateVerbose && (
                                <span className="text-xs text-text-tertiary">{reportDateVerbose}</span>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {!isPlantShutdown && (
                <div className="p-4 sm:p-6 w-full">
                    {report.name === 'plant_manager' && renderPlantManagerForm()}
                    {!PLUGIN_ONLY_REPORTS.includes(report.name) &&
                        report.name !== 'plant_manager' &&
                        renderDefaultForm()}
                    {PluginComponent && (
                        <PluginComponent
                            form={form}
                            summaryTab={summaryTab}
                            setSummaryTab={setSummaryTab}
                            maintenanceItems={maintenanceItems}
                            operatorOptions={operatorOptions}
                            plants={plants}
                            weekIso={weekIso}
                            user={completedByUser || user}
                            assignedPlant={assignedPlant}
                            reportUserId={initialData?.user_id}
                        />
                    )}
                    {report.name === 'aggregate_production' && renderAggregateTable()}
                </div>
            )}
        </div>
    )
}
export default ReportsReviewView
