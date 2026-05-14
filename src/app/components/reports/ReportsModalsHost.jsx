import React from 'react'

import QualityIssueModal from '../../../views/reporting/quality/QualityIssueModal'
import PlantDropdownModal from '../common/PlantDropdownModal'
import LostLoadDetailModal from './tabs/lost-loads/LostLoadDetailModal'
import LostLoadReportModal from './tabs/lost-loads/LostLoadReportModal'
import QCStrengthDetailModal from './tabs/quality/QCStrengthDetailModal'
import QCStrengthReportModal from './tabs/quality/QCStrengthReportModal'
import ThirdPartyLabDetailModal from './tabs/quality/ThirdPartyLabDetailModal'
import ThirdPartyLabReportModal from './tabs/quality/ThirdPartyLabReportModal'

/**
 * Renders the full set of modals that hang off the Reports hub. All visibility
 * is controlled by the parent — this component is pure mount-conditional JSX.
 */
export default function ReportsModalsHost({
    editingLabReport,
    editingLostLoad,
    editingQcReport,
    getUserName,
    isPlantModalOpen,
    onAddLostLoadReport,
    onClosePlantModal,
    onMarkLabReviewed,
    onMarkQcReviewed,
    onQualityIssueSaved,
    onSelectPlant,
    onSelectQualityIssueTab,
    onSetEditingLabReport,
    onSetEditingLostLoad,
    onSetEditingQcReport,
    onSetSelectedLabReport,
    onSetSelectedLostLoad,
    onSetSelectedQCReport,
    onSetShowLabReportModal,
    onSetShowLostLoadModal,
    onSetShowQCStrengthModal,
    onSetShowQualityIssueModal,
    onShouldReloadQc,
    onTriggerRefresh,
    regionCode,
    regionalPlants,
    selectedLabReport,
    selectedLostLoad,
    selectedQCReport,
    showLabReportModal,
    showLostLoadModal,
    showQCStrengthModal,
    showQualityIssueModal,
    tab,
    user,
    userPlantCode
}) {
    return (
        <>
            {isPlantModalOpen && (
                <PlantDropdownModal
                    isOpen={isPlantModalOpen}
                    onClose={onClosePlantModal}
                    plants={regionalPlants}
                    onSelect={onSelectPlant}
                    showAllPlants={true}
                    showMyPlants={false}
                    userPlantCode={userPlantCode}
                />
            )}
            {(showLostLoadModal || editingLostLoad) && (
                <LostLoadReportModal
                    onClose={() => {
                        onSetShowLostLoadModal(false)
                        onSetEditingLostLoad(null)
                    }}
                    onSubmitted={(report) => {
                        onAddLostLoadReport(report)
                        if (!editingLostLoad && tab !== 'lost_loads') onSelectQualityIssueTab('lost_loads')
                    }}
                    plants={regionalPlants}
                    user={user}
                    initialReport={editingLostLoad}
                />
            )}
            {selectedLostLoad && (
                <LostLoadDetailModal
                    report={selectedLostLoad}
                    getUserName={getUserName}
                    onClose={() => onSetSelectedLostLoad(null)}
                />
            )}
            {(showQCStrengthModal || editingQcReport) && (
                <QCStrengthReportModal
                    onClose={() => {
                        onSetShowQCStrengthModal(false)
                        onSetEditingQcReport(null)
                    }}
                    onSubmitted={() => {
                        onShouldReloadQc()
                        if (!editingQcReport) onTriggerRefresh()
                    }}
                    user={user}
                    initialReport={editingQcReport}
                />
            )}
            {selectedLabReport && (
                <ThirdPartyLabDetailModal
                    report={selectedLabReport}
                    getUserName={getUserName}
                    onClose={() => onSetSelectedLabReport(null)}
                    onReviewed={onMarkLabReviewed}
                />
            )}
            {(showLabReportModal || editingLabReport) && (
                <ThirdPartyLabReportModal
                    onClose={() => {
                        onSetShowLabReportModal(false)
                        onSetEditingLabReport(null)
                    }}
                    onSubmitted={onShouldReloadQc}
                    user={user}
                    initialReport={editingLabReport}
                />
            )}
            {showQualityIssueModal && (
                <QualityIssueModal
                    issue={null}
                    onClose={() => onSetShowQualityIssueModal(false)}
                    onSaved={onQualityIssueSaved}
                    plants={regionalPlants}
                    regionCode={regionCode}
                />
            )}
            {selectedQCReport && (
                <QCStrengthDetailModal
                    report={selectedQCReport}
                    getUserName={getUserName}
                    onClose={() => onSetSelectedQCReport(null)}
                    onReviewed={onMarkQcReviewed}
                />
            )}
        </>
    )
}
