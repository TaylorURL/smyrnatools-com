import { useCallback, useMemo, useState } from 'react'

import { STATUS_FILTER_MAP, STATUS_PRIORITY } from '../../utils/MaintenanceLogUtility'

/**
 * Filtering and sorting logic for the maintenance log equipment table.
 * @param {{ equipment: Array, searchText: string, selectedPlant: string, categoryFilter: string, statusFilter: string, plants: Array }} params
 */
export function useMaintenanceLogFilters({ equipment, searchText, selectedPlant, categoryFilter, statusFilter, plants }) {
    const [sortKey, setSortKey] = useState('')
    const [sortDir, setSortDir] = useState('asc')

    const filtered = useMemo(() => {
        const query = searchText.trim().toLowerCase()
        return equipment.filter((item) => {
            if (query) {
                const searchable = [
                    item.name,
                    item.serial_number,
                    item.manufacturer,
                    item.model,
                    item.category_name,
                    item.plant_code
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase()
                if (!searchable.includes(query)) return false
            }
            if (selectedPlant && selectedPlant !== 'All') {
                if (selectedPlant.startsWith('DISTRICT:')) {
                    const districtName = selectedPlant.slice(9)
                    const districtPlantCodes = new Set()
                    plants.forEach((p) => {
                        const code = p.plantCode || p.plant_code || ''
                        const districts = p.districts || []
                        districts.forEach((d) => {
                            const name = typeof d === 'string' ? d : d?.name
                            if (name === districtName) districtPlantCodes.add(code.trim().toUpperCase())
                        })
                    })
                    if (!districtPlantCodes.has((item.plant_code || '').trim().toUpperCase())) return false
                } else if ((item.plant_code || '').toUpperCase() !== selectedPlant.toUpperCase()) {
                    return false
                }
            }
            if (categoryFilter && item.category_name !== categoryFilter) return false
            if (statusFilter && statusFilter !== 'All Statuses') {
                const mapped = STATUS_FILTER_MAP[statusFilter]
                if (mapped && item.service_status !== mapped) return false
            }
            return true
        })
    }, [equipment, searchText, selectedPlant, categoryFilter, statusFilter, plants])

    const sorted = useMemo(() => {
        if (!sortKey) {
            return [...filtered].sort(
                (a, b) => (STATUS_PRIORITY[a.service_status] ?? 3) - (STATUS_PRIORITY[b.service_status] ?? 3)
            )
        }
        const dir = sortDir === 'asc' ? 1 : -1
        return [...filtered].sort((a, b) => {
            let va, vb
            switch (sortKey) {
                case 'Equipment':
                    va = a.name
                    vb = b.name
                    break
                case 'Plant':
                    va = a.plant_code
                    vb = b.plant_code
                    break
                case 'Last Service':
                    va = a.last_service_date || ''
                    vb = b.last_service_date || ''
                    break
                case 'Next Due':
                    va = a.next_service_date || ''
                    vb = b.next_service_date || ''
                    break
                case 'Status': {
                    return (
                        ((STATUS_PRIORITY[a.service_status] ?? 3) - (STATUS_PRIORITY[b.service_status] ?? 3)) * dir
                    )
                }
                default:
                    return 0
            }
            if (va < vb) return -1 * dir
            if (va > vb) return 1 * dir
            return 0
        })
    }, [filtered, sortKey, sortDir])

    const handleHeaderClick = useCallback(
        (key) => {
            if (sortKey === key) {
                setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
            } else {
                setSortKey(key)
                setSortDir('asc')
            }
        },
        [sortKey]
    )

    return { filtered, sorted, sortKey, sortDir, handleHeaderClick }
}
