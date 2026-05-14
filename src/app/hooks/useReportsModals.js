import { useState } from 'react'

/**
 * Owns every modal-trigger boolean and editing/selected target for the
 * Reports hub. Returns the raw state for the orchestrator to thread into
 * `ReportsModalsHost`, plus convenience setters. Centralising the state
 * here keeps the orchestrator small.
 */
export function useReportsModals() {
    const [isPlantModalOpen, setIsPlantModalOpen] = useState(false)
    const [showLostLoadModal, setShowLostLoadModal] = useState(false)
    const [showQCStrengthModal, setShowQCStrengthModal] = useState(false)
    const [showLabReportModal, setShowLabReportModal] = useState(false)
    const [showQualityIssueModal, setShowQualityIssueModal] = useState(false)
    const [editingLostLoad, setEditingLostLoad] = useState(null)
    const [editingQcReport, setEditingQcReport] = useState(null)
    const [editingLabReport, setEditingLabReport] = useState(null)
    const [selectedQCReport, setSelectedQCReport] = useState(null)
    const [selectedLabReport, setSelectedLabReport] = useState(null)
    const [selectedLostLoad, setSelectedLostLoad] = useState(null)

    return {
        editingLabReport,
        editingLostLoad,
        editingQcReport,
        isPlantModalOpen,
        selectedLabReport,
        selectedLostLoad,
        selectedQCReport,
        setEditingLabReport,
        setEditingLostLoad,
        setEditingQcReport,
        setIsPlantModalOpen,
        setSelectedLabReport,
        setSelectedLostLoad,
        setSelectedQCReport,
        setShowLabReportModal,
        setShowLostLoadModal,
        setShowQCStrengthModal,
        setShowQualityIssueModal,
        showLabReportModal,
        showLostLoadModal,
        showQCStrengthModal,
        showQualityIssueModal
    }
}
