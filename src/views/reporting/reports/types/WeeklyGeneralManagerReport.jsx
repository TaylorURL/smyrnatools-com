import React, { useState } from 'react'

import { GmAggregateProductionSection } from '../../../../app/components/reports/granular/GmAggregateProductionSection'
import { AiAnalysisCard, GmEmptyState, GmSectionHeader } from '../../../../app/components/reports/granular/GmAtoms'
import { GmEfficiencyReportsSection } from '../../../../app/components/reports/granular/GmEfficiencyReportsSection'
import { GmPlantSummarySection } from '../../../../app/components/reports/granular/GmPlantSummarySection'
import { useGmAiAnalysis } from '../../../../app/hooks/useGmAiAnalysis'
import { useGmReportsData } from '../../../../app/hooks/useGmReportsData'
import { useReportForWeek } from '../../../../app/hooks/useReportData'
import { ReadyMixInstructorReviewPlugin } from './WeeklyReadyMixInstructorReport'

/** Embedded Ready Mix Instructor report — loading state, the review
 *  plugin, or an empty state. Shared by Submit and Review modes. */
function GmRmiSection({ loading, plants, rmiData }) {
    return (
        <div className="mt-8 pt-6 border-t border-gray-200">
            <GmSectionHeader title="Ready Mix Instructor Report" />
            {loading ? (
                <GmEmptyState message="Loading RMI report data..." />
            ) : rmiData ? (
                <ReadyMixInstructorReviewPlugin form={rmiData} plants={plants} />
            ) : (
                <GmEmptyState message="No Ready Mix Instructor report found for this week." />
            )}
        </div>
    )
}

/** Submit-mode plugin — collects per-plant metrics, embeds efficiency
 *  reports and aggregate production, and surfaces an AI regional
 *  analysis on top. */
export function GeneralManagerSubmitPlugin({ form, setForm, plants = [], readOnly, weekIso, userId }) {
    const [effIdx, setEffIdx] = useState(0)
    const { aggReport, effReports, lastWeekAgg, lastWeekGm, rmiLoading, rmiReport } = useGmReportsData(
        plants,
        weekIso,
        userId
    )
    const { aiAnalysis, aiError, aiLoading, getLastWeekValue, regenerate } = useGmAiAnalysis({
        aggReport,
        effReports,
        form,
        lastWeekGm,
        plants,
        rmiLoading,
        rmiReport,
        weekIso
    })

    return (
        <>
            <AiAnalysisCard
                aiAnalysis={aiAnalysis}
                aiError={aiError}
                aiLoading={aiLoading}
                onRegenerate={regenerate}
                plantsCount={plants.length}
            />
            <div className="rounded-lg border border-gray-200 bg-bg-primary p-6 mb-6">
                <GmPlantSummarySection
                    form={form}
                    getLastWeekValue={getLastWeekValue}
                    plants={plants}
                    readOnly={readOnly}
                    setForm={setForm}
                />
                <div className="mt-4">
                    <GmEfficiencyReportsSection effIdx={effIdx} effReports={effReports} setEffIdx={setEffIdx} />
                </div>
                {effReports.length > 0 && (
                    <GmAggregateProductionSection aggReport={aggReport} lastWeekAgg={lastWeekAgg} />
                )}
                <GmRmiSection loading={rmiLoading} plants={plants} rmiData={rmiReport} />
            </div>
        </>
    )
}

/** Review-mode plugin — placeholder body for the GM summary, embedded
 *  RMI report at the bottom. */
export function GeneralManagerReviewPlugin({ form: _form, plants = [], weekIso }) {
    const { loading, report: rmiReport } = useReportForWeek(weekIso, 'ready_mix_instructor')
    return (
        <div className="rounded-lg border border-gray-200 bg-bg-primary p-6 mb-6">
            <GmSectionHeader title="General Manager Report" />
            <GmEmptyState message="Review view for General Manager reports." />
            <GmRmiSection loading={loading} plants={plants} rmiData={rmiReport?.data} />
        </div>
    )
}
