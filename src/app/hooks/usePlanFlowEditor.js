import { useEffect, useState } from 'react'

import { createEmptyAssignment } from '../../utils/PlanUtility'

const PANEL_MODE_OVERVIEW = 'overview'
const PANEL_MODE_ADD = 'add'
const PANEL_MODE_EDIT = 'edit'

/**
 * State + handlers for the Flow side panel — selection, route add/edit,
 * destination-picking on the canvas, and submit / cancel / delete. The
 * caller wires the returned `handleNodeClick` into node buttons so picking
 * a destination flows back into the active draft.
 */
export function usePlanFlowEditor({ assignments, setAssignments }) {
    const [selectedCode, setSelectedCode] = useState(null)
    const [panelMode, setPanelMode] = useState(PANEL_MODE_OVERVIEW)
    const [draft, setDraft] = useState(null)
    const [editingIndex, setEditingIndex] = useState(null)
    const [pickingDestination, setPickingDestination] = useState(false)

    // Reset the editor when the selection changes.
    useEffect(() => {
        setPanelMode(PANEL_MODE_OVERVIEW)
        setDraft(null)
        setEditingIndex(null)
        setPickingDestination(false)
    }, [selectedCode])

    const handleNodeClick = (code) => {
        if (pickingDestination && draft && code !== draft.fromPlant) {
            setDraft({ ...draft, toPlant: code })
            setPickingDestination(false)
            return
        }
        setSelectedCode((prev) => (prev === code ? null : code))
    }

    const openAddRoute = (selected) => {
        if (!selected) return
        setPanelMode(PANEL_MODE_ADD)
        setDraft({
            customTimes: [],
            driverCount: 1,
            forOrderId: '',
            fromPlant: selected.code,
            leaveTime: '',
            returnPlant: selected.code,
            staggerMinutes: 5,
            time: '',
            timeMode: 'stagger',
            toPlant: ''
        })
        setEditingIndex(null)
        setPickingDestination(true)
    }

    const openEditRoute = (assignmentIndex) => {
        const assignment = assignments[assignmentIndex]
        if (!assignment) return
        setPanelMode(PANEL_MODE_EDIT)
        setEditingIndex(assignmentIndex)
        setDraft({
            customTimes: Array.isArray(assignment.customTimes) ? assignment.customTimes : [],
            driverCount: parseInt(assignment.driverCount, 10) || 1,
            forOrderId: assignment.forOrderId || '',
            fromPlant: assignment.fromPlant,
            leaveTime: assignment.leaveTime || '',
            returnPlant: assignment.returnPlant || assignment.fromPlant,
            staggerMinutes: parseInt(assignment.staggerMinutes, 10) || 5,
            time: assignment.time || '',
            timeMode: assignment.timeMode === 'custom' ? 'custom' : 'stagger',
            toPlant: assignment.toPlant
        })
        setPickingDestination(false)
    }

    const cancelEditor = () => {
        setPanelMode(PANEL_MODE_OVERVIEW)
        setDraft(null)
        setEditingIndex(null)
        setPickingDestination(false)
    }

    const submitEditor = () => {
        if (!draft?.fromPlant || !draft?.toPlant) return
        const payload = {
            customTimes: draft.timeMode === 'custom' ? draft.customTimes || [] : [],
            driverCount: Math.max(0, parseInt(draft.driverCount, 10) || 0),
            forOrderId: draft.forOrderId || '',
            fromPlant: draft.fromPlant,
            leaveTime: draft.leaveTime || '',
            returnPlant: draft.returnPlant || draft.fromPlant,
            staggerMinutes: Math.max(0, parseInt(draft.staggerMinutes, 10) || 0),
            time: draft.time,
            timeMode: draft.timeMode === 'custom' ? 'custom' : 'stagger',
            toPlant: draft.toPlant
        }
        if (panelMode === PANEL_MODE_EDIT && editingIndex != null) {
            setAssignments((prev) => prev.map((a, idx) => (idx === editingIndex ? { ...a, ...payload } : a)))
        } else {
            const newAssignment = { ...createEmptyAssignment(), ...payload }
            setAssignments((prev) => [...prev, newAssignment])
        }
        cancelEditor()
    }

    const deleteAssignment = (assignmentIndex) => {
        const assignment = assignments[assignmentIndex]
        if (!assignment) return
        if (!window.confirm(`Delete ${assignment.fromPlant || '?'} → ${assignment.toPlant || '?'} route?`)) return
        setAssignments((prev) => prev.filter((_, idx) => idx !== assignmentIndex))
        cancelEditor()
    }

    return {
        cancelEditor,
        deleteAssignment,
        draft,
        editingIndex,
        handleNodeClick,
        openAddRoute,
        openEditRoute,
        panelMode,
        pickingDestination,
        selectedCode,
        setDraft,
        setPickingDestination,
        setSelectedCode,
        submitEditor
    }
}
