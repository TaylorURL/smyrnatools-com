import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { MaintenanceFilterBar } from '../../../app/components/maintenance/MaintenanceFilterBar'
import { FormTable, FormTabSkeleton } from '../../../app/components/maintenance/MaintenanceFormAtoms'
import { MaintenanceHeader } from '../../../app/components/maintenance/MaintenanceHeader'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useIsMobile } from '../../../app/hooks/useIsMobile'
import { MaintenanceLogService } from '../../../services/MaintenanceLogService'
import { MaintenanceService } from '../../../services/MaintenanceService'
import { PlantService } from '../../../services/PlantService'
import { UserService } from '../../../services/UserService'
import { formatFrequency, formatMaintenanceDate } from '../../../utils/MaintenanceUtility'
import MaintenanceCreateFormView from './MaintenanceCreateFormView'
import MaintenanceLogView from './MaintenanceLogView'

/* ── Constants ────────────────────────────────────────────────── */

// `log` is the unified workflow surface — equipment, recurring uploads, and
// review queue all live in a single two-pane layout. `manage` stays separate
// because creating/editing form templates is an admin-only authoring flow.
const TAB_DEFS = [
    { icon: 'fa-chart-line', key: 'log', label: 'Maintenance Log' },
    { icon: 'fa-cog', key: 'manage', label: 'Manage Forms' }
]

const STATUS_OPTIONS = ['All Statuses', 'OK', 'Due Soon', 'Overdue', 'Never Serviced']

/* ── Main view ──────────────────────────────────────────────── */

