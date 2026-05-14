import { COLORS } from '../../../../../../utils/ExportUtility'
import { addSidebarTitle } from './gmSidebar'

/** Reduce an asset list into status buckets — Active/Spare/Shop/Retired plus
 *  a `total` that excludes retired. */
export function countByStatus(items) {
    const counts = { active: 0, retired: 0, shop: 0, spare: 0, total: 0 }
    items.forEach((item) => {
        if (item.status === 'Active') counts.active++
        else if (item.status === 'Spare') counts.spare++
        else if (item.status === 'In Shop') counts.shop++
        else if (item.status === 'Retired') counts.retired++
        if (item.status !== 'Retired') counts.total++
    })
    return counts
}

/** Splits tractors by `freight` into Cement (default) / End Dump / Dump Truck,
 *  then bucketizes each by status. */
export function countTractorsByType(tractors) {
    const cement = tractors.filter((t) => t.freight === 'Cement' || !t.freight)
    const endDump = tractors.filter((t) => t.freight === 'Aggregate')
    const dumpTruck = tractors.filter((t) => t.freight === 'Dump Truck')
    return {
        cement: countByStatus(cement),
        dumpTruck: countByStatus(dumpTruck),
        endDump: countByStatus(endDump)
    }
}

/** Adjusts mixer counts upward by unassigned active operators — they're
 *  still counted as active in the fleet, just without a mixer row. */
export function buildMixerCounts(mixers, totalOps) {
    const status = countByStatus(mixers || [])
    const unassignedActive = Math.max(totalOps - status.active, 0)
    return { ...status, active: status.active + unassignedActive, total: status.total + unassignedActive }
}

/** Asset group block — title row + 4 status rows (Active/Spare/Shop/Total).
 *  Returns the next free row. */
function addAssetGroup(ws, startRow, assetCol, title, counts) {
    let row = startRow
    ws.mergeCells(row, assetCol, row, assetCol + 1)
    const groupCell = ws.getCell(row, assetCol)
    groupCell.value = title
    groupCell.font = { bold: true, color: { argb: COLORS.slate700 }, name: 'Calibri', size: 11 }
    groupCell.fill = { fgColor: { argb: COLORS.slate100 }, pattern: 'solid', type: 'pattern' }
    groupCell.alignment = { horizontal: 'left', vertical: 'middle' }
    ws.getCell(row, assetCol + 1).fill = {
        fgColor: { argb: COLORS.slate100 },
        pattern: 'solid',
        type: 'pattern'
    }
    ws.getRow(row).height = 20
    row++

    const statusRows = [
        { color: COLORS.success, label: 'Active', value: counts.active },
        { color: COLORS.brand, label: 'Spare', value: counts.spare },
        { color: counts.shop > 0 ? COLORS.warning : COLORS.brand, label: 'In Shop', value: counts.shop },
        { bold: true, color: COLORS.slate700, label: 'Total', value: counts.total }
    ]
    statusRows.forEach((statusRow, idx) => {
        const isAlt = idx % 2 === 1
        const bgColor = isAlt ? COLORS.snow : null
        const labelCell = ws.getCell(row, assetCol)
        labelCell.value = statusRow.label
        labelCell.font = {
            bold: statusRow.bold || false,
            color: { argb: COLORS.slate500 },
            name: 'Calibri',
            size: 10
        }
        labelCell.alignment = { horizontal: 'left', vertical: 'middle' }
        if (bgColor) labelCell.fill = { fgColor: { argb: bgColor }, pattern: 'solid', type: 'pattern' }
        const valueCell = ws.getCell(row, assetCol + 1)
        valueCell.value = statusRow.value
        valueCell.font = { bold: statusRow.bold || false, color: { argb: statusRow.color }, name: 'Calibri', size: 12 }
        valueCell.alignment = { horizontal: 'left', vertical: 'middle' }
        if (bgColor) valueCell.fill = { fgColor: { argb: bgColor }, pattern: 'solid', type: 'pattern' }
        ws.getRow(row).height = 20
        row++
    })
    return row + 1
}

/** "Asset Overview" sidebar — seven asset groups (Mixers, Cement Haulers,
 *  End Dump, Dump Trucks, Trailers, Equipment, Pickup Trucks). */
export function renderAssetOverview(ws, startRow, assetCol, { equipment, mixers, pickups, tractors, trailers }) {
    ws.getColumn(assetCol).width = 14
    ws.getColumn(assetCol + 1).width = 10

    addSidebarTitle(ws, startRow, assetCol, 'Asset Overview', 2)
    let row = startRow + 1

    ws.mergeCells(row, assetCol, row, assetCol + 1)
    const noteCell = ws.getCell(row, assetCol)
    noteCell.value = 'As of report generation'
    noteCell.font = { color: { argb: COLORS.slate500 }, italic: true, name: 'Calibri', size: 9 }
    noteCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(row).height = 16
    row++

    const tractorBreakdown = countTractorsByType(tractors)
    row = addAssetGroup(ws, row, assetCol, 'Mixers', mixers)
    row = addAssetGroup(ws, row, assetCol, 'Cement Haulers', tractorBreakdown.cement)
    row = addAssetGroup(ws, row, assetCol, 'End Dump', tractorBreakdown.endDump)
    row = addAssetGroup(ws, row, assetCol, 'Dump Trucks', tractorBreakdown.dumpTruck)
    row = addAssetGroup(ws, row, assetCol, 'Trailers', countByStatus(trailers))
    row = addAssetGroup(ws, row, assetCol, 'Equipment', countByStatus(equipment))
    row = addAssetGroup(ws, row, assetCol, 'Pickup Trucks', countByStatus(pickups))
    return row
}
