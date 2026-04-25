import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ReportsActionBar } from '../../../app/components/reports/ReportsToolbar'
import TopSection from '../../../app/components/sections/TopSection'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { Database } from '../../../services/DatabaseService'
import { MaintenanceLogService } from '../../../services/MaintenanceLogService'
import { MaintenanceService } from '../../../services/MaintenanceService'
import { PlantService } from '../../../services/PlantService'
import { UserService } from '../../../services/UserService'
import { formatFrequency, formatMaintenanceDate } from '../../../utils/MaintenanceUtility'
import MaintenanceCreateFormView from './MaintenanceCreateFormView'
import MaintenanceFormView from './MaintenanceFormView'
import MaintenanceLogView from './MaintenanceLogView'

/* ── Constants ────────────────────────────────────────────────── */

// Canonical mixerConfig-style status palette.
const STATUS_PALETTE = {
    approved: { bg: '#dcfce7', fg: '#166534' },
    completed: { bg: '#dcfce7', fg: '#166534' },
    overdue: { bg: '#fee2e2', fg: '#b91c1c' },
    pending: { bg: '#fef3c7', fg: '#92400e' },
    rejected: { bg: '#fee2e2', fg: '#b91c1c' },
    submitted: { bg: '#dbeafe', fg: '#1e40af' }
}

const ICON_BY_STATUS = {
    approved: 'fa-check-circle',
    completed: 'fa-check-circle',
    overdue: 'fa-exclamation-circle',
    pending: 'fa-clipboard-list',
    rejected: 'fa-times-circle',
    submitted: 'fa-clock'
}

const TAB_DEFS = [
    { key: 'log', icon: 'fa-chart-line', label: 'Maintenance Log' },
    { key: 'due', icon: 'fa-clipboard-list', label: 'Recurring Forms' },
    { key: 'review', icon: 'fa-clipboard-check', label: 'Review Forms', permission: 'canReview' },
    { key: 'manage', icon: 'fa-cog', label: 'Manage Forms' }
]

const STATUS_OPTIONS = ['All Statuses', 'OK', 'Due Soon', 'Overdue', 'Never Serviced']

/* ── Plan-tab styled atoms ────────────────────────────────────── */

function StatusBadge({ status }) {
    const palette = STATUS_PALETTE[status] || { bg: 'var(--bg-tertiary)', fg: 'var(--text-secondary)' }
    return (
        <span
            className="inline-flex items-center rounded text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5"
            style={{ background: palette.bg, color: palette.fg }}
        >
            {status}
        </span>
    )
}

function PlantChip({ code }) {
    if (!code) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>
    return (
        <span
            className="inline-flex items-center rounded text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 font-mono tabular-nums"
            style={{ background: '#dbeafe', color: '#1e40af' }}
        >
            {code}
        </span>
    )
}

function ItemIcon({ status }) {
    const icon = ICON_BY_STATUS[status] || ICON_BY_STATUS.pending
    const palette = STATUS_PALETTE[status] || { bg: 'var(--bg-tertiary)', fg: 'var(--text-secondary)' }
    return (
        <div
            className="flex items-center justify-center w-6 h-6 rounded shrink-0"
            style={{ background: palette.bg, color: palette.fg }}
        >
            <i className={`fas ${icon} text-[11px]`} />
        </div>
    )
}

function FormTabSkeleton({ count = 5 }) {
    return (
        <div
            className="rounded overflow-hidden"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            {Array.from({ length: count }, (_, i) => (
                <div
                    key={i}
                    className="flex items-center gap-2.5 px-3 py-2"
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                >
                    <div
                        className="w-6 h-6 rounded animate-pulse shrink-0"
                        style={{ background: 'var(--bg-tertiary)' }}
                    />
                    <div className="flex-1 min-w-0">
                        <div
                            className="h-3 w-44 rounded animate-pulse mb-1"
                            style={{ background: 'var(--bg-tertiary)' }}
                        />
                        <div
                            className="h-2.5 w-56 rounded animate-pulse"
                            style={{ background: 'var(--bg-secondary)' }}
                        />
                    </div>
                    <div
                        className="h-4 w-16 rounded animate-pulse shrink-0"
                        style={{ background: 'var(--bg-tertiary)' }}
                    />
                </div>
            ))}
        </div>
    )
}

