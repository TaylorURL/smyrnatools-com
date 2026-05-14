import {
    addDataRow,
    addMergedTableHeaders,
    addSectionTitle,
    addTableHeaders,
    COLORS
} from '../../../../../../utils/ExportUtility'

const TRAINER_HEADERS = [
    { label: 'Plant', merge: false },
    { align: 'left', label: 'Name', merge: false },
    { label: 'Type', merge: false },
    { label: 'Status', merge: false }
]

const PENDING_HEADERS = [
    { label: 'Plant', merge: false },
    { align: 'left', label: 'Name', merge: false },
    { label: 'Type', merge: false },
    { label: 'Start Date', merge: true }
]

const TRAINING_HEADERS = [
    { label: 'Plant', merge: false },
    { align: 'left', label: 'Name', merge: false },
    { label: 'Type', merge: false },
    { align: 'left', label: 'Trainer', merge: false }
]

/** Resolves a plant code to a display name from the report's plants array. */
function getPlantNameResolver(plants) {
    return (code) => {
        const plant = plants?.find((p) => (p.plant_code || p.code) === code)
        return plant?.name || code || ''
    }
}

/** Sub-section label cell (e.g. "Active Trainers", "Pending Start", etc.). */
function renderSubsectionHeader(ws, row, label) {
    ws.getCell(row, 2).value = label
    ws.getCell(row, 2).font = { bold: true, color: { argb: COLORS.slate700 }, name: 'Calibri', size: 11 }
}

function renderTrainersTable(ws, startRow, trainers, getPlantName) {
    let row = startRow
    renderSubsectionHeader(ws, row, 'Active Trainers')
    row++
    addMergedTableHeaders(ws, row, TRAINER_HEADERS)
    row++
    trainers.forEach((t, idx) => {
        addDataRow(
            ws,
            row,
            [
                { align: 'center', value: getPlantName(t.plant) },
                t.name || '',
                { align: 'center', value: t.type },
                { align: 'center', value: t.status || '' }
            ],
            2,
            idx % 2 === 1
        )
        row++
    })
    return row + 1
}

function renderPendingTable(ws, startRow, pending, getPlantName) {
    let row = startRow
    renderSubsectionHeader(ws, row, 'Pending Start')
    row++
    addMergedTableHeaders(ws, row, PENDING_HEADERS)
    row++
    pending.forEach((p, idx) => {
        const isAlt = idx % 2 === 1
        addDataRow(
            ws,
            row,
            [{ align: 'center', value: getPlantName(p.plant) }, p.name || '', { align: 'center', value: p.type }],
            2,
            isAlt
        )
        ws.mergeCells(row, 5, row, 6)
        const startDateCell = ws.getCell(row, 5)
        startDateCell.value = p.startDate || ''
        startDateCell.font = { color: { argb: COLORS.slate700 }, name: 'Calibri', size: 11 }
        startDateCell.alignment = { horizontal: 'center', vertical: 'middle' }
        if (isAlt) {
            startDateCell.fill = { fgColor: { argb: COLORS.snow }, pattern: 'solid', type: 'pattern' }
            ws.getCell(row, 6).fill = { fgColor: { argb: COLORS.snow }, pattern: 'solid', type: 'pattern' }
        }
        row++
    })
    return row + 1
}

function renderTrainingTable(ws, startRow, training, getPlantName) {
    let row = startRow
    renderSubsectionHeader(ws, row, 'In Training')
    row++
    addMergedTableHeaders(ws, row, TRAINING_HEADERS)
    row++
    training.forEach((t, idx) => {
        const trainerValue = t.trainer && typeof t.trainer === 'string' && t.trainer.trim() ? t.trainer : 'Not Assigned'
        addDataRow(
            ws,
            row,
            [
                { align: 'center', value: getPlantName(t.plant) },
                t.name || '',
                { align: 'center', value: t.type },
                trainerValue
            ],
            2,
            idx % 2 === 1
        )
        row++
    })
    return row + 1
}

function renderHiringGoalsTable(ws, startRow, hiringGoals, sortedPlants, getPlantName) {
    let row = startRow + 1
    renderSubsectionHeader(ws, row, 'Hiring Goals')
    row++
    addTableHeaders(ws, row, ['Plant', 'Goal'], 2)
    row++
    sortedPlants.forEach((plant, idx) => {
        const code = plant.plant_code || plant.code
        const goal = hiringGoals[code]
        if (goal === undefined || goal === null || goal === '') return
        addDataRow(
            ws,
            row,
            [
                { align: 'center', value: getPlantName(code) },
                { align: 'center', value: Number(goal) }
            ],
            2,
            idx % 2 === 1
        )
        row++
    })
    return row
}

/** "Training & Hiring" section — four optional sub-tables (Trainers,
 *  Pending Start, In Training, Hiring Goals). The section title is only
 *  drawn when at least one of the first three sub-tables has rows. */
export function renderRmiTrainingHiring(
    ws,
    startRow,
    { allPending, allTraining, allTrainers, hiringGoals, plants, sortedPlants }
) {
    const getPlantName = getPlantNameResolver(plants)
    let row = startRow
    if (allTrainers.length > 0 || allPending.length > 0 || allTraining.length > 0) {
        addSectionTitle(ws, row, 'Training & Hiring')
        row += 2
    }
    if (allTrainers.length > 0) {
        row = renderTrainersTable(ws, row, allTrainers, getPlantName)
    }
    if (allPending.length > 0) {
        row = renderPendingTable(ws, row, allPending, getPlantName)
    }
    if (allTraining.length > 0) {
        row = renderTrainingTable(ws, row, allTraining, getPlantName)
    }
    const goalsArr = Object.entries(hiringGoals).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    if (goalsArr.length > 0) {
        row = renderHiringGoalsTable(ws, row, hiringGoals, sortedPlants, getPlantName)
    }
    return row
}
