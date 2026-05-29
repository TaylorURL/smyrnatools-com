import React, { useCallback, useEffect, useMemo, useState } from 'react'

import TabFadeIn from '../../../app/components/common/TabFadeIn'
import { CrmKpiStrip } from '../../../app/components/crm/CrmKpiStrip'
import { CrmAccountsPage, CrmActivityPage, CrmOutreachPage } from '../../../app/components/crm/CrmPages'
import { CrmSettingsPage } from '../../../app/components/crm/CrmSettingsPage'
import { CrmSidebar } from '../../../app/components/crm/CrmSidebar'
import { CRM_TABS, CrmTabSwitcher } from '../../../app/components/crm/CrmTabSwitcher'
import { CrmTeamMonitorPage } from '../../../app/components/crm/CrmTeamMonitorPage'
import { CrmFollowupsPage } from '../../../app/components/crm/pages/CrmFollowupsPage'
import { CrmMapPage } from '../../../app/components/crm/pages/CrmMapPage'
import { CrmMyDeskPage } from '../../../app/components/crm/pages/CrmMyDeskPage'
import { CrmPinsPage } from '../../../app/components/crm/pages/CrmPinsPage'
import { CrmPipelinePage } from '../../../app/components/crm/pages/CrmPipelinePage'
import { isDarkLikeTheme } from '../../../app/constants/themeConstants'
import { useAuth } from '../../../app/context/AuthContext'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useCrm } from '../../../app/hooks/useCrm'
import { useCrmDashboard } from '../../../app/hooks/useCrmDashboard'
import useCrmRoster from '../../../app/hooks/useCrmRoster'
import CrmService from '../../../services/CrmService'
import { UserService } from '../../../services/UserService'
import { canEditCrm, canManageCrm } from '../../../utils/CrmRoleUtility'

/** Section ids that require the crm.manage permission. */
const MANAGE_ONLY_SECTIONS = new Set(['team-monitor', 'settings'])

/**
 * CRM — top-level view under Tools. Promotes the Operations Call List tab
 * into a dedicated collaborative CRM surface.
 *
 * Tabs group related sections; switching tabs resets `activeSection` to
 * the first section of that tab. Manage-gated tabs/sections fall back
 * to Work/my-desk when the user lacks crm.manage.
 */