function EmptyState({ icon, title, message, children }) {
    return (
        <div
            className="flex flex-col items-center justify-center py-12 px-6 text-center"
            style={{ color: 'var(--text-tertiary)' }}
        >
            <i className={`fas ${icon} text-2xl mb-2`} />
            <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                {title}
            </div>
            {message && (
                <p className="m-0 mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {message}
                </p>
            )}
            {children && <div className="mt-3">{children}</div>}
        </div>
    )
}

function FormTable({ columns, rows, emptyIcon, emptyTitle, emptyMessage, emptyChildren, onRowClick }) {
    if (!rows || rows.length === 0) {
        return (
            <div
                className="rounded overflow-hidden"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
            >
                <EmptyState icon={emptyIcon} title={emptyTitle} message={emptyMessage}>
                    {emptyChildren}
                </EmptyState>
            </div>
        )
    }

    // First column = title (with icon), trailing column with key 'status' or 'actions' = badge/action
    const titleCol = columns.find((c) => c.highlight) || columns[0]
    const statusCol = columns.find((c) => c.key === 'status' || c.key === 'actions')
    const metaCols = columns.filter((c) => c !== titleCol && c !== statusCol)

    return (
        <div
            className="rounded overflow-hidden"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            {rows.map((row, idx) => (
                <div
                    key={row.id}
                    className="flex items-center px-3 py-2 cursor-pointer transition-colors hover:bg-bg-tertiary"
                    style={{ borderBottom: idx < rows.length - 1 ? '1px solid var(--border-light)' : 'none' }}
                    onClick={() => onRowClick?.(row)}
                >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <ItemIcon status={row.status} />
                        <div className="min-w-0">
                            <span
                                className="text-[12px] font-semibold block truncate"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                {titleCol.render ? titleCol.render(row) : row[titleCol.key]}
                            </span>
                            <div
                                className="flex items-center gap-1.5 mt-0.5 text-[10.5px] flex-wrap"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                {metaCols.map((col, i) => {
                                    const val = col.render ? col.render(row) : row[col.key]
                                    if (!val || val === '—') return null
                                    return (
                                        <React.Fragment key={col.key}>
                                            {i > 0 && (
                                                <span
                                                    className="hidden sm:inline"
                                                    style={{ color: 'var(--text-tertiary)' }}
                                                >
                                                    ·
                                                </span>
                                            )}
                                            <span className="font-mono tabular-nums">{val}</span>
                                        </React.Fragment>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                    {statusCol && (
                        <div className="shrink-0 ml-2">
                            {statusCol.render ? statusCol.render(row) : row[statusCol.key]}
                        </div>
                    )}
                    <i
                        className="fas fa-chevron-right text-[10px] ml-2 sm:hidden"
                        style={{ color: 'var(--text-tertiary)' }}
                    />
                </div>
            ))}
        </div>
    )
}

/* ── Main view ──────────────────────────────────────────────── */

export default function MaintenanceView() {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#2A3163'
    const headerRef = useRef(null)

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

    // Form navigation
    const [selectedItem, setSelectedItem] = useState(null)
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

    const badge = !logLoading
        ? `${logCounts.total} Total · ${logCounts.ok} OK · ${logCounts.dueSoon} Due Soon · ${logCounts.overdue} Overdue`
        : undefined

    // ── Handlers ──

    const handlePillClick = useCallback((label) => {
        const map = { 'Due Soon': 'Due Soon', OK: 'OK', Overdue: 'Overdue', Total: 'All Statuses' }
        setStatusFilter((prev) => {
            const target = map[label] || 'All Statuses'
            return prev === target ? 'All Statuses' : target
        })
    }, [])

    const handleItemClick = async (item) => {
        if (item.status === 'completed' && item.submission_id) {
            try {
                const submission = await MaintenanceService.fetchSubmissionById(item.submission_id)
                setSelectedItem({ ...item, ...submission, isEditing: true })
            } catch {
                setSelectedItem(item)
            }
        } else {
            setSelectedItem(item)
        }
    }

    const handleViewSubmission = (submission) => {
        setSelectedItem({
            ...submission,
            isReview: permissions.canReview,
            isViewOnly: submission.status !== 'submitted'
        })
    }

    const handleFormSubmitted = () => {
        setSelectedItem(null)
        loadFormData()
    }

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

    // ── Full-screen drilldown views ──

    if (selectedItem) {
        return (
            <MaintenanceFormView
                item={selectedItem}
                onBack={() => setSelectedItem(null)}
                onSubmitted={handleFormSubmitted}
            />
        )
    }

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

    const dueColumns = [
        { highlight: true, key: 'title', label: 'Form', render: (row) => row.form?.title || '—' },
        { key: 'plant', label: 'Plant', render: (row) => <PlantChip code={row.plant_code} /> },
        { key: 'due_date', label: 'Due Date', render: (row) => formatMaintenanceDate(row.due_date) },
        {
            key: 'frequency',
            label: 'Frequency',
            render: (row) => formatFrequency(row.form?.frequency, row.form?.frequency_value)
        },
        { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> }
    ]

    const renderDueTab = () => {
        if (formLoading) return <FormTabSkeleton />

        const filtered = dueItems
            .filter((item) => {
                if (selectedPlant && selectedPlant !== 'All' && item.plant_code !== selectedPlant) return false
                if (searchText) {
                    const q = searchText.trim().toLowerCase()
                    const searchable = [item.form?.title, item.plant_code].filter(Boolean).join(' ').toLowerCase()
                    if (!searchable.includes(q)) return false
                }
                return true
            })
            .sort((a, b) => (a.plant_code || '').localeCompare(b.plant_code || ''))

        return (
            <FormTable
                columns={dueColumns}
                rows={filtered}
                emptyIcon="fa-check-circle"
                emptyTitle={dueItems.length === 0 ? 'All caught up' : 'No matching tasks'}
                emptyMessage={
                    dueItems.length === 0
                        ? 'You have no maintenance tasks due at this time.'
                        : 'Try adjusting your filters.'
                }
                onRowClick={handleItemClick}
            />
        )
    }

    const handleDeleteSubmission = async (e, submissionId) => {
        e.stopPropagation()
        if (!window.confirm('Delete this submission?')) return
        try {
            await Database.from('maintenance_submission_responses').delete().eq('submission_id', submissionId)
            await Database.from('maintenance_submissions').delete().eq('id', submissionId)
            setPendingReviews((prev) => prev.filter((r) => r.id !== submissionId))
            setReviewedSubmissions((prev) => prev.filter((r) => r.id !== submissionId))
            setMySubmissions((prev) => prev.filter((r) => r.id !== submissionId))
        } catch (err) {
            console.error('Failed to delete submission:', err)
        }
    }

    const reviewColumns = [
        { highlight: true, key: 'title', label: 'Form', render: (row) => row.maintenance_forms?.title || '—' },
        { key: 'plant', label: 'Plant', render: (row) => <PlantChip code={row.plant_code} /> },
        { key: 'submitted_by', label: 'Submitted By', render: (row) => row.submitted_by_name || '—' },
        {
            key: 'date',
            label: 'Date',
            render: (row) =>
                row.status === 'submitted'
                    ? formatMaintenanceDate(row.submitted_at)
                    : formatMaintenanceDate(row.reviewed_at)
        },
        { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
        {
            key: 'actions',
            label: '',
            render: (row) => (
                <button
                    type="button"
                    onClick={(e) => handleDeleteSubmission(e, row.id)}
                    className="w-6 h-6 flex items-center justify-center rounded transition-colors hover:bg-bg-tertiary border-none bg-transparent cursor-pointer"
                    style={{ color: 'var(--text-tertiary)' }}
                    title="Delete"
                >
                    <i className="fas fa-trash-alt text-[10px]" />
                </button>
            )
        }
    ]

    const renderReviewTab = () => {
        if (formLoading) return <FormTabSkeleton />

        const allItems = [...pendingReviews, ...reviewedSubmissions, ...mySubmissions]
        const seen = new Set()
        const deduped = allItems.filter((item) => {
            if (seen.has(item.id)) return false
            seen.add(item.id)
            return true
        })
        deduped.sort((a, b) => {
            if (a.status === 'submitted' && b.status !== 'submitted') return -1
            if (a.status !== 'submitted' && b.status === 'submitted') return 1
            return new Date(b.submitted_at || b.reviewed_at) - new Date(a.submitted_at || a.reviewed_at)
        })

        return (
            <FormTable
                columns={reviewColumns}
                rows={deduped}
                emptyIcon="fa-clipboard-check"
                emptyTitle="No submissions"
                emptyMessage="Submissions and your history will appear here."
                onRowClick={(row) =>
                    row.status === 'submitted'
                        ? handleItemClick({ ...row, form: row.maintenance_forms, isReview: true })
                        : handleViewSubmission(row)
                }
            />
        )
    }

    const manageColumns = [
        { highlight: true, key: 'title', label: 'Form Title', render: (row) => row.title || '—' },
        {
            key: 'description',
            label: 'Description',
            render: (row) => (
                <span className="truncate max-w-[250px] inline-block" style={{ color: 'var(--text-secondary)' }}>
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

    // ── Tabs for ReportsActionBar ──

    const visibleTabs = TAB_DEFS.filter((tab) => !tab.permission || permissions[tab.permission]).map((tab) => ({
        badge: tab.key === 'due' ? dueBadgeCount : tab.key === 'review' ? reviewBadgeCount : null,
        icon: tab.icon,
        key: tab.key,
        label: tab.label
    }))

    // ── Filters: flat category select for the TopSection customFilters slot ──

    const categoryFilterSelect =
        categoryOptions.length > 1 ? (
            <select
                value={categoryFilter || 'All Categories'}
                onChange={(e) => setCategoryFilter(e.target.value === 'All Categories' ? '' : e.target.value)}
                aria-label="Category filter"
                className="text-[12px] cursor-pointer font-medium rounded py-1.5 pl-2 pr-7"
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)'
                }}
            >
                {categoryOptions.map((opt) => (
                    <option key={opt} value={opt}>
                        {opt}
                    </option>
                ))}
            </select>
        ) : null

    const onTabChange = (key) => {
        setActiveTab(key)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    return (
        <div className="min-h-screen w-full" style={{ background: 'var(--bg-secondary)' }}>
            <TopSection
                isLoading={logLoading}
                title="Maintenance"
                forwardedRef={headerRef}
                sticky
                badge={badge}
                onPillClick={handlePillClick}
                addButtonLabel={activeTab === 'log' ? 'Add Part / Unit / Component' : undefined}
                onAddClick={activeTab === 'log' ? () => setShowAddModal(true) : undefined}
                searchInput={searchText}
                onSearchInputChange={setSearchText}
                onClearSearch={() => setSearchText('')}
                searchPlaceholder="Search equipment, forms, plants..."
                plants={regionPlants}
                regionPlantCodes={regionPlantCodes}
                selectedPlant={selectedPlant}
                onSelectedPlantChange={setSelectedPlant}
                statusFilter={statusFilter}
                statusOptions={STATUS_OPTIONS}
                onStatusFilterChange={setStatusFilter}
                customFilters={categoryFilterSelect}
                hideViewModeToggle
                showReset={showReset}
                onReset={handleReset}
            />

            <ReportsActionBar tabs={visibleTabs} activeTab={activeTab} onTabChange={onTabChange} />

            {/* Tab content */}
            <div>
                {activeTab === 'log' && (
                    <MaintenanceLogView
                        searchText={searchText}
                        selectedPlant={selectedPlant}
                        categoryFilter={categoryFilter}
                        statusFilter={statusFilter}
                        plants={regionPlants}
                        loading={logLoading}
                        equipment={equipment}
                        categories={categories}
                        recentEntries={recentEntries}
                        serviceTypes={serviceTypes}
                        showAddModal={showAddModal}
                        onCloseAddModal={() => setShowAddModal(false)}
                        onReload={loadLogData}
                    />
                )}
                {activeTab === 'due' && <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-4">{renderDueTab()}</div>}
                {activeTab === 'review' && permissions.canReview && (
                    <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-4">{renderReviewTab()}</div>
                )}
                {activeTab === 'manage' && <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-4">{renderManageTab()}</div>}
            </div>
        </div>
    )
}
