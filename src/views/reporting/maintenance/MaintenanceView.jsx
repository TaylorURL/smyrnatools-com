import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { MaintenanceFilterBar } from '../../../app/components/maintenance/MaintenanceFilterBar'
import { FormTable, FormTabSkeleton } from '../../../app/components/maintenance/MaintenanceFormAtoms'
import { MaintenanceFormDownloads } from '../../../app/components/maintenance/MaintenanceFormDownloads'
import { MaintenanceHeader } from '../../../app/components/maintenance/MaintenanceHeader'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useIsMobile } from '../../../app/hooks/useIsMobile'
import { MaintenanceService } from '../../../services/MaintenanceService'
import { formatFrequency, formatMaintenanceDate } from '../../../utils/MaintenanceUtility'
import MaintenanceCreateFormView from './MaintenanceCreateFormView'

/* ── Constants ────────────────────────────────────────────────── */

// The view is download-only: workers grab the PDF, complete it by hand, and
// keep the finished sheet on file at their plant. `manage` stays as the
// admin-only authoring flow for the form templates themselves.
const TAB_DEFS = [
    { icon: 'fa-file-arrow-down', key: 'downloads', label: 'Download Forms' },
    { icon: 'fa-cog', key: 'manage', label: 'Manage Forms', permission: 'canCreate' }
]

const CREATE_BUTTON_CLASS =
    'inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-1.5 rounded-md border-none bg-accent px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm transition-[background-color,transform] duration-150 ease-out hover:bg-accent-hover active:scale-[0.97] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'

/** Case-insensitive match against a form's searchable text. */
function formMatchesQuery(form, query) {
    if (!query) return true
    const haystack = [form.title, form.description, form.frequency].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(query)
}

/* ── Main view ──────────────────────────────────────────────── */

export default function MaintenanceView() {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#2A3163'
    const isMobile = useIsMobile()

    const [activeTab, setActiveTab] = useState('downloads')
    const [searchText, setSearchText] = useState('')
    const [loading, setLoading] = useState(true)
    const [forms, setForms] = useState([])
    const [permissions, setPermissions] = useState({ canCreate: false })
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [editingForm, setEditingForm] = useState(null)

    const regionCode = preferences.selectedRegion?.code

    const loadForms = useCallback(async () => {
        setLoading(true)
        try {
            const [perms, fetched] = await Promise.all([
                MaintenanceService.checkPermissions().catch(() => ({ canCreate: false })),
                MaintenanceService.fetchForms({ regionCode }).catch(() => [])
            ])
            setPermissions(perms)
            setForms(fetched)
        } finally {
            setLoading(false)
        }
    }, [regionCode])

    useEffect(() => {
        loadForms()
    }, [loadForms])

    // ── Derived state ──

    // Losing `maintenance.create` (or a permissions refetch) must never strand
    // the user on the admin tab, so the manage selection only holds while the
    // permission does.
    const effectiveTab = activeTab === 'manage' && !permissions.canCreate ? 'downloads' : activeTab

    const visibleForms = useMemo(() => {
        const query = searchText.trim().toLowerCase()
        return forms.filter((form) => formMatchesQuery(form, query))
    }, [forms, searchText])

    const visibleTabs = useMemo(
        () =>
            TAB_DEFS.filter((tab) => !tab.permission || permissions[tab.permission]).map(({ icon, key, label }) => ({
                icon,
                key,
                label
            })),
        [permissions]
    )

    const regionLabel = preferences.selectedRegion?.name || preferences.selectedRegion?.code || ''

    // ── Handlers ──

    const handleFormSaved = () => {
        setShowCreateForm(false)
        setEditingForm(null)
        loadForms()
    }

    const handleEditForm = (form) => {
        setEditingForm(form)
        setShowCreateForm(true)
    }

    // ── Full-screen drilldown view ──

    if (showCreateForm) {
        return (
            <MaintenanceCreateFormView
                editingForm={editingForm}
                onBack={() => {
                    setShowCreateForm(false)
                    setEditingForm(null)
                }}
                onSaved={handleFormSaved}
            />
        )
    }

    // ── Manage tab (admin authoring list) ──

    const manageColumns = [
        { highlight: true, key: 'title', label: 'Form Title', render: (row) => row.title || '—' },
        {
            key: 'description',
            label: 'Description',
            render: (row) => (
                <span className="inline-block max-w-[250px] truncate text-text-secondary">
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
        if (loading) return <FormTabSkeleton />

        return (
            <FormTable
                columns={manageColumns}
                rows={visibleForms}
                emptyIcon={forms.length ? 'fa-magnifying-glass' : 'fa-folder-open'}
                emptyTitle={forms.length ? 'No matching forms' : 'No forms created'}
                emptyMessage={
                    forms.length
                        ? 'No forms match your search — try a different term.'
                        : 'Create your first maintenance form to get started.'
                }
                emptyChildren={
                    forms.length ? undefined : (
                        <button type="button" onClick={() => setShowCreateForm(true)} className={CREATE_BUTTON_CLASS}>
                            <i className="fas fa-plus text-[10px]" aria-hidden="true" />
                            Create Form
                        </button>
                    )
                }
                onRowClick={handleEditForm}
            />
        )
    }

    return (
        <div className="global-dashboard-container dashboard-container global-flush-top flush-top bg-bg-secondary flex flex-col overflow-hidden absolute inset-0">
            <MaintenanceHeader
                activeTab={effectiveTab}
                isMobile={isMobile}
                isSyncing={loading}
                onChangeTab={setActiveTab}
                onPrimaryAction={effectiveTab === 'manage' ? () => setShowCreateForm(true) : undefined}
                onRefresh={loadForms}
                primaryActionIcon="fa-plus"
                primaryActionLabel={effectiveTab === 'manage' ? 'Create Form' : undefined}
                regionLabel={regionLabel}
                tabs={visibleTabs}
            />

            <MaintenanceFilterBar
                onClearSearch={() => setSearchText('')}
                onSearchChange={setSearchText}
                searchPlaceholder="Search forms…"
                searchValue={searchText}
            />

            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="w-full px-3 sm:px-4 lg:px-6 py-3 sm:py-5">
                    {effectiveTab === 'downloads' ? (
                        <MaintenanceFormDownloads
                            accentColor={accentColor}
                            forms={visibleForms}
                            hasAnyForms={forms.length > 0}
                            loading={loading}
                        />
                    ) : (
                        renderManageTab()
                    )}
                </div>
            </div>
        </div>
    )
}
