import React, { useEffect, useMemo, useState } from 'react'

import { useRecapDerivedData } from '../../hooks/useRecapDerivedData'
import { useRecapHistory } from '../../hooks/useRecapHistory'
import Dialog from '../ui/Dialog'
import RecapChangeTable from './recap/RecapChangeTable'
import RecapFiltersToolbar from './recap/RecapFiltersToolbar'

/**
 * Recent mixer and operator changes for one plant, or for every plant when
 * `isAllPlants` is set: net change over the selected window, then every
 * field change behind it as one table, newest first.
 */
function RecapModalSection({ plantCode, plantName, mixers, operators = [], isAllPlants = false, isOpen, onClose }) {
    const [dateFilter, setDateFilter] = useState('week')
    const [searchQuery, setSearchQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState('all')
    const [fieldFilter, setFieldFilter] = useState('all')

    const mixerIds = useMemo(() => {
        if (!mixers || !Array.isArray(mixers)) return []
        return mixers.map((m) => m.id).filter(Boolean)
    }, [mixers])
    const operatorIds = useMemo(() => {
        if (!operators || !Array.isArray(operators)) return []
        return operators.map((o) => o.employeeId || o.employee_id).filter(Boolean)
    }, [operators])

    const { fetchHistory, isLoading, mixerHistory, operatorHistory, operatorNames, userNames } = useRecapHistory({
        dateFilter,
        mixerIds,
        operatorIds
    })

    const { availableFields, changeMetrics, filteredHistory } = useRecapDerivedData({
        fieldFilter,
        isAllPlants,
        mixerHistory,
        mixers,
        operatorHistory,
        operators,
        plantCode,
        searchQuery,
        typeFilter
    })

    useEffect(() => {
        if (isOpen && (mixerIds.length > 0 || operatorIds.length > 0)) {
            fetchHistory()
        }
    }, [isOpen, mixerIds, operatorIds, dateFilter, fetchHistory])

    const filteredChangesForGroup = (group) => {
        if (fieldFilter === 'all') return group.changes
        return group.changes.filter((c) => c.field_name === fieldFilter)
    }

    if (!isOpen || (!plantCode && !isAllPlants)) return null

    // One row per field change, newest first. Assets with several changes
    // simply contribute several rows; the asset column says whose they are.
    const rows = filteredHistory
        .flatMap((group) => filteredChangesForGroup(group).map((change) => ({ change, group })))
        .sort((a, b) => new Date(b.change.changed_at) - new Date(a.change.changed_at))
    const hasActiveFilters = searchQuery || typeFilter !== 'all' || fieldFilter !== 'all'
    const clearAllFilters = () => {
        setSearchQuery('')
        setTypeFilter('all')
        setFieldFilter('all')
    }

    return (
        <Dialog
            open
            onClose={onClose}
            size="xl"
            tall
            eyebrow={isAllPlants ? 'All plants' : [`Plant ${plantCode}`, plantName].filter(Boolean).join(' · ')}
            title="Recap"
            bodyClassName="p-0"
            toolbar={
                <RecapFiltersToolbar
                    assetCount={filteredHistory.length}
                    availableFields={availableFields}
                    changeCount={rows.length}
                    changeMetrics={changeMetrics}
                    dateFilter={dateFilter}
                    fieldFilter={fieldFilter}
                    hasActiveFilters={Boolean(hasActiveFilters)}
                    onClearFilters={clearAllFilters}
                    onDateFilterChange={setDateFilter}
                    onFieldFilterChange={setFieldFilter}
                    onSearchQueryChange={setSearchQuery}
                    onTypeFilterChange={setTypeFilter}
                    searchQuery={searchQuery}
                    typeFilter={typeFilter}
                />
            }
        >
            <RecapChangeTable isLoading={isLoading} operatorNames={operatorNames} rows={rows} userNames={userNames} />
        </Dialog>
    )
}
export default RecapModalSection
