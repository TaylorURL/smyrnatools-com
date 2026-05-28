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

const PREFS_STORAGE_KEY = 'smyrnatools.listView.preferences'
const DEFAULT_PREFS = { groupBy: 'priority', layout: 'list' }

function readStoredPrefs() {
    if (typeof window === 'undefined') return DEFAULT_PREFS
    try {
        const raw = window.localStorage.getItem(PREFS_STORAGE_KEY)
        if (!raw) return DEFAULT_PREFS
        const parsed = JSON.parse(raw)
        return {
            groupBy: ['priority', 'status', 'date', 'role'].includes(parsed.groupBy)
                ? parsed.groupBy
                : DEFAULT_PREFS.groupBy,
            layout: ['list', 'board', 'activity'].includes(parsed.layout) ? parsed.layout : DEFAULT_PREFS.layout
        }
    } catch {
        return DEFAULT_PREFS
    }
}

/**
 * Task list view — the primary "tasks/to-do" surface. Combines an inline
 * quick-add input, a consolidated filter bar (layout · group · filters),
 * and the appropriate body render (grouped rows, kanban board, or activity
 * feed). Optimistic mutations from ListService land in the cache and emit
 * `list-items-changed`, which `useListData` listens for to re-render.
 *
 * @param {string} [title] - Page heading (defaults to "Tasks List").
 * @param {Function} onSelectItem - Called when a row is clicked to open the detail view.
 * @param {Function} [onStatusFilterChange] - Optional external callback for status filter sync.
 */
function ListView({ title = 'Tasks List', onSelectItem, onStatusFilterChange }) {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'
    const isMobile = useIsMobile()
    const headerRef = useRef(null)
    const searchInputRef = useRef(null)
    const bulkStatusRef = useRef(null)
    const bulkPriorityRef = useRef(null)

    const [searchText, setSearchText] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [selectedPlant, setSelectedPlant] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [roleFilter, setRoleFilter] = useState('')
    const initialPrefs = useMemo(() => readStoredPrefs(), [])
    const [groupBy, setGroupBy] = useState(initialPrefs.groupBy)
    const [layout, setLayout] = useState(initialPrefs.layout)
    const [showAddSheet, setShowAddSheet] = useState(false)
    const [addSheetSeed, setAddSheetSeed] = useState('')
    const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
    const [bulkPriorityOpen, setBulkPriorityOpen] = useState(false)

    useEffect(() => {
        if (typeof window === 'undefined') return
        try {
            window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ groupBy, layout }))
        } catch {}
    }, [groupBy, layout])

    const { isLoading: itemsLoading, plants, reload } = useListData()
    const { regionPlantCodes, regionPlants, regionReady } = useListRegion({
        regionCode: preferences?.selectedRegion?.code || '',
        selectedPlant,
        setSelectedPlant
    })
    const isLoading = itemsLoading || !regionReady

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
    const activeViewMode = layout === 'activity' ? 'activity' : groupBy
    const { activityFeed, activityLoading, activityProfiles } = useListActivityFeed(activeViewMode)

    const groupedItems =
        groupBy === 'date'
            ? groupedByDate
            : groupBy === 'status'
              ? groupedByStatus
              : groupBy === 'role'
                ? groupedByRole
                : groupedByPriority

    const summaryStats = useMemo(
        () => ({
            overdue: groupedByDate.overdue?.items?.length || 0,
            total: roleFilteredItems.length
        }),
        [roleFilteredItems, groupedByDate]
    )

    const openAddSheet = useCallback(() => {
        setAddSheetSeed('')
        setShowAddSheet(true)
    }, [])
    const openAddSheetWithSeed = useCallback((seed) => {
        setAddSheetSeed(seed || '')
        setShowAddSheet(true)
    }, [])
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

    const quickAddPlants = useMemo(() => {
        if (regionPlants.length) {
            return regionPlants.map((p) => ({
                plantCode: p.plantCode || p.plant_code,
                plantName: p.plantName || p.plant_name
            }))
        }
        return visiblePlants.map((p) => ({ plantCode: p.plant_code, plantName: p.plant_name }))
    }, [regionPlants, visiblePlants])

    const quickAddDefaultPlant = useMemo(() => {
        if (selectedPlant && !selectedPlant.startsWith('DISTRICT:')) return selectedPlant
        if (quickAddPlants.length === 1) return quickAddPlants[0].plantCode
        return ''
    }, [selectedPlant, quickAddPlants])

    const isActivity = layout === 'activity'
    const isBoard = layout === 'board'

    const quickAddProps = isActivity
        ? null
        : {
              accentColor,
              defaultPlantCode: quickAddDefaultPlant,
              onOpenAdvanced: openAddSheetWithSeed,
              plants: quickAddPlants
          }

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
                        onRoleFilterChange={handleRoleFilterChange}
                        onStatusFilterChange={handleStatusFilterChange}
                        onViewModeChange={setGroupBy}
                        quickAddProps={quickAddProps}
                        roleFilter={roleFilter}
                        statusFilter={statusFilter}
                        summaryStats={summaryStats}
                        viewMode={groupBy}
                    />
                }
            />
            <div className="relative">
                <div
                    className={`content-area overscroll-contain [-webkit-overflow-scrolling:touch] ${
                        isMobile ? 'p-3 pb-8' : 'px-8 pt-5 pb-8'
                    }`}
                >
                    {isLoading ? (
                        <TaskListSkeleton />
                    ) : filteredItems.length === 0 && !isActivity ? (
                        <ListEmptyState
                            accentColor={accentColor}
                            hasSearchOrPlant={!!(searchText || selectedPlant)}
                            onAddClick={openAddSheet}
                            onReset={showReset ? resetFilters : undefined}
                            statusFilter={statusFilter}
                        />
                    ) : isBoard ? (
                        <ListCardsBoard
                            accentColor={accentColor}
                            groupedByStatus={groupedByStatus}
                            isMobile={isMobile}
                            onSelectItem={onSelectItem}
                            onToggleSelect={toggleSelect}
                            selectedIds={selectedIds}
                            statusFilter={statusFilter}
                        />
                    ) : isActivity ? (
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
            {showAddSheet && (
                <ListAddView
                    initialDescription={addSheetSeed}
                    onClose={() => {
                        setShowAddSheet(false)
                        setAddSheetSeed('')
                    }}
                    onItemAdded={reload}
                />
            )}
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
