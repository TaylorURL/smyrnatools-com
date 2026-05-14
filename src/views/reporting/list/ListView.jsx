/* eslint-disable react/forbid-dom-props */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import ConfirmDialog from '../../../app/components/common/ConfirmDialog'
import ListActivityFeed from '../../../app/components/list/ListActivityFeed'
import ListBulkActionsBar from '../../../app/components/list/ListBulkActionsBar'
import ListCardsBoard from '../../../app/components/list/ListCardsBoard'
import ListEmptyState from '../../../app/components/list/ListEmptyState'
import ListFilterBar from '../../../app/components/list/ListFilterBar'
import ListFilterBarSkeleton from '../../../app/components/list/ListFilterBarSkeleton'
import ListGroupedItems from '../../../app/components/list/ListGroupedItems'
import TopSection from '../../../app/components/sections/TopSection'
import { TaskListSkeleton } from '../../../app/components/ui/AssetListSkeleton'
import { mapRoleValue, mapStatusValue, normalizeToUpperCase } from '../../../app/constants/listViewConstants'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useIsMobile } from '../../../app/hooks/useIsMobile'
import { useListActivityFeed } from '../../../app/hooks/useListActivityFeed'
import { useListBulkActions } from '../../../app/hooks/useListBulkActions'
import { useListData } from '../../../app/hooks/useListData'
import { useListGroups } from '../../../app/hooks/useListGroups'
import { useListKeyboardShortcuts } from '../../../app/hooks/useListKeyboardShortcuts'
import { useListRegion } from '../../../app/hooks/useListRegion'
import { ListService } from '../../../services/ListService'
import ListAddView from './ListAddView'

/**
 * Task list view with multiple grouping modes (by priority, status, date, or
 * role) plus an activity timeline. Supports region-scoped plant filtering,
 * bulk selection with complete / set-status / set-priority / delete actions,
 * Cmd+K (focus search) / Cmd+N (add task) shortcuts, and a sticky filter bar.
 *
 * @param {string} [title] - Page heading (defaults to "Tasks List").
 * @param {Function} onSelectItem - Callback when a task row is clicked.
 * @param {Function} [onStatusFilterChange] - Optional external callback for status filter sync.
 */