function CrmView() {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'
    // eslint-disable-next-line no-unused-vars
    const isDark = isDarkLikeTheme(preferences.themeMode)

    const { user } = useAuth()
    const [permissions, setPermissions] = useState([])

    useEffect(() => {
        let cancelled = false
        if (!user?.id) {
            setPermissions([])
            return undefined
        }
        UserService.getUserPermissions(user.id)
            .then((perms) => {
                if (!cancelled) setPermissions(Array.isArray(perms) ? perms : [])
            })
            .catch(() => {
                if (!cancelled) setPermissions([])
            })
        return () => {
            cancelled = true
        }
    }, [user?.id])

    const canManage = canManageCrm(permissions)
    const canEdit = canEditCrm(permissions)

    const [activeTab, setActiveTabRaw] = useState('work')
    const [activeSection, setActiveSection] = useState('my-desk')

    /** When switching tabs, reset to the first section of the incoming tab.
     *  Guard: if the tab requires manage and the user lacks it, fall back
     *  to work/my-desk. */
    const handleSelectTab = useCallback(
        (tabId) => {
            const tab = CRM_TABS.find((t) => t.id === tabId)
            if (!tab) return
            if (tab.requiresManage && !canManage) {
                setActiveTabRaw('work')
                setActiveSection('my-desk')
                return
            }
            setActiveTabRaw(tabId)
            setActiveSection(tab.sections[0])
        },
        [canManage]
    )

    /** Guard: if the current tab/section requires manage and the user no
     *  longer has it (role revoked mid-session), bounce back to work. */
    useEffect(() => {
        const tab = CRM_TABS.find((t) => t.id === activeTab)
        if ((tab?.requiresManage || MANAGE_ONLY_SECTIONS.has(activeSection)) && !canManage) {
            setActiveTabRaw('work')
            setActiveSection('my-desk')
        }
    }, [activeTab, activeSection, canManage])

    /** Scroll every `data-content-scroll` container back to the top whenever
     *  the active section changes — same pattern as OperationsView and Statistics. */
    useEffect(() => {
        if (typeof document === 'undefined') return
        document.querySelectorAll('[data-content-scroll]').forEach((el) => {
            if (typeof el?.scrollTo === 'function') el.scrollTo({ top: 0 })
            else if (el) el.scrollTop = 0
        })
    }, [activeSection])

    // ── Hook wiring ──────────────────────────────────────────────────────────

    const {
        archiveAccount,
        contactsByCustomer,
        deleteContact,
        deleteEntry,
        historyByCustomer,
        isLoadingActivity,
        isLoadingRoster,
        isLoadingTeamMonitor,
        loadContacts,
        loadHistory,
        loadRecentActivity,
        loadTeamMonitor,
        loadingContactsFor,
        loadingHistoryFor,
        logCall,
        recentActivity,
        refreshRoster,
        roster,
        rosterError,
        saveContact,
        savingContactFor,
        savingFor,
        teamMonitor
    } = useCrmRoster({ includeActive: true })

    const { interactionsByAccount, loadInteractions, logInteraction, roster: crmRoster } = useCrm({ scope: 'all' })

    // Region/team dashboard data backs both the full-width KPI strip (rendered
    // above the section nav, mirroring the Plan Statistics page) and the
    // Overview page's panels. Lifted here so it loads once per CRM session
    // instead of refetching every time Overview is reopened.
    const {
        dashboard: crmDashboard,
        desk: crmDesk,
        error: crmDashboardError,
        isDeskLoading: isCrmDeskLoading,
        isLoading: isCrmDashboardLoading
    } = useCrmDashboard()

    const crmKpis = useMemo(() => {
        const { activity, pipeline, roster: rosterKpis, teamFollowups } = crmDashboard
        return [
            { label: 'Accounts', value: rosterKpis.total },
            { label: 'Customers', value: rosterKpis.customers },
            { label: 'Prospects', value: rosterKpis.prospects },
            { label: 'Dormant', value: rosterKpis.dormant },
            { label: 'Open Opps', value: pipeline.realOpenTotal },
            { label: 'Follow-ups', value: teamFollowups.overdue.length + teamFollowups.dueToday.length },
            { label: 'Activity 7d', value: activity.interactionsLast7d }
        ]
    }, [crmDashboard])

    const handleAddProspect = useCallback(
        async (name) => {
            await CrmService.saveAccount({ lifecycleStage: 'prospect', name })
            refreshRoster()
        },
        [refreshRoster]
    )

    const [teamMonitorWindow, setTeamMonitorWindow] = useState(30)
    const [selectedAccountId, setSelectedAccountId] = useState(null)

    const handleSelectCustomer = useCallback((accountId) => setSelectedAccountId(accountId), [])
    const handleClearSelectedCustomer = useCallback(() => setSelectedAccountId(null), [])

    /** Archive a prospect (→ 'lost'), then return to the list so the now-hidden
     *  account isn't left open in the detail pane. */
    const handleArchiveAccount = useCallback(
        async (accountId, name) => {
            const ok = await archiveAccount(accountId, name)
            if (ok) handleClearSelectedCustomer()
        },
        [archiveAccount, handleClearSelectedCustomer]
    )

    // Clear selected customer on section change.
    useEffect(() => {
        setSelectedAccountId(null)
    }, [activeSection])

    // Pre-fetch activity when landing on the activity section.
    useEffect(() => {
        if (activeSection === 'activity' && recentActivity.length === 0 && !isLoadingActivity) {
            loadRecentActivity()
        }
    }, [activeSection, recentActivity.length, isLoadingActivity, loadRecentActivity])

    /** Activity feed row click → jump to the accounts page for that customer. */
    const handleActivitySelectCustomer = useCallback(
        (customerNum) => {
            if (!customerNum) return
            const row = roster.find((r) => r.customer_num === customerNum)
            if (!row) return
            setActiveTabRaw('customers')
            setActiveSection('accounts')
            setSelectedAccountId(row.account_id)
        },
        [roster]
    )

    // ── Derived state ────────────────────────────────────────────────────────

    const activeTabConfig = useMemo(() => CRM_TABS.find((t) => t.id === activeTab) ?? CRM_TABS[0], [activeTab])
    const visibleSectionIds = activeTabConfig.sections.filter((id) => !MANAGE_ONLY_SECTIONS.has(id) || canManage)

    const tone = accentColor

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div
            className="global-dashboard-container dashboard-container global-flush-top flush-top plan-view flex flex-col overflow-hidden absolute"
            style={{ inset: 0 }}
        >
            {/* Header */}
            <div className="shrink-0 flex items-center flex-nowrap gap-3 border-b px-3 sm:px-4 py-2.5 bg-bg-primary border-border-light overflow-x-auto">
                <h1 className="font-heading text-lg font-semibold tracking-tight m-0 shrink-0 text-text-primary">
                    Customer Relations
                </h1>
                <div className="flex-1 min-w-[8px]" />
                <CrmTabSwitcher
                    accentColor={tone}
                    activeTab={activeTab}
                    canManage={canManage}
                    onSelect={handleSelectTab}
                />
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto" data-content-scroll>
                <div className="px-3 sm:px-4 md:px-6 py-4 flex flex-col gap-4">
                    {/* Full-width region KPI strip — persists across sections,
                        mirroring the Plan Statistics page's top metrics bar. */}
                    <CrmKpiStrip isLoading={isCrmDashboardLoading} kpis={crmKpis} />

                    <div className="flex gap-4 items-start">
                        {visibleSectionIds.length > 1 && (
                            <CrmSidebar
                                accentColor={tone}
                                activeSection={activeSection}
                                onSelect={setActiveSection}
                                sectionIds={visibleSectionIds}
                            />
                        )}

                        <TabFadeIn animationKey={activeSection} className="flex-1 min-w-0 flex flex-col gap-3">
                            {activeSection === 'my-desk' && (
                                <CrmMyDeskPage
                                    accentColor={tone}
                                    dashboard={crmDashboard}
                                    desk={crmDesk}
                                    error={crmDashboardError}
                                    isDeskLoading={isCrmDeskLoading}
                                    isLoading={isCrmDashboardLoading}
                                />
                            )}

                            {activeSection === 'outreach' && (
                                <CrmOutreachPage
                                    accentColor={tone}
                                    colocationMap={undefined}
                                    contactsByCustomer={contactsByCustomer}
                                    deleteContact={deleteContact}
                                    deleteEntry={deleteEntry}
                                    historyByCustomer={historyByCustomer}
                                    isLoading={isLoadingRoster}
                                    loadContacts={loadContacts}
                                    loadHistory={loadHistory}
                                    loadingContactsFor={loadingContactsFor}
                                    loadingHistoryFor={loadingHistoryFor}
                                    logCall={logCall}
                                    onClearSelectedCustomer={handleClearSelectedCustomer}
                                    onSelectCustomer={handleSelectCustomer}
                                    plantNameByCode={undefined}
                                    roster={roster}
                                    rosterError={rosterError}
                                    saveContact={saveContact}
                                    savingContactFor={savingContactFor}
                                    savingFor={savingFor}
                                    selectedAccountId={selectedAccountId}
                                />
                            )}

                            {activeSection === 'followups' && <CrmFollowupsPage accentColor={tone} />}

                            {activeSection === 'accounts' && (
                                <CrmAccountsPage
                                    accountInteractionsByAccount={interactionsByAccount}
                                    accentColor={tone}
                                    colocationMap={undefined}
                                    contactsByCustomer={contactsByCustomer}
                                    deleteContact={deleteContact}
                                    deleteEntry={deleteEntry}
                                    historyByCustomer={historyByCustomer}
                                    isLoading={isLoadingRoster}
                                    loadAccountInteractions={loadInteractions}
                                    loadContacts={loadContacts}
                                    loadHistory={loadHistory}
                                    loadingContactsFor={loadingContactsFor}
                                    loadingHistoryFor={loadingHistoryFor}
                                    logCall={logCall}
                                    logInteraction={logInteraction}
                                    onAddProspect={handleAddProspect}
                                    onArchiveAccount={handleArchiveAccount}
                                    onClearSelectedCustomer={handleClearSelectedCustomer}
                                    onSelectCustomer={handleSelectCustomer}
                                    plantNameByCode={undefined}
                                    roster={roster}
                                    rosterError={rosterError}
                                    saveContact={saveContact}
                                    savingContactFor={savingContactFor}
                                    savingFor={savingFor}
                                    selectedAccountId={selectedAccountId}
                                />
                            )}

                            {activeSection === 'map' && <CrmMapPage accentColor={tone} roster={crmRoster} />}

                            {activeSection === 'pins' && <CrmPinsPage accentColor={tone} />}

                            {activeSection === 'pipeline' && <CrmPipelinePage accentColor={tone} />}

                            {activeSection === 'activity' && (
                                <CrmActivityPage
                                    accentColor={tone}
                                    isLoading={isLoadingActivity}
                                    onRefresh={loadRecentActivity}
                                    onSelectCustomer={handleActivitySelectCustomer}
                                    recentActivity={recentActivity}
                                />
                            )}

                            {activeSection === 'team-monitor' && canManage && (
                                <CrmTeamMonitorPage
                                    daysWindow={teamMonitorWindow}
                                    isLoading={isLoadingTeamMonitor}
                                    monitor={teamMonitor}
                                    onChangeWindow={setTeamMonitorWindow}
                                    onRefresh={loadTeamMonitor}
                                />
                            )}

                            {activeSection === 'settings' && canManage && <CrmSettingsPage accentColor={tone} />}
                        </TabFadeIn>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CrmView
