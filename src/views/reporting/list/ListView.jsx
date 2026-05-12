import React, { useEffect, useMemo, useRef, useState } from 'react'

import ConfirmDialog from '../../../app/components/common/ConfirmDialog'
import TopSection from '../../../app/components/sections/TopSection'
import { TaskListSkeleton } from '../../../app/components/ui/AssetListSkeleton'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useIsMobile } from '../../../app/hooks/useIsMobile'
import { ListService } from '../../../services/ListService'
import { PlantService } from '../../../services/PlantService'
import { UserService } from '../../../services/UserService'
import ListAddView from './ListAddView'

/** Maps internal status keys to their user-facing display labels. */
const STATUS_MAP = {
    blocked: 'Blocked',
    completed: 'Completed',
    in_progress: 'In Progress',
    ordered_materials: 'Ordered Materials',
    overdue: 'Overdue',
    pending: 'Pending',
    waiting: 'Waiting'
}
const STATUS_OPTIONS = ['Pending', 'In Progress', 'Ordered Materials', 'Blocked', 'Waiting', 'Overdue', 'Completed']
/** Maps internal role keys to their user-facing display labels. */
const ROLE_MAP = {
    district_manager: 'District Manager',
    maintenance: 'Maintenance',
    plant_manager: 'Plant Manager',
    unassigned: 'Unassigned'
}
const ROLE_OPTIONS = ['Maintenance', 'Plant Manager', 'District Manager', 'Unassigned']
/** Available grouping modes for the task list with icons for the toggle bar. */
const VIEW_MODES = [
    { icon: 'fa-flag', id: 'priority', label: 'Priority' },
    { icon: 'fa-layer-group', id: 'status', label: 'Status' },
    { icon: 'fa-calendar-alt', id: 'date', label: 'Date' },
    { icon: 'fa-user', id: 'role', label: 'Role' },
    { icon: 'fa-history', id: 'activity', label: 'Activity' }
]
const STATUS_COLORS = {
    blocked: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
    completed: { bg: 'rgba(22,163,74,0.1)', border: 'rgba(22,163,74,0.3)', text: '#16a34a' },
    in_progress: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: '#3b82f6' },
    ordered_materials: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: '#3b82f6' },
    overdue: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
    pending: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b' },
    waiting: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b' }
}
const BULK_ACTION_COLORS = {
    cancel: { bg: 'var(--bg-secondary)', hover: 'var(--border-light)', text: 'var(--text-secondary)' },
    complete: { bg: 'rgba(22,163,74,0.1)', hover: 'rgba(22,163,74,0.2)', text: '#16a34a' },
    delete: { bg: 'rgba(239,68,68,0.1)', hover: 'rgba(239,68,68,0.2)', text: '#ef4444' },
    neutral: { bg: 'rgba(59,130,246,0.1)', hover: 'rgba(59,130,246,0.2)', text: '#3b82f6' }
}
const BULK_STATUS_OPTIONS = [
    { label: 'Pending', value: 'pending' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Ordered Materials', value: 'ordered_materials' },
    { label: 'Waiting', value: 'waiting' },
    { label: 'Blocked', value: 'blocked' }
]
const mapStatusValue = (value) => {
    const lower = value?.toLowerCase()
    return Object.entries(STATUS_MAP).find(([_k, v]) => v.toLowerCase() === lower)?.[0] || ''
}
const mapRoleValue = (value) => Object.entries(ROLE_MAP).find(([_k, v]) => v === value)?.[0] || ''
const normalizeToUpperCase = (str) =>
    String(str || '')
        .trim()
        .toUpperCase()
/**
 * Task list view with multiple grouping modes (by status, date, role, or
 * weekly planner). Supports region-scoped plant filtering, bulk selection
 * with complete/delete actions, keyboard shortcuts (Cmd+K search, Cmd+N add),
 * and a sticky filter bar with status/role chip filters.
 *
 * @param {string} [title] - Page heading (defaults to "Tasks List").
 * @param {Function} onSelectItem - Callback when a task row is clicked.
 * @param {Function} [onStatusFilterChange] - Optional external callback for status filter sync.
 */
function ListView({ title = 'Tasks List', onSelectItem, onStatusFilterChange }) {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'
    const headerRef = useRef(null)
    const searchInputRef = useRef(null)
    const [plants, setPlants] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchText, setSearchText] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [selectedPlant, setSelectedPlant] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [showAddSheet, setShowAddSheet] = useState(false)
    const [regionPlantCodes, setRegionPlantCodes] = useState(null)
    const [regionPlants, setRegionPlants] = useState([])
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [viewMode, setViewMode] = useState('priority')
    const [roleFilter, setRoleFilter] = useState('')
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
    const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)
    const statusDropdownRef = useRef(null)
    const roleDropdownRef = useRef(null)
    const isMobile = useIsMobile()
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
    /** Buckets tasks into time-relative groups: Overdue, Today, Tomorrow, This Week, Later, Completed. */
    const groupedByDate = useMemo(() => {
        const groups = {
            completed: { color: 'success', icon: 'fa-check-circle', items: [], label: 'Completed', priority: 6 },
            later: { color: 'secondary', icon: 'fa-calendar-alt', items: [], label: 'Later', priority: 5 },
            overdue: { color: 'danger', icon: 'fa-exclamation-circle', items: [], label: 'Overdue', priority: 3 },
            thisWeek: { color: 'accent', icon: 'fa-calendar-week', items: [], label: 'This Week', priority: 4 },
            today: { color: 'warning', icon: 'fa-calendar-day', items: [], label: 'Today', priority: 1 },
            tomorrow: { color: 'info', icon: 'fa-calendar-plus', items: [], label: 'Tomorrow', priority: 2 }
        }
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const endOfWeek = new Date(today)
        endOfWeek.setDate(endOfWeek.getDate() + (7 - today.getDay()))
        roleFilteredItems.forEach((item) => {
            if (item.completed || item.status === 'completed') {
                groups.completed.items.push(item)
                return
            }
            const deadline = new Date(item.deadline)
            deadline.setHours(0, 0, 0, 0)
            if (deadline < today || item.status === 'overdue') groups.overdue.items.push(item)
            else if (deadline.getTime() === today.getTime()) groups.today.items.push(item)
            else if (deadline.getTime() === tomorrow.getTime()) groups.tomorrow.items.push(item)
            else if (deadline <= endOfWeek) groups.thisWeek.items.push(item)
            else groups.later.items.push(item)
        })
        Object.values(groups).forEach((g) => g.items.sort((a, b) => new Date(a.deadline) - new Date(b.deadline)))
        return groups
    }, [roleFilteredItems])
    /**
     * Groups tasks by workflow status. Items past deadline that are not in an
     * active-work status (in_progress, blocked, waiting, ordered_materials)
     * are promoted to the Overdue group instead.
     */
    const groupedByStatus = useMemo(() => {
        const groups = {
            blocked: { color: 'danger', icon: 'fa-ban', items: [], label: 'Blocked', priority: 3 },
            completed: { color: 'success', icon: 'fa-check-circle', items: [], label: 'Completed', priority: 7 },
            in_progress: { color: 'accent', icon: 'fa-spinner', items: [], label: 'In Progress', priority: 2 },
            ordered_materials: {
                color: 'info',
                icon: 'fa-truck-loading',
                items: [],
                label: 'Ordered Materials',
                priority: 5
            },
            overdue: { color: 'danger', icon: 'fa-exclamation-circle', items: [], label: 'Overdue', priority: 1 },
            pending: { color: 'secondary', icon: 'fa-clock', items: [], label: 'Pending', priority: 6 },
            waiting: { color: 'warning', icon: 'fa-hourglass-half', items: [], label: 'Waiting', priority: 4 }
        }
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const activeStatuses = ['in_progress', 'blocked', 'waiting', 'ordered_materials']
        roleFilteredItems.forEach((item) => {
            if (item.completed || item.status === 'completed') {
                groups.completed.items.push(item)
                return
            }
            const deadline = new Date(item.deadline)
            deadline.setHours(0, 0, 0, 0)
            const isOverdue = deadline < today && !activeStatuses.includes(item.status)
            if (isOverdue) groups.overdue.items.push(item)
            else if (groups[item.status]) groups[item.status].items.push(item)
            else groups.pending.items.push(item)
        })
        Object.values(groups).forEach((g) => g.items.sort((a, b) => new Date(a.deadline) - new Date(b.deadline)))
        return groups
    }, [roleFilteredItems])
    /** Groups open (non-completed) tasks by responsible role. */
    const groupedByRole = useMemo(() => {
        const groups = {
            district_manager: {
                color: 'accent',
                icon: 'fa-user-shield',
                items: [],
                label: 'District Manager',
                priority: 1
            },
            maintenance: { color: 'warning', icon: 'fa-wrench', items: [], label: 'Maintenance', priority: 3 },
            plant_manager: { color: 'info', icon: 'fa-user-tie', items: [], label: 'Plant Manager', priority: 2 },
            unassigned: { color: 'secondary', icon: 'fa-users', items: [], label: 'Unassigned', priority: 4 }
        }
        roleFilteredItems
            .filter((item) => !item.completed && item.status !== 'completed')
            .forEach((item) => {
                const role = item.responsible_role || 'unassigned'
                ;(groups[role] ?? groups.unassigned).items.push(item)
            })
        Object.values(groups).forEach((g) => g.items.sort((a, b) => new Date(a.deadline) - new Date(b.deadline)))
        return groups
    }, [roleFilteredItems])
    /** Groups open (non-completed) tasks by priority level. */
    const groupedByPriority = useMemo(() => {
        const groups = {
            high: { color: 'warning', icon: 'fa-arrow-up', items: [], label: 'High', priority: 2 },
            low: { color: 'info', icon: 'fa-arrow-down', items: [], label: 'Low', priority: 4 },
            medium: { color: 'accent', icon: 'fa-minus', items: [], label: 'Medium', priority: 3 },
            none: { color: 'secondary', icon: 'fa-minus', items: [], label: 'No Priority', priority: 5 },
            urgent: { color: 'danger', icon: 'fa-fire', items: [], label: 'Urgent', priority: 1 }
        }
        roleFilteredItems
            .filter((item) => !item.completed && item.status !== 'completed')
            .forEach((item) => {
                const p = item.priority || 'none'
                ;(groups[p] ?? groups.none).items.push(item)
            })
        Object.values(groups).forEach((g) => g.items.sort((a, b) => new Date(a.deadline) - new Date(b.deadline)))
        return groups
    }, [roleFilteredItems])
    const [activityFeed, setActivityFeed] = useState([])
    const [activityProfiles, setActivityProfiles] = useState({})
    const [activityLoading, setActivityLoading] = useState(false)
    useEffect(() => {
        if (viewMode !== 'activity') return
        let cancelled = false
        const loadActivity = async () => {
            setActivityLoading(true)
            try {
                const { entries, profiles } = await ListService.fetchActivityFeed({ limit: 100 })
                if (cancelled) return
                setActivityFeed(entries)
                setActivityProfiles(profiles)
            } catch {
                if (!cancelled) setActivityFeed([])
            } finally {
                if (!cancelled) setActivityLoading(false)
            }
        }
        loadActivity()
        return () => {
            cancelled = true
        }
    }, [viewMode])
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
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true)
            try {
                await Promise.all([ListService.fetchListItems(), ListService.fetchPlants()])
                setPlants(ListService.plants)
            } finally {
                setIsLoading(false)
            }
        }
        loadData()
    }, [])
    useEffect(() => {
        let cancelled = false
        const fetchRegionData = async () => {
            const regionCode = preferences?.selectedRegion?.code || ''
            try {
                const [codes, rPlants] = await Promise.all([
                    PlantService.getAllowedPlantCodes(regionCode),
                    regionCode ? PlantService.fetchRegionPlants(regionCode).catch(() => []) : Promise.resolve([])
                ])
                if (cancelled) return
                setRegionPlantCodes(codes)
                setRegionPlants(rPlants)
                if (
                    selectedPlant &&
                    !selectedPlant.startsWith('DISTRICT:') &&
                    codes &&
                    !codes.has(normalizeToUpperCase(selectedPlant))
                )
                    setSelectedPlant('')
            } catch {
                if (!cancelled) setRegionPlantCodes(null)
            }
        }
        fetchRegionData()
        return () => {
            cancelled = true
        }
    }, [preferences?.selectedRegion?.code, selectedPlant])
    useEffect(() => {
        if (!selectedPlant || selectedPlant.startsWith('DISTRICT:') || !regionPlantCodes?.size) return
        if (!regionPlantCodes.has(normalizeToUpperCase(selectedPlant))) setSelectedPlant('')
    }, [regionPlantCodes, selectedPlant])
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.metaKey && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                searchInputRef.current?.focus()
            }
            if (e.metaKey && e.key.toLowerCase() === 'n') {
                e.preventDefault()
                setShowAddSheet(true)
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])
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
    const toggleSelect = (id) =>
        setSelectedIds((prev) => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    /** Marks all selected items as complete (or incomplete) in sequence, then clears the selection. */
    const bulkToggleCompletion = async (markComplete) => {
        if (!selectedIds.size) return
        const user = await UserService.getCurrentUser()
        if (!user?.id) return
        const itemsById = new Map(ListService.listItems.map((i) => [i.id, i]))
        for (const id of selectedIds) {
            const item = itemsById.get(id)
            if (!item || (markComplete ? item.completed : !item.completed)) continue
            try {
                await ListService.toggleCompletion(item, user.id)
            } catch {}
        }
        setSelectedIds(new Set())
    }
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
    const [bulkPriorityOpen, setBulkPriorityOpen] = useState(false)
    const bulkStatusRef = useRef(null)
    const bulkPriorityRef = useRef(null)
    const bulkDelete = () => {
        if (!selectedIds.size) return
        setShowDeleteConfirm(true)
    }
    const confirmBulkDelete = async () => {
        setShowDeleteConfirm(false)
        for (const id of selectedIds) {
            try {
                await ListService.deleteListItem(id)
            } catch {}
        }
        setSelectedIds(new Set())
    }
    /** Updates status on all selected items, then clears selection. */
    const bulkUpdateStatus = async (newStatus) => {
        setBulkStatusOpen(false)
        const itemsById = new Map(ListService.listItems.map((i) => [i.id, i]))
        for (const id of selectedIds) {
            const item = itemsById.get(id)
            if (!item || item.status === newStatus) continue
            try {
                await ListService.updateListItem({ ...item, status: newStatus })
            } catch {}
        }
        setSelectedIds(new Set())
    }
    /** Updates priority on all selected items, then clears selection. */
    const bulkUpdatePriority = async (newPriority) => {
        setBulkPriorityOpen(false)
        const itemsById = new Map(ListService.listItems.map((i) => [i.id, i]))
        for (const id of selectedIds) {
            const item = itemsById.get(id)
            if (!item || item.priority === newPriority) continue
            try {
                await ListService.updateListItem({ ...item, priority: newPriority })
            } catch {}
        }
        setSelectedIds(new Set())
    }
    const resetFilters = () => {
        setSearchText('')
        setSearchInput('')
        setSelectedPlant('')
        setStatusFilter('')
        setRoleFilter('')
    }
    const handleStatusFilterChange = (value) => {
        const mapped = mapStatusValue(value)
        if (mapped) {
            setStatusFilter(mapped)
            onStatusFilterChange?.(mapped)
        }
    }
    const clearStatusFilter = () => {
        setStatusFilter('')
        onStatusFilterChange?.('')
    }
    const handleRoleFilterChange = (value) => {
        const mapped = mapRoleValue(value)
        if (mapped) setRoleFilter(mapped)
    }
    const getItemStatusStyle = (statusType, _mobile) => {
        const color = STATUS_COLORS[statusType] || STATUS_COLORS.pending
        return {
            background: color.bg,
            border: `1px solid ${color.border}`,
            color: color.text
        }
    }
    const getBulkButtonStyle = (type) => {
        const color = BULK_ACTION_COLORS[type] || BULK_ACTION_COLORS.cancel
        return {
            background: color.bg,
            color: color.text
        }
    }
    const showReset = !!(searchText || selectedPlant || statusFilter || roleFilter)
    const statusDisplayValue = STATUS_MAP[statusFilter] || 'All Statuses'
    const roleDisplayValue = ROLE_MAP[roleFilter] || 'All Roles'
    const _selectBgImage = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`
    return (
        <div className="global-dashboard-container dashboard-container global-flush-top flush-top list-view bg-bg-secondary min-h-full relative w-full">
            <TopSection
                isLoading={isLoading}
                title={title}
                addButtonLabel="Add Item"
                onAddClick={() => setShowAddSheet(true)}
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
                plants={
                    regionPlants.length
                        ? regionPlants.map((p) => ({
                              districts: p.districts,
                              plantCode: p.plantCode || p.plant_code,
                              plantName: p.plantName || p.plant_name
                          }))
                        : visiblePlants.map((p) => ({ plantCode: p.plant_code, plantName: p.plant_name }))
                }
                regionPlantCodes={regionPlantCodes}
                selectedPlant={selectedPlant}
                onSelectedPlantChange={setSelectedPlant}
                showReset={showReset}
                onReset={resetFilters}
                forwardedRef={headerRef}
                sticky={true}
                hideViewModeToggle={true}
                customBottomSkeleton={
                    <div className="flex items-center gap-2 bg-bg-secondary border-t border-border-light -mx-7 mt-4 -mb-6 px-7 py-3">
                        {[72, 56, 64, 80].map((w, i) => (
                            <div
                                key={i}
                                className="h-[30px] rounded-md bg-slate-200 animate-pulse"
                                style={{ width: `${w}px` }}
                            />
                        ))}
                        <div className="h-5 w-px bg-slate-200 mx-1" />
                        <div className="h-[30px] w-[80px] rounded-md bg-slate-100 animate-pulse" />
                        <div className="h-[30px] w-[80px] rounded-md bg-slate-100 animate-pulse" />
                        {!isMobile && <div className="flex-1" />}
                        <div className="h-[24px] w-[60px] rounded-md bg-slate-100 animate-pulse ml-auto" />
                    </div>
                }
                customBottomContent={
                    <div className="flex items-center flex-wrap gap-2 bg-bg-secondary border border-border-light rounded-[10px] px-3.5 py-2.5">
                        <div className="flex items-center gap-1.5">
                            {VIEW_MODES.map((mode) => (
                                <button
                                    key={mode.id}
                                    onClick={() => setViewMode(mode.id)}
                                    className={`flex items-center rounded-md text-xs font-medium gap-1.5 px-3 py-1.5 cursor-pointer ${
                                        viewMode === mode.id
                                            ? 'bg-gray-900 text-white border-none'
                                            : 'bg-transparent text-gray-500 border border-border-light'
                                    }`}
                                >
                                    <i className={`fas ${mode.icon} text-[11px]`} />
                                    {mode.label}
                                </button>
                            ))}
                        </div>
                        <div className="h-5 w-px bg-[var(--border-light)]" />
                        {statusFilter ? (
                            <button
                                onClick={clearStatusFilter}
                                className="flex items-center rounded-md text-xs font-medium gap-1.5 px-2.5 py-1.5 cursor-pointer"
                                style={{
                                    background: `${accentColor}10`,
                                    border: `1px solid ${accentColor}30`,
                                    color: accentColor
                                }}
                            >
                                {statusDisplayValue}
                                <i className="fas fa-times text-[10px] opacity-70" />
                            </button>
                        ) : (
                            <div className="relative" ref={statusDropdownRef}>
                                <button
                                    onClick={() => {
                                        setStatusDropdownOpen((p) => !p)
                                        setRoleDropdownOpen(false)
                                    }}
                                    className={`flex items-center rounded cursor-pointer font-medium transition-all duration-150 ${
                                        isMobile ? 'text-[11px] gap-1 px-2 py-[5px]' : 'text-xs gap-1.5 px-2.5 py-1.5'
                                    } text-text-secondary`}
                                    style={{
                                        background: statusDropdownOpen ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                                        border: statusDropdownOpen
                                            ? `1px solid ${accentColor}50`
                                            : '1px solid var(--border-light)'
                                    }}
                                >
                                    <i className="fas fa-filter text-[9px] opacity-60" />
                                    {isMobile ? '+Status' : '+ Status'}
                                    <i
                                        className={`fas fa-chevron-down text-[8px] opacity-50 transition-transform duration-150 ${statusDropdownOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                {statusDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1.5 z-50 rounded shadow-lg overflow-hidden min-w-[180px] animate-filter-fade bg-bg-primary border border-border-light">
                                        <div className="p-1.5">
                                            {STATUS_OPTIONS.map((opt) => {
                                                const key = Object.keys(STATUS_MAP).find((k) => STATUS_MAP[k] === opt)
                                                const color = STATUS_COLORS[key] || STATUS_COLORS.pending
                                                return (
                                                    <button
                                                        key={opt}
                                                        onClick={() => {
                                                            handleStatusFilterChange(opt)
                                                            setStatusDropdownOpen(false)
                                                        }}
                                                        className="flex items-center gap-2.5 w-full rounded px-3 py-2 text-xs font-medium cursor-pointer transition-all duration-100 border-none bg-transparent text-text-primary"
                                                        onMouseEnter={(e) =>
                                                            (e.currentTarget.style.background = 'var(--bg-secondary)')
                                                        }
                                                        onMouseLeave={(e) =>
                                                            (e.currentTarget.style.background = 'transparent')
                                                        }
                                                    >
                                                        <span
                                                            className="flex items-center justify-center h-5 w-5 rounded-md text-[9px]"
                                                            style={{ background: color.bg, color: color.text }}
                                                        >
                                                            <i className={`fas ${ListService.getStatusIcon(key)}`} />
                                                        </span>
                                                        {opt}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {roleFilter ? (
                            <button
                                onClick={() => setRoleFilter('')}
                                className="flex items-center rounded-md text-xs font-medium gap-1.5 px-2.5 py-1.5 cursor-pointer"
                                style={{
                                    background: `${accentColor}10`,
                                    border: `1px solid ${accentColor}30`,
                                    color: accentColor
                                }}
                            >
                                {roleDisplayValue}
                                <i className="fas fa-times text-[10px] opacity-70" />
                            </button>
                        ) : (
                            <div className="relative" ref={roleDropdownRef}>
                                <button
                                    onClick={() => {
                                        setRoleDropdownOpen((p) => !p)
                                        setStatusDropdownOpen(false)
                                    }}
                                    className={`flex items-center rounded cursor-pointer font-medium transition-all duration-150 ${
                                        isMobile ? 'text-[11px] gap-1 px-2 py-[5px]' : 'text-xs gap-1.5 px-2.5 py-1.5'
                                    } text-text-secondary`}
                                    style={{
                                        background: roleDropdownOpen ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                                        border: roleDropdownOpen
                                            ? `1px solid ${accentColor}50`
                                            : '1px solid var(--border-light)'
                                    }}
                                >
                                    <i className="fas fa-user text-[9px] opacity-60" />
                                    {isMobile ? '+Role' : '+ Assigned'}
                                    <i
                                        className={`fas fa-chevron-down text-[8px] opacity-50 transition-transform duration-150 ${roleDropdownOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                {roleDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1.5 z-50 rounded shadow-lg overflow-hidden min-w-[170px] animate-filter-fade bg-bg-primary border border-border-light">
                                        <div className="p-1.5">
                                            {ROLE_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt}
                                                    onClick={() => {
                                                        handleRoleFilterChange(opt)
                                                        setRoleDropdownOpen(false)
                                                    }}
                                                    className="flex items-center gap-2.5 w-full rounded px-3 py-2 text-xs font-medium cursor-pointer transition-all duration-100 border-none bg-transparent text-text-primary"
                                                    onMouseEnter={(e) =>
                                                        (e.currentTarget.style.background = 'var(--bg-secondary)')
                                                    }
                                                    onMouseLeave={(e) =>
                                                        (e.currentTarget.style.background = 'transparent')
                                                    }
                                                >
                                                    <span className="flex items-center justify-center h-5 w-5 rounded-md text-[9px] bg-bg-tertiary text-text-secondary">
                                                        <i className="fas fa-user" />
                                                    </span>
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {!isMobile && <div className="flex-1" />}
                        <div className={`flex items-center ${isMobile ? 'gap-2 ml-auto' : 'gap-3'}`}>
                            {summaryStats.overdue > 0 && (
                                <div
                                    className={`flex items-center animate-pulse bg-red-50 rounded-md text-red-600 font-semibold ${
                                        isMobile ? 'text-[10px] gap-1 px-1.5 py-1' : 'text-xs gap-1.5 px-2.5 py-1.5'
                                    }`}
                                >
                                    <i
                                        className={`fas fa-exclamation-circle ${isMobile ? 'text-[9px]' : 'text-[11px]'}`}
                                    />
                                    {summaryStats.overdue}
                                    {isMobile ? '' : ' overdue'}
                                </div>
                            )}
                            <span className={`text-gray-400 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
                                <span className="text-gray-900 font-semibold">{summaryStats.total}</span>{' '}
                                {isMobile ? '' : 'tasks'}
                            </span>
                        </div>
                    </div>
                }
            />
            <div className="relative">
                <div
                    className={`content-area overscroll-contain [-webkit-overflow-scrolling:touch] ${isMobile ? 'p-4 pb-8' : 'px-8 pt-6 pb-8'}`}
                >
                    {isLoading ? (
                        <TaskListSkeleton />
                    ) : filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center mx-auto max-w-[600px] px-8 py-16 text-center">
                            <div className="text-text-tertiary text-[4rem] mb-6">
                                <i className="fas fa-clipboard-list" />
                            </div>
                            <h3 className="text-text-primary text-xl font-bold mb-2 m-0">
                                {statusFilter === 'completed' ? 'No Completed Items Found' : 'No List Items Found'}
                            </h3>
                            <p className="text-text-secondary text-[0.9375rem] mb-6 m-0">
                                {searchText || selectedPlant
                                    ? 'No items match your search criteria.'
                                    : statusFilter === 'completed'
                                      ? 'There are no completed items to show.'
                                      : 'There are no items in the list yet.'}
                            </p>
                            <button
                                onClick={() => setShowAddSheet(true)}
                                className="flex items-center border-none rounded text-white cursor-pointer text-sm font-semibold gap-2 outline-none px-5 py-2.5 transition-all duration-200"
                                style={{ background: accentColor }}
                            >
                                <i className="fas fa-plus" />
                                <span>Add Item</span>
                            </button>
                        </div>
                    ) : viewMode === 'activity' ? (
                        <div className={`flex flex-col w-full ${isMobile ? 'pb-6' : 'pb-8'}`}>
                            <div className="bg-bg-primary border border-border-light overflow-hidden rounded">
                                <div
                                    className={`bg-bg-secondary border-b border-border-light ${isMobile ? 'px-4 py-3' : 'px-6 py-4'}`}
                                >
                                    <div
                                        className={`flex items-center text-text-primary font-bold ${isMobile ? 'text-sm gap-2' : 'text-base gap-3'}`}
                                    >
                                        <i className="fas fa-history" style={{ color: accentColor }} />
                                        <span>Recent Activity</span>
                                        {!activityLoading && (
                                            <span
                                                className={`inline-flex items-center justify-center rounded text-white font-bold px-2 ${
                                                    isMobile
                                                        ? 'text-[0.6875rem] h-5 min-w-[20px]'
                                                        : 'text-xs h-6 min-w-[24px]'
                                                }`}
                                                style={{ background: accentColor }}
                                            >
                                                {activityFeed.length}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    {activityLoading ? (
                                        <div className="flex flex-col">
                                            {[...Array(6)].map((_, i) => (
                                                <div
                                                    key={i}
                                                    className={`flex border-b border-border-light ${isMobile ? 'gap-3 px-4 py-3' : 'gap-4 px-6 py-4'}`}
                                                >
                                                    <div
                                                        className={`rounded-full bg-slate-200 animate-pulse shrink-0 ${isMobile ? 'h-7 w-7' : 'h-8 w-8'}`}
                                                    />
                                                    <div className="flex flex-1 flex-col gap-2">
                                                        <div className="h-4 w-3/4 rounded bg-slate-200 animate-pulse" />
                                                        <div className="h-3 w-1/3 rounded bg-slate-100 animate-pulse" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : activityFeed.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <div className="text-text-tertiary text-3xl mb-3">
                                                <i className="fas fa-stream" />
                                            </div>
                                            <p className="text-text-secondary text-sm m-0">No activity recorded yet</p>
                                        </div>
                                    ) : (
                                        activityFeed.map((entry, index) => {
                                            const display = ListService.getActivityDisplay(
                                                entry.action,
                                                entry.field_name
                                            )
                                            const actorName = ListService.getProfileName(
                                                entry.user_id,
                                                activityProfiles
                                            )
                                            const iconColor =
                                                display.color === 'accentColor' ? accentColor : display.color
                                            const hasValueChange =
                                                entry.action === 'updated' && (entry.old_value || entry.new_value)
                                            return (
                                                <div
                                                    key={entry.id || `${entry.action}-${index}`}
                                                    onClick={() =>
                                                        entry.list_item_id && onSelectItem(entry.list_item_id)
                                                    }
                                                    className={`flex border-b border-border-light cursor-pointer transition-all duration-200 ${
                                                        isMobile ? 'gap-3 px-4 py-3' : 'gap-4 px-6 py-4'
                                                    } bg-bg-primary`}
                                                    onMouseEnter={(e) =>
                                                        (e.currentTarget.style.background = 'var(--bg-secondary)')
                                                    }
                                                    onMouseLeave={(e) =>
                                                        (e.currentTarget.style.background = 'var(--bg-primary)')
                                                    }
                                                >
                                                    <div className="flex items-start pt-0.5">
                                                        <div
                                                            className={`flex items-center justify-center rounded-full shrink-0 ${isMobile ? 'h-7 w-7' : 'h-8 w-8'}`}
                                                            style={{ background: `${iconColor}15`, color: iconColor }}
                                                        >
                                                            <i
                                                                className={`fas ${display.icon} ${isMobile ? 'text-[10px]' : 'text-xs'}`}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div
                                                        className={`flex flex-1 flex-col min-w-0 ${isMobile ? 'gap-1' : 'gap-1.5'}`}
                                                    >
                                                        <p
                                                            className={`m-0 ${isMobile ? 'text-xs' : 'text-[0.8125rem]'}`}
                                                        >
                                                            <span className="text-text-primary font-semibold">
                                                                {actorName}
                                                            </span>
                                                            <span className="text-text-secondary">{` ${display.verb} `}</span>
                                                            <span className="text-text-primary font-medium">
                                                                {ListService.truncateText(
                                                                    entry.item_description || 'an item',
                                                                    60
                                                                )}
                                                            </span>
                                                        </p>
                                                        {hasValueChange && (
                                                            <div
                                                                className={`flex items-center gap-1.5 ${isMobile ? 'text-[0.625rem]' : 'text-xs'}`}
                                                            >
                                                                <span className="text-text-tertiary bg-bg-tertiary rounded px-1.5 py-0.5 line-through">
                                                                    {ListService.formatActivityValue(
                                                                        entry.field_name,
                                                                        entry.old_value
                                                                    )}
                                                                </span>
                                                                <i className="fas fa-arrow-right text-text-tertiary text-[8px]" />
                                                                <span className="text-text-secondary bg-bg-tertiary rounded px-1.5 py-0.5 font-medium">
                                                                    {ListService.formatActivityValue(
                                                                        entry.field_name,
                                                                        entry.new_value
                                                                    )}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div
                                                            className={`flex items-center gap-2 ${isMobile ? 'text-[0.625rem]' : 'text-xs'}`}
                                                        >
                                                            <span className="text-text-tertiary font-medium">
                                                                {ListService.formatRelativeTime(entry.created_at)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-center text-text-tertiary text-sm pt-0.5">
                                                        <i className="fas fa-chevron-right" />
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className={`flex flex-col gap-3 w-full ${isMobile ? 'pb-4' : 'pb-6'}`}>
                            {Object.entries(groupedItems).map(([key, group]) => {
                                if (!group.items.length) return null
                                if (statusFilter === 'completed' && key !== 'completed') return null
                                if (statusFilter === 'pending' && key === 'completed') return null
                                if (statusFilter === 'overdue' && key !== 'overdue') return null
                                return (
                                    <div
                                        key={key}
                                        className="bg-bg-primary border border-border-light overflow-hidden rounded"
                                    >
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border-light bg-bg-tertiary">
                                            <i
                                                className={`fas ${group.icon} text-[10px]`}
                                                style={{ color: accentColor }}
                                            />
                                            <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-secondary">
                                                {group.label}
                                            </span>
                                            <span
                                                className="inline-flex items-center justify-center rounded text-[9px] font-bold tabular-nums px-1 min-w-[16px] h-3.5"
                                                style={{ background: `${accentColor}14`, color: accentColor }}
                                            >
                                                {group.items.length}
                                            </span>
                                        </div>
                                        <div className="flex flex-col">
                                            {group.items.map((item) => {
                                                const isSelected = selectedIds.has(item.id)
                                                const itemStatus = item.completed
                                                    ? 'completed'
                                                    : item.status || 'pending'
                                                const isItemOverdue =
                                                    (ListService.isOverdue(item) || item.status === 'overdue') &&
                                                    !item.completed
                                                const pc = ListService.getPriorityConfig(item.priority || 'none')
                                                return (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => onSelectItem(item.id)}
                                                        className={`flex items-center gap-2 cursor-pointer border-b border-border-light transition-colors ${
                                                            isMobile ? 'px-2 py-1.5' : 'px-3 py-1.5'
                                                        } ${item.completed ? 'opacity-65' : ''} hover:bg-bg-tertiary`}
                                                        style={{
                                                            background: isSelected
                                                                ? 'var(--bg-tertiary)'
                                                                : 'transparent'
                                                        }}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                toggleSelect(item.id)
                                                            }}
                                                            className="flex items-center justify-center h-4 w-4 rounded shrink-0 transition-colors border-none cursor-pointer"
                                                            style={{
                                                                background: isSelected ? accentColor : 'transparent',
                                                                border: `1.5px solid ${
                                                                    isSelected ? accentColor : 'var(--border-medium)'
                                                                }`
                                                            }}
                                                            aria-label="Select"
                                                        >
                                                            {isSelected && (
                                                                <i className="fas fa-check text-white text-[8px]" />
                                                            )}
                                                        </button>
                                                        <span
                                                            className="inline-flex items-center shrink-0 rounded text-[9px] font-bold uppercase tracking-wider gap-1 px-1.5 py-0.5"
                                                            style={getItemStatusStyle(itemStatus, isMobile)}
                                                        >
                                                            <i
                                                                className={`fas ${ListService.getStatusIcon(itemStatus)} text-[8px]`}
                                                            />
                                                            {ListService.getStatusLabel(itemStatus)}
                                                        </span>
                                                        {!isMobile && (
                                                            <span
                                                                className="inline-flex items-center shrink-0 rounded text-[9px] font-bold uppercase tracking-wider gap-1 px-1.5 py-0.5 border"
                                                                style={{
                                                                    background: pc.bg,
                                                                    borderColor: pc.border,
                                                                    color: pc.color
                                                                }}
                                                            >
                                                                <i className={`fas ${pc.icon} text-[8px]`} />
                                                                {pc.label}
                                                            </span>
                                                        )}
                                                        <div className="flex flex-1 min-w-0 items-baseline gap-2">
                                                            <span
                                                                className="text-[12px] font-semibold truncate text-text-primary"
                                                                style={{
                                                                    textDecoration: item.completed
                                                                        ? 'line-through'
                                                                        : 'none'
                                                                }}
                                                                title={item.description}
                                                            >
                                                                {item.description}
                                                            </span>
                                                            {item.comments && !isMobile && (
                                                                <span
                                                                    className="text-[11px] truncate text-text-tertiary"
                                                                    title={item.comments}
                                                                >
                                                                    · {item.comments}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span
                                                            className="hidden md:inline-flex items-center gap-1 text-[11px] shrink-0 rounded px-1.5 py-0.5 border bg-[rgba(148,163,184,0.10)] border-[rgba(148,163,184,0.25)] text-text-secondary"
                                                            title={ListService.getPlantName(item.plant_code)}
                                                        >
                                                            <i className="fas fa-building text-[9px] opacity-70" />
                                                            <span className="truncate max-w-[120px]">
                                                                {ListService.getPlantName(item.plant_code)}
                                                            </span>
                                                        </span>
                                                        <span
                                                            className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums shrink-0"
                                                            style={{
                                                                color: isItemOverdue
                                                                    ? '#dc2626'
                                                                    : 'var(--text-secondary)',
                                                                fontWeight: isItemOverdue ? 700 : 500
                                                            }}
                                                        >
                                                            <i className="fas fa-calendar text-[9px] opacity-70" />
                                                            {new Date(item.deadline).toLocaleDateString('en-US', {
                                                                day: 'numeric',
                                                                month: 'short'
                                                            })}
                                                        </span>
                                                        {item.responsible_role && !isMobile && (
                                                            <span className="hidden lg:inline-flex items-center gap-1 text-[11px] shrink-0 text-text-secondary">
                                                                <i
                                                                    className={`fas ${ListService.getResponsibleRoleIcon(item.responsible_role)} text-[9px] opacity-70`}
                                                                />
                                                                <span className="truncate max-w-[110px]">
                                                                    {ListService.getResponsibleRoleLabel(
                                                                        item.responsible_role
                                                                    )}
                                                                </span>
                                                            </span>
                                                        )}
                                                        <span className="hidden lg:inline-flex items-center gap-1 text-[11px] shrink-0 text-text-tertiary">
                                                            <i className="fas fa-user text-[9px] opacity-70" />
                                                            {ListService.truncateText(
                                                                ListService.getCreatorName(item.user_id),
                                                                12
                                                            )}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
            {selectedIds.size > 0 && (
                <div
                    className={`fixed z-[1000] ${
                        isMobile
                            ? 'bottom-0 inset-x-0 flex flex-col border-t border-border-light shadow-[0_-8px_24px_rgba(0,0,0,0.15)] pb-[env(safe-area-inset-bottom)]'
                            : 'bottom-8 left-1/2 -translate-x-1/2 flex items-center flex-nowrap gap-4 justify-start px-6 py-4 border border-border-light rounded shadow-[0_8px_24px_rgba(0,0,0,0.15)]'
                    } bg-bg-primary`}
                >
                    {isMobile && (
                        <div
                            className="text-xs font-bold text-center py-1.5 border-b border-border-light"
                            style={{ color: accentColor }}
                        >
                            {selectedIds.size} selected
                        </div>
                    )}
                    {!isMobile && (
                        <div className="text-[0.9375rem] font-bold shrink-0" style={{ color: accentColor }}>
                            {selectedIds.size} selected
                        </div>
                    )}
                    <div className={`flex ${isMobile ? 'w-full px-1 py-1.5 gap-1' : 'gap-2'}`}>
                        <button
                            onClick={() => bulkToggleCompletion(true)}
                            className={`flex items-center border-none cursor-pointer font-semibold outline-none transition-all duration-200 ${
                                isMobile
                                    ? 'flex-1 flex-col gap-1 py-2 rounded-lg text-[11px] min-h-[52px] justify-center'
                                    : 'gap-2 px-4 py-2 rounded text-sm'
                            }`}
                            style={getBulkButtonStyle('complete')}
                            onMouseEnter={(e) => (e.currentTarget.style.background = BULK_ACTION_COLORS.complete.hover)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = BULK_ACTION_COLORS.complete.bg)}
                            aria-label="Complete"
                        >
                            <i className={`fas fa-check ${isMobile ? 'text-base' : ''}`} />
                            <span>Complete</span>
                        </button>
                        <div className={`relative ${isMobile ? 'flex-1 flex' : ''}`} ref={bulkStatusRef}>
                            <button
                                onClick={() => {
                                    setBulkStatusOpen((p) => !p)
                                    setBulkPriorityOpen(false)
                                }}
                                className={`flex items-center border-none cursor-pointer font-semibold outline-none transition-all duration-200 ${
                                    isMobile
                                        ? 'flex-1 flex-col gap-1 py-2 rounded-lg text-[11px] min-h-[52px] justify-center'
                                        : 'gap-2 px-4 py-2 rounded text-sm'
                                }`}
                                style={getBulkButtonStyle('neutral')}
                                onMouseEnter={(e) =>
                                    (e.currentTarget.style.background = BULK_ACTION_COLORS.neutral.hover)
                                }
                                onMouseLeave={(e) => (e.currentTarget.style.background = BULK_ACTION_COLORS.neutral.bg)}
                                aria-label="Status"
                            >
                                <i className={`fas fa-layer-group ${isMobile ? 'text-base' : ''}`} />
                                <span className={isMobile ? '' : 'flex items-center gap-2'}>
                                    Status
                                    {!isMobile && (
                                        <i
                                            className={`fas fa-chevron-down text-[8px] opacity-60 transition-transform duration-150 ${bulkStatusOpen ? 'rotate-180' : ''}`}
                                        />
                                    )}
                                </span>
                            </button>
                            {bulkStatusOpen && (
                                <div
                                    className={`absolute bottom-full mb-2 z-50 rounded shadow-lg overflow-hidden animate-filter-fade ${
                                        isMobile
                                            ? 'left-1/2 -translate-x-1/2 w-[min(220px,90vw)]'
                                            : 'left-0 min-w-[180px]'
                                    } bg-bg-primary border border-border-light`}
                                >
                                    <div className="p-1.5">
                                        {BULK_STATUS_OPTIONS.map((opt) => {
                                            const color = STATUS_COLORS[opt.value] || STATUS_COLORS.pending
                                            return (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => bulkUpdateStatus(opt.value)}
                                                    className={`flex items-center w-full rounded font-medium cursor-pointer transition-all duration-100 border-none ${
                                                        isMobile
                                                            ? 'gap-3 px-3 py-3 text-sm'
                                                            : 'gap-2.5 px-3 py-2 text-xs'
                                                    } bg-transparent text-text-primary`}
                                                    onMouseEnter={(e) =>
                                                        (e.currentTarget.style.background = 'var(--bg-secondary)')
                                                    }
                                                    onMouseLeave={(e) =>
                                                        (e.currentTarget.style.background = 'transparent')
                                                    }
                                                >
                                                    <span
                                                        className="flex items-center justify-center h-5 w-5 rounded-md text-[9px]"
                                                        style={{ background: color.bg, color: color.text }}
                                                    >
                                                        <i className={`fas ${ListService.getStatusIcon(opt.value)}`} />
                                                    </span>
                                                    {opt.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={`relative ${isMobile ? 'flex-1 flex' : ''}`} ref={bulkPriorityRef}>
                            <button
                                onClick={() => {
                                    setBulkPriorityOpen((p) => !p)
                                    setBulkStatusOpen(false)
                                }}
                                className={`flex items-center border-none cursor-pointer font-semibold outline-none transition-all duration-200 ${
                                    isMobile
                                        ? 'flex-1 flex-col gap-1 py-2 rounded-lg text-[11px] min-h-[52px] justify-center'
                                        : 'gap-2 px-4 py-2 rounded text-sm'
                                }`}
                                style={getBulkButtonStyle('neutral')}
                                onMouseEnter={(e) =>
                                    (e.currentTarget.style.background = BULK_ACTION_COLORS.neutral.hover)
                                }
                                onMouseLeave={(e) => (e.currentTarget.style.background = BULK_ACTION_COLORS.neutral.bg)}
                                aria-label="Priority"
                            >
                                <i className={`fas fa-flag ${isMobile ? 'text-base' : ''}`} />
                                <span className={isMobile ? '' : 'flex items-center gap-2'}>
                                    Priority
                                    {!isMobile && (
                                        <i
                                            className={`fas fa-chevron-down text-[8px] opacity-60 transition-transform duration-150 ${bulkPriorityOpen ? 'rotate-180' : ''}`}
                                        />
                                    )}
                                </span>
                            </button>
                            {bulkPriorityOpen && (
                                <div
                                    className={`absolute bottom-full mb-2 z-50 rounded shadow-lg overflow-hidden animate-filter-fade ${
                                        isMobile
                                            ? 'left-1/2 -translate-x-1/2 w-[min(220px,90vw)]'
                                            : 'left-0 min-w-[170px]'
                                    } bg-bg-primary border border-border-light`}
                                >
                                    <div className="p-1.5">
                                        {ListService.getPriorityOptions().map((opt) => {
                                            const pc = ListService.getPriorityConfig(opt.value)
                                            return (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => bulkUpdatePriority(opt.value)}
                                                    className={`flex items-center w-full rounded font-medium cursor-pointer transition-all duration-100 border-none ${
                                                        isMobile
                                                            ? 'gap-3 px-3 py-3 text-sm'
                                                            : 'gap-2.5 px-3 py-2 text-xs'
                                                    } bg-transparent text-text-primary`}
                                                    onMouseEnter={(e) =>
                                                        (e.currentTarget.style.background = 'var(--bg-secondary)')
                                                    }
                                                    onMouseLeave={(e) =>
                                                        (e.currentTarget.style.background = 'transparent')
                                                    }
                                                >
                                                    <span
                                                        className="flex items-center justify-center h-5 w-5 rounded-md text-[9px]"
                                                        style={{ background: pc.bg, color: pc.color }}
                                                    >
                                                        <i className={`fas ${pc.icon}`} />
                                                    </span>
                                                    {opt.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={bulkDelete}
                            className={`flex items-center border-none cursor-pointer font-semibold outline-none transition-all duration-200 ${
                                isMobile
                                    ? 'flex-1 flex-col gap-1 py-2 rounded-lg text-[11px] min-h-[52px] justify-center'
                                    : 'gap-2 px-4 py-2 rounded text-sm'
                            }`}
                            style={getBulkButtonStyle('delete')}
                            onMouseEnter={(e) => (e.currentTarget.style.background = BULK_ACTION_COLORS.delete.hover)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = BULK_ACTION_COLORS.delete.bg)}
                            aria-label="Delete"
                        >
                            <i className={`fas fa-trash ${isMobile ? 'text-base' : ''}`} />
                            <span>Delete</span>
                        </button>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className={`flex items-center border-none cursor-pointer font-semibold outline-none transition-all duration-200 ${
                                isMobile
                                    ? 'flex-1 flex-col gap-1 py-2 rounded-lg text-[11px] min-h-[52px] justify-center'
                                    : 'gap-2 px-4 py-2 rounded text-sm'
                            }`}
                            style={getBulkButtonStyle('cancel')}
                            onMouseEnter={(e) => (e.currentTarget.style.background = BULK_ACTION_COLORS.cancel.hover)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = BULK_ACTION_COLORS.cancel.bg)}
                            aria-label="Cancel"
                        >
                            <i className={`fas fa-times ${isMobile ? 'text-base' : ''}`} />
                            <span>Cancel</span>
                        </button>
                    </div>
                </div>
            )}
            {showAddSheet && (
                <ListAddView
                    onClose={() => setShowAddSheet(false)}
                    onItemAdded={() => {
                        setIsLoading(true)
                        Promise.all([ListService.fetchListItems(), ListService.fetchPlants()])
                            .then(() => setPlants(ListService.plants))
                            .finally(() => setIsLoading(false))
                    }}
                />
            )}
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onConfirm={confirmBulkDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                title={`Delete ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''}?`}
                message="This action cannot be undone. The selected tasks will be permanently removed."
                confirmLabel="Delete"
                variant="danger"
            />
        </div>
    )
}
export default ListView