function ListView({ title = 'Tasks List', onSelectItem, onStatusFilterChange }) {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'
    const isMobile = useIsMobile()
    const headerRef = useRef(null)
    const searchInputRef = useRef(null)
    const statusDropdownRef = useRef(null)
    const roleDropdownRef = useRef(null)
    const bulkStatusRef = useRef(null)
    const bulkPriorityRef = useRef(null)

    const [searchText, setSearchText] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [selectedPlant, setSelectedPlant] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [roleFilter, setRoleFilter] = useState('')
    const [viewMode, setViewMode] = useState('priority')
    const [layout, setLayout] = useState('list')
    const [showAddSheet, setShowAddSheet] = useState(false)
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
    const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)
    const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
    const [bulkPriorityOpen, setBulkPriorityOpen] = useState(false)

    const { isLoading, plants, reload } = useListData()
    const { regionPlantCodes, regionPlants } = useListRegion({
        regionCode: preferences?.selectedRegion?.code || '',
        selectedPlant,
        setSelectedPlant
    })
    const {
        bulkToggleCompletion,
        bulkUpdatePriority,
        bulkUpdateStatus,
        cancelBulkDelete,
        clearSelection,
        confirmBulkDelete,
        requestBulkDelete,
        selectedIds,
        showDeleteConfirm,
        toggleSelect
    } = useListBulkActions()

    const districtPlantCodes = useMemo(() => {
        if (!selectedPlant?.startsWith('DISTRICT:')) return null
        const districtName = selectedPlant.slice(9)
        const codes = new Set()
        regionPlants.forEach((p) => {
            const code = p.plantCode || p.plant_code
            ;(p.districts || []).forEach((d) => {
                const name = typeof d === 'string' ? d : d?.name
                if (name === districtName) codes.add(code)
            })
        })
        return codes
    }, [selectedPlant, regionPlants])

    const effectivePlantCode = selectedPlant?.startsWith('DISTRICT:') ? '' : selectedPlant
    const baseFilteredItems = ListService.getFilteredItems({
        filterType: '',
        plantCode: effectivePlantCode,
        searchTerm: searchText,
        showCompleted: statusFilter === 'completed',
        statusFilter
    })

    const filteredItems = useMemo(() => {
        let items = baseFilteredItems
        if (regionPlantCodes?.size)
            items = items.filter((item) => regionPlantCodes.has(normalizeToUpperCase(item.plant_code)))
        if (districtPlantCodes) items = items.filter((item) => districtPlantCodes.has(item.plant_code))
        return items
    }, [baseFilteredItems, regionPlantCodes, districtPlantCodes])

    const roleFilteredItems = useMemo(
        () => (roleFilter ? filteredItems.filter((item) => item.responsible_role === roleFilter) : filteredItems),
        [filteredItems, roleFilter]
    )

    const { groupedByDate, groupedByPriority, groupedByRole, groupedByStatus } = useListGroups(roleFilteredItems)
    const { activityFeed, activityLoading, activityProfiles } = useListActivityFeed(viewMode)

    const groupedItems =
        viewMode === 'date'
            ? groupedByDate
            : viewMode === 'status'
              ? groupedByStatus
              : viewMode === 'priority'
                ? groupedByPriority
                : groupedByRole

    const summaryStats = useMemo(
        () => ({
            overdue: groupedByDate.overdue?.items?.length || 0,
            total: roleFilteredItems.length
        }),
        [roleFilteredItems, groupedByDate]
    )

    const openAddSheet = useCallback(() => setShowAddSheet(true), [])
    useListKeyboardShortcuts({ openAddSheet, searchInputRef })

    useEffect(() => {
        const updateHeight = () => {
            const h = headerRef.current ? Math.ceil(headerRef.current.getBoundingClientRect().height) : 0
            if (h) document.documentElement.style.setProperty('--top-section-height', `${h}px`)
        }
        updateHeight()
        window.addEventListener('resize', updateHeight)
        return () => window.removeEventListener('resize', updateHeight)
    }, [searchInput, selectedPlant, statusFilter])

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)) setStatusDropdownOpen(false)
            if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target)) setRoleDropdownOpen(false)
            if (bulkStatusRef.current && !bulkStatusRef.current.contains(e.target)) setBulkStatusOpen(false)
            if (bulkPriorityRef.current && !bulkPriorityRef.current.contains(e.target)) setBulkPriorityOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const visiblePlants = useMemo(() => {
        if (!Array.isArray(plants)) return []
        return regionPlantCodes?.size
            ? plants.filter((p) => regionPlantCodes.has(normalizeToUpperCase(p.plant_code)))
            : plants
    }, [plants, regionPlantCodes])

    const resetFilters = useCallback(() => {
        setSearchText('')
        setSearchInput('')
        setSelectedPlant('')
        setStatusFilter('')
        setRoleFilter('')
    }, [])

    const handleStatusFilterChange = useCallback(
        (value) => {
            const mapped = mapStatusValue(value)
            if (mapped) {
                setStatusFilter(mapped)
                onStatusFilterChange?.(mapped)
            }
            setStatusDropdownOpen(false)
        },
        [onStatusFilterChange]
    )

    const clearStatusFilter = useCallback(() => {
        setStatusFilter('')
        onStatusFilterChange?.('')
    }, [onStatusFilterChange])

    const handleRoleFilterChange = useCallback((value) => {
        const mapped = mapRoleValue(value)
        if (mapped) setRoleFilter(mapped)
        setRoleDropdownOpen(false)
    }, [])

    const toggleStatusDropdown = useCallback(() => {
        setStatusDropdownOpen((p) => !p)
        setRoleDropdownOpen(false)
    }, [])

    const toggleRoleDropdown = useCallback(() => {
        setRoleDropdownOpen((p) => !p)
        setStatusDropdownOpen(false)
    }, [])

    const toggleBulkStatus = useCallback(() => {
        setBulkStatusOpen((p) => !p)
        setBulkPriorityOpen(false)
    }, [])

    const toggleBulkPriority = useCallback(() => {
        setBulkPriorityOpen((p) => !p)
        setBulkStatusOpen(false)
    }, [])

    const handleBulkStatusChange = useCallback(
        (value) => {
            setBulkStatusOpen(false)
            bulkUpdateStatus(value)
        },
        [bulkUpdateStatus]
    )

    const handleBulkPriorityChange = useCallback(
        (value) => {
            setBulkPriorityOpen(false)
            bulkUpdatePriority(value)
        },
        [bulkUpdatePriority]
    )

    const showReset = !!(searchText || selectedPlant || statusFilter || roleFilter)
    const plantsProp = regionPlants.length
        ? regionPlants.map((p) => ({
              districts: p.districts,
              plantCode: p.plantCode || p.plant_code,
              plantName: p.plantName || p.plant_name
          }))
        : visiblePlants.map((p) => ({ plantCode: p.plant_code, plantName: p.plant_name }))

    return (
        <div className="global-dashboard-container dashboard-container global-flush-top flush-top list-view bg-bg-secondary min-h-full relative w-full">
            <TopSection
                isLoading={isLoading}
                title={title}
                addButtonLabel="Add Item"
                onAddClick={openAddSheet}
                searchInput={searchInput}
                onSearchInputChange={(v) => {
                    setSearchInput(v)
                    setSearchText(v)
                }}
                onClearSearch={() => {
                    setSearchInput('')
                    setSearchText('')
                }}
                searchPlaceholder="Search by description or comments..."
                plants={plantsProp}
                regionPlantCodes={regionPlantCodes}
                selectedPlant={selectedPlant}
                onSelectedPlantChange={setSelectedPlant}
                showReset={showReset}
                onReset={resetFilters}
                forwardedRef={headerRef}
                sticky={true}
                hideViewModeToggle={true}
                customBottomSkeleton={<ListFilterBarSkeleton isMobile={isMobile} />}
                customBottomContent={
                    <ListFilterBar
                        accentColor={accentColor}
                        isMobile={isMobile}
                        layout={layout}
                        onClearRoleFilter={() => setRoleFilter('')}
                        onClearStatusFilter={clearStatusFilter}
                        onLayoutChange={setLayout}
                        onRoleDropdownToggle={toggleRoleDropdown}
                        onRoleFilterChange={handleRoleFilterChange}
                        onStatusDropdownToggle={toggleStatusDropdown}
                        onStatusFilterChange={handleStatusFilterChange}
                        onViewModeChange={setViewMode}
                        roleDropdownOpen={roleDropdownOpen}
                        roleDropdownRef={roleDropdownRef}
                        roleFilter={roleFilter}
                        statusDropdownOpen={statusDropdownOpen}
                        statusDropdownRef={statusDropdownRef}
                        statusFilter={statusFilter}
                        summaryStats={summaryStats}
                        viewMode={viewMode}
                    />
                }
            />
            <div className="relative">
                <div
                    className={`content-area overscroll-contain [-webkit-overflow-scrolling:touch] ${
                        isMobile ? 'p-4 pb-8' : 'px-8 pt-6 pb-8'
                    }`}
                >
                    {isLoading ? (
                        <TaskListSkeleton />
                    ) : filteredItems.length === 0 ? (
                        <ListEmptyState
                            accentColor={accentColor}
                            hasSearchOrPlant={!!(searchText || selectedPlant)}
                            onAddClick={openAddSheet}
                            statusFilter={statusFilter}
                        />
                    ) : layout === 'cards' ? (
                        <ListCardsBoard
                            accentColor={accentColor}
                            groupedByStatus={groupedByStatus}
                            isMobile={isMobile}
                            onSelectItem={onSelectItem}
                            onToggleSelect={toggleSelect}
                            selectedIds={selectedIds}
                            statusFilter={statusFilter}
                        />
                    ) : viewMode === 'activity' ? (
                        <ListActivityFeed
                            accentColor={accentColor}
                            activityFeed={activityFeed}
                            activityLoading={activityLoading}
                            activityProfiles={activityProfiles}
                            isMobile={isMobile}
                            onSelectItem={onSelectItem}
                        />
                    ) : (
                        <ListGroupedItems
                            accentColor={accentColor}
                            groupedItems={groupedItems}
                            isMobile={isMobile}
                            onSelectItem={onSelectItem}
                            onToggleSelect={toggleSelect}
                            selectedIds={selectedIds}
                            statusFilter={statusFilter}
                        />
                    )}
                </div>
            </div>
            <ListBulkActionsBar
                accentColor={accentColor}
                bulkPriorityOpen={bulkPriorityOpen}
                bulkPriorityRef={bulkPriorityRef}
                bulkStatusOpen={bulkStatusOpen}
                bulkStatusRef={bulkStatusRef}
                isMobile={isMobile}
                onBulkComplete={() => bulkToggleCompletion(true)}
                onBulkDelete={requestBulkDelete}
                onBulkUpdatePriority={handleBulkPriorityChange}
                onBulkUpdateStatus={handleBulkStatusChange}
                onCancel={clearSelection}
                onTogglePriority={toggleBulkPriority}
                onToggleStatus={toggleBulkStatus}
                selectedCount={selectedIds.size}
            />
            {showAddSheet && <ListAddView onClose={() => setShowAddSheet(false)} onItemAdded={reload} />}
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onConfirm={confirmBulkDelete}
                onCancel={cancelBulkDelete}
                title={`Delete ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''}?`}
                message="This action cannot be undone. The selected tasks will be permanently removed."
                confirmLabel="Delete"
                variant="danger"
            />
        </div>
    )
}

export default ListView
