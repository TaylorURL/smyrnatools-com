import React from 'react'

import ReportsModalsHost from './ReportsModalsHost'

/**
 * Thin connector that threads the orchestrator's modal state + cross-cutting
 * callbacks into `ReportsModalsHost`. Keeps the orchestrator JSX small.
 */
export default function ReportsModalsHostConnected({
    addLostLoadReport,
    filters,
    getUserName,
    modals,
    qc,
    regionCode,
    regionalPlants,
    selectTab,
    setTab,
    tab,
    triggerRefresh,
    user,
    userPlantCode
}) {
    return (
        <ReportsModalsHost
            editingLabReport={modals.editingLabReport}
            editingLostLoad={modals.editingLostLoad}
            editingQcReport={modals.editingQcReport}
            getUserName={getUserName}
            isPlantModalOpen={modals.isPlantModalOpen}
            onAddLostLoadReport={addLostLoadReport}
            onClosePlantModal={() => modals.setIsPlantModalOpen(false)}
            onMarkLabReviewed={(id) => {
                qc.setQcReports((prev) => prev.map((r) => (r.id === id ? { ...r, reviewed: true } : r)))
                modals.setSelectedLabReport(null)
            }}
            onMarkQcReviewed={(id) => {
                qc.setQcReports((prev) => prev.map((r) => (r.id === id ? { ...r, reviewed: true } : r)))
                modals.setSelectedQCReport(null)
            }}
            onQualityIssueSaved={() => {
                modals.setShowQualityIssueModal(false)
                // Jump to the Quality Issues tab so the user sees the newly created issue.
                selectTab('quality_issues')
            }}
            onSelectPlant={(plantCode) => {
                filters.setFilterPlant(plantCode)
                modals.setIsPlantModalOpen(false)
            }}
            onSelectQualityIssueTab={setTab}
            onSetEditingLabReport={modals.setEditingLabReport}
            onSetEditingLostLoad={modals.setEditingLostLoad}
            onSetEditingQcReport={modals.setEditingQcReport}
            onSetSelectedLabReport={modals.setSelectedLabReport}
            onSetSelectedLostLoad={modals.setSelectedLostLoad}
            onSetSelectedQCReport={modals.setSelectedQCReport}
            onSetShowLabReportModal={modals.setShowLabReportModal}
            onSetShowLostLoadModal={modals.setShowLostLoadModal}
            onSetShowQCStrengthModal={modals.setShowQCStrengthModal}
            onSetShowQualityIssueModal={modals.setShowQualityIssueModal}
            onShouldReloadQc={() => {
                qc.setQcLoaded(false)
                if (tab === 'quality') qc.loadQCReports()
            }}
            onTriggerRefresh={triggerRefresh}
            regionCode={regionCode}
            regionalPlants={regionalPlants}
            selectedLabReport={modals.selectedLabReport}
            selectedLostLoad={modals.selectedLostLoad}
            selectedQCReport={modals.selectedQCReport}
            showLabReportModal={modals.showLabReportModal}
            showLostLoadModal={modals.showLostLoadModal}
            showQCStrengthModal={modals.showQCStrengthModal}
            showQualityIssueModal={modals.showQualityIssueModal}
            tab={tab}
            user={user}
            userPlantCode={userPlantCode}
        />
    )
}