export default function MaintenanceView() {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#2A3163'
    const isMobile = useIsMobile()

    const [activeTab, setActiveTab] = useState('log')

    // ── Shared filter state ──
    const [searchText, setSearchText] = useState('')
    const [selectedPlant, setSelectedPlant] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    // ── Equipment log data ──
    const [logLoading, setLogLoading] = useState(true)
    const [equipment, setEquipment] = useState([])
    const [categories, setCategories] = useState([])
    const [recentEntries, setRecentEntries] = useState([])
    const [serviceTypes, setServiceTypes] = useState([])
    const [regionPlants, setRegionPlants] = useState([])
    const [showAddModal, setShowAddModal] = useState(false)

    // ── Form system data ──
    const [formLoading, setFormLoading] = useState(true)
    const [dueItems, setDueItems] = useState([])
    const [pendingReviews, setPendingReviews] = useState([])
    const [reviewedSubmissions, setReviewedSubmissions] = useState([])
    const [mySubmissions, setMySubmissions] = useState([])
    const [myForms, setMyForms] = useState([])
    const [permissions, setPermissions] = useState({ canCreate: false, canReview: false })

    // Form navigation — only the create-form drilldown lives at this level
    // now. The combined Log tab handles its own inline form selection so
    // upload + review can stay co-resident with the equipment table.
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [editingForm, setEditingForm] = useState(null)

    const regionCode = preferences.selectedRegion?.code

    const loadFormData = useCallback(async () => {
        setFormLoading(true)
        try {
            const perms = await MaintenanceService.checkPermissions().catch(() => ({
                canCreate: false,
                canReview: false
            }))
            setPermissions(perms)
            const currentUser = await UserService.getCurrentUser()
            const [due, reviews, reviewed, submissions, forms] = await Promise.all([
                MaintenanceService.fetchMyDueItems().catch(() => []),
                perms.canReview ? MaintenanceService.fetchPendingReviews().catch(() => []) : [],
                perms.canReview ? MaintenanceService.fetchReviewedSubmissions().catch(() => []) : [],
                MaintenanceService.fetchMySubmissions(currentUser?.id).catch(() => []),
                MaintenanceService.fetchForms({ regionCode }).catch(() => [])
            ])
            setDueItems(due)
            setPendingReviews(reviews)
            setReviewedSubmissions(reviewed)
            setMySubmissions(submissions)
            setMyForms(forms)
        } catch {
            setDueItems([])
            setPendingReviews([])
            setReviewedSubmissions([])
            setMySubmissions([])
            setMyForms([])
        } finally {
            setFormLoading(false)
        }
    }, [regionCode])

    const loadLogData = useCallback(async () => {
        setLogLoading(true)
        try {
            const [eq, cats, svcTypes, recent, plants] = await Promise.all([
                MaintenanceLogService.fetchEquipmentSummary().catch(() => []),
                MaintenanceLogService.fetchCategories().catch(() => []),
                MaintenanceLogService.fetchServiceTypes().catch(() => []),
                MaintenanceLogService.fetchRecentEntries(10).catch(() => []),
                regionCode ? PlantService.fetchRegionPlants(regionCode).catch(() => []) : []
            ])
            setEquipment(eq)
            setCategories(cats)
            setServiceTypes(svcTypes)
            setRecentEntries(recent)
            setRegionPlants(plants)
        } catch {
            setEquipment([])
        } finally {
            setLogLoading(false)
        }
    }, [regionCode])

    useEffect(() => {
        loadLogData()
        loadFormData()
    }, [loadLogData, loadFormData])

    // ── Derived state ──

    const regionPlantCodes = useMemo(() => {
        const codes = new Set()
        regionPlants.forEach((p) => {
            const code = String(p.plantCode || p.plant_code || '')
                .trim()
                .toUpperCase()
            if (code) codes.add(code)
        })
        return codes
    }, [regionPlants])

    const categoryOptions = useMemo(() => {
        const names = [...new Set(equipment.map((e) => e.category_name).filter(Boolean))].sort()
        return ['All Categories', ...names]
    }, [equipment])

    const logCounts = useMemo(() => {
        const query = searchText.trim().toLowerCase()
        const scoped = equipment.filter((item) => {
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
            if (selectedPlant && selectedPlant !== 'All' && !selectedPlant.startsWith('DISTRICT:')) {
                if ((item.plant_code || '').toUpperCase() !== selectedPlant.toUpperCase()) return false
            }
            if (categoryFilter && item.category_name !== categoryFilter) return false
            return true
        })
        return MaintenanceLogService.getStatusCounts(scoped)
    }, [equipment, searchText, selectedPlant, categoryFilter])

    const showReset =
        searchText ||
        (selectedPlant && selectedPlant !== 'All') ||
        categoryFilter ||
        (statusFilter && statusFilter !== 'All Statuses')

    // ── Handlers ──

    const handlePillClick = useCallback((label) => {
        const map = { 'Due Soon': 'Due Soon', OK: 'OK', Overdue: 'Overdue', Total: 'All Statuses' }
        setStatusFilter((prev) => {
            const target = map[label] || 'All Statuses'
            return prev === target ? 'All Statuses' : target
        })
    }, [])

    const handleFormCreated = () => {
        setShowCreateForm(false)
        setEditingForm(null)
        loadFormData()
    }

    const handleEditForm = (form) => {
        setEditingForm(form)
        setShowCreateForm(true)
    }

    const handleReset = () => {
        setSearchText('')
        setSelectedPlant('')
        setCategoryFilter('')
        setStatusFilter('')
    }

    // ── Badge counts ──

    const dueBadgeCount = dueItems.filter((i) => i.status !== 'completed').length
    const reviewBadgeCount = pendingReviews.length

    // ── Full-screen drilldown view ──

    if (showCreateForm) {
        return (
            <MaintenanceCreateFormView
                editingForm={editingForm}
                onBack={() => {
                    setShowCreateForm(false)
                    setEditingForm(null)
                }}
                onSaved={handleFormCreated}
            />
        )
    }

    // ── Tab content renderers ──
    // Forms-due, pending-review, and submission history are no longer rendered
    // here — they live inside the combined Maintenance Log tab so they stay
    // alongside the equipment table. Only the Manage Forms list remains a
    // standalone tab because it's an admin authoring surface.

    const manageColumns = [
        { highlight: true, key: 'title', label: 'Form Title', render: (row) => row.title || '—' },
        {
            key: 'description',
            label: 'Description',
            render: (row) => (
                <span className="truncate max-w-[250px] inline-block text-text-secondary">
                    {row.description || '—'}
                </span>
            )
        },
        {
            key: 'frequency',
            label: 'Frequency',
            render: (row) => formatFrequency(row.frequency, row.frequency_value)
        },
        { key: 'fields', label: 'Fields', render: (row) => `${row.maintenance_form_fields?.length || 0}` },
        { key: 'created_at', label: 'Created', render: (row) => formatMaintenanceDate(row.created_at) }
    ]

    const renderManageTab = () => {
        if (formLoading) return <FormTabSkeleton />

        return (
            <FormTable
                columns={manageColumns}
                rows={myForms}
                emptyIcon="fa-folder-open"
                emptyTitle="No forms created"
                emptyMessage={
                    permissions.canCreate
                        ? 'Create your first maintenance form to get started.'
                        : 'No maintenance forms have been created yet.'
                }
                emptyChildren={
                    permissions.canCreate ? (
                        <button
                            type="button"
                            onClick={() => setShowCreateForm(true)}
                            className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1.5 text-white border-none cursor-pointer"
                            style={{ background: accentColor }}
                        >
                            <i className="fas fa-plus text-[10px]" />
                            Create Form
                        </button>
                    ) : undefined
                }
                onRowClick={handleEditForm}
            />
        )
    }

    // ── Tabs for the Plan-style switcher ──
    // Log badge surfaces forms-due + pending-review counts so users can see
    // outstanding work without flipping tabs.
    const logBadgeCount = dueBadgeCount + reviewBadgeCount
    const visibleTabs = TAB_DEFS.filter((tab) => !tab.permission || permissions[tab.permission]).map((tab) => ({
        badge: tab.key === 'log' ? logBadgeCount : null,
        icon: tab.icon,
        key: tab.key,
        label: tab.label
    }))

    // ── Region scope chip + plant picker label ──
    const regionLabel = preferences.selectedRegion?.name || preferences.selectedRegion?.code || ''
    const selectedPlantObj = regionPlants.find((p) => (p.plantCode || p.plant_code) === selectedPlant)
    const plantDisplayText = selectedPlant?.startsWith('DISTRICT:')
        ? selectedPlant.slice(9)
        : selectedPlant && selectedPlantObj
          ? `(${selectedPlantObj.plantCode || selectedPlantObj.plant_code}) ${selectedPlantObj.plantName || selectedPlantObj.plant_name}`
          : 'All Plants'

    // ── Status pill summary — only meaningful on the Log tab. ──
    const countPills =
        activeTab === 'log' && !logLoading
            ? [
                  { active: !statusFilter || statusFilter === 'All Statuses', count: logCounts.total, label: 'Total' },
                  { active: statusFilter === 'OK', count: logCounts.ok, label: 'OK' },
                  { active: statusFilter === 'Due Soon', count: logCounts.dueSoon, label: 'Due Soon' },
                  { active: statusFilter === 'Overdue', count: logCounts.overdue, label: 'Overdue' }
              ]
            : []

    const onTabChange = (key) => setActiveTab(key)

    const isLogTab = activeTab === 'log'
    const showCategoryFilter = isLogTab
    const showStatusFilter = isLogTab

    return (
        <div
            className="global-dashboard-container dashboard-container global-flush-top flush-top bg-bg-secondary flex flex-col overflow-hidden absolute"
            style={{ inset: 0 }}
        >
            <MaintenanceHeader
                accentColor={accentColor}
                activeTab={activeTab}
                isMobile={isMobile}
                isSyncing={logLoading || formLoading}
                onChangeTab={onTabChange}
                onPrimaryAction={isLogTab ? () => setShowAddModal(true) : undefined}
                onRefresh={() => {
                    loadLogData()
                    loadFormData()
                }}
                primaryActionIcon="fa-plus"
                primaryActionLabel={isLogTab ? 'Add Part / Unit / Component' : undefined}
                regionLabel={regionLabel}
                tabs={visibleTabs}
            />

            <MaintenanceFilterBar
                accentColor={accentColor}
                categoryFilter={categoryFilter}
                categoryOptions={showCategoryFilter ? categoryOptions : []}
                countPills={countPills}
                onCategoryFilterChange={setCategoryFilter}
                onClearSearch={() => setSearchText('')}
                onPillClick={handlePillClick}
                onPlantChange={setSelectedPlant}
                onReset={handleReset}
                onSearchChange={setSearchText}
                onStatusFilterChange={setStatusFilter}
                plantDisplayText={plantDisplayText}
                plants={regionPlants}
                regionPlantCodes={regionPlantCodes}
                searchPlaceholder="Search equipment, forms, plants..."
                searchValue={searchText}
                selectedPlant={selectedPlant}
                showReset={showReset}
                statusFilter={statusFilter}
                statusOptions={showStatusFilter ? STATUS_OPTIONS : []}
            />

            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {activeTab === 'log' && (
                    <MaintenanceLogView
                        categories={categories}
                        categoryFilter={categoryFilter}
                        dueItems={dueItems}
                        equipment={equipment}
                        formLoading={formLoading}
                        loading={logLoading}
                        mySubmissions={mySubmissions}
                        onCloseAddModal={() => setShowAddModal(false)}
                        onFormDataReload={loadFormData}
                        onReload={loadLogData}
                        pendingReviews={pendingReviews}
                        permissions={permissions}
                        plants={regionPlants}
                        recentEntries={recentEntries}
                        reviewedSubmissions={reviewedSubmissions}
                        searchText={searchText}
                        selectedPlant={selectedPlant}
                        serviceTypes={serviceTypes}
                        showAddModal={showAddModal}
                        statusFilter={statusFilter}
                    />
                )}
                {activeTab === 'manage' && (
                    <div className="flex-1 overflow-y-auto">
                        <div className="w-full px-3 sm:px-4 lg:px-6 py-3 sm:py-5">{renderManageTab()}</div>
                    </div>
                )}
            </div>
        </div>
    )
}
