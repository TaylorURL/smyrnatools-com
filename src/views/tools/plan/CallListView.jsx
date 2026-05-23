/* eslint-disable react/forbid-dom-props */
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { CallListSkeleton } from '../../../app/components/common/PlanSkeletons'
import TabFadeIn from '../../../app/components/common/TabFadeIn'
import {
    CallListActivityPage,
    CallListDirectoryPage,
    CallListOutreachPage
} from '../../../app/components/plan/tabs/call-list/CallListPages'
import {
    CALL_LIST_SECTIONS,
    CallListSectionTabs,
    CallListSidebar,
    visibleCallListSections
} from '../../../app/components/plan/tabs/call-list/CallListSidebar'
import { CallListTeamMonitorPage } from '../../../app/components/plan/tabs/call-list/CallListTeamMonitorPage'
import { useAuth } from '../../../app/context/AuthContext'
import useCallList from '../../../app/hooks/useCallList'
import { UserService } from '../../../services/UserService'

/**
 * Plan → Call List tab. Layout mirrors Operations → Statistics: a left
 * sidebar that routes between sub-pages, each one a focused worksheet.
 *
 *   - Outreach Queue: dormant customers that need a call.
 *   - Activity Feed: chronological log of every team call — click an
 *     entry to jump to that customer's detail.
 *   - Directory: full searchable roster including cooldown rows.
 *
 * Per-section list/detail toggle: clicking a customer card hides the
 * list (and the section's filter strip) and renders only that customer's
 * full detail view, mirroring the Statistics → Customer Lookup pattern.
 * The "Back to list" button at the top of the detail returns to the
 * list. Loading skeletons swap in for both the list and the detail when
 * the underlying data is mid-fetch so users never see stale rows
 * for the wrong filter window.
 */
function CallListView({ accentColor, planColocationMap, plantNameByCode }) {
    const {
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
    } = useCallList({ includeActive: true })

    /** Role-weight gate for the Team Monitor side menu. The fetch fires
     *  once per user; until it resolves we treat the user as weight 0
     *  (sidebar hides Team Monitor by default — a brief flash is far
     *  preferable to leaking the management surface to weight-0 users). */
    const { user } = useAuth()
    const [userRoleWeight, setUserRoleWeight] = useState(0)
    useEffect(() => {
        let cancelled = false
        if (!user?.id) {
            setUserRoleWeight(0)
            return undefined
        }
        UserService.getUserWeight(user.id)
            .then((weight) => {
                if (!cancelled) setUserRoleWeight(Number(weight) || 0)
            })
            .catch(() => {
                if (!cancelled) setUserRoleWeight(0)
            })
        return () => {
            cancelled = true
        }
    }, [user?.id])

    const tone = accentColor || '#1e3a5f'
    const [activeSection, setActiveSection] = useState('outreach')
    const [teamMonitorWindow, setTeamMonitorWindow] = useState(30)

    /** Bounce the user back to the Outreach Queue if they're sitting on
     *  a section their role weight doesn't clear. Covers stale state
     *  (the user opened Team Monitor as a manager, then their role
     *  changed) and the rare deep-link case. */
    useEffect(() => {
        const allowed = visibleCallListSections(userRoleWeight)
        if (!allowed.some((section) => section.id === activeSection)) {
            setActiveSection(allowed[0]?.id || 'outreach')
        }
    }, [activeSection, userRoleWeight])
    /** A single customer is selected at a time across the tab. Outreach
     *  and Directory both consume this; the Activity Feed selects the
     *  matching customer and routes the user to the Outreach detail
     *  view when a feed entry is clicked. */
    const [selectedCustomerNum, setSelectedCustomerNum] = useState(null)

    const handleSelectCustomer = useCallback((num) => {
        setSelectedCustomerNum(num)
    }, [])

    const handleClearSelectedCustomer = useCallback(() => {
        setSelectedCustomerNum(null)
    }, [])

    /** Clear the selected customer whenever the user switches sub-pages.
     *  Avoids the confusing state where a stale selection sticks around
     *  after the user navigates to a different surface. */
    useEffect(() => {
        setSelectedCustomerNum(null)
    }, [activeSection])

    /** Clicking a row in the Activity Feed jumps the user to that
     *  customer's detail view on the Outreach page. The customer might
     *  live in the cooldown tier (already called), so we fall back to
     *  Directory when the roster lookup misses Outreach's `fresh`
     *  filter. */
    const handleActivitySelectCustomer = useCallback(
        (customerNum) => {
            if (!customerNum) return
            const row = roster.find((r) => r.customer_num === customerNum)
            if (!row) return
            setActiveSection('directory')
            setSelectedCustomerNum(customerNum)
        },
        [roster]
    )

    useEffect(() => {
        if (activeSection === 'activity' && recentActivity.length === 0 && !isLoadingActivity) {
            loadRecentActivity()
        }
    }, [activeSection, recentActivity.length, isLoadingActivity, loadRecentActivity])

    /* Team Monitor's initial fetch is owned by the page component itself
     * (its `daysWindow` effect fires on mount + window-change). We do NOT
     * auto-load here — that effect was looping forever whenever the
     * fetch returned an empty list or an error: `rows.length === 0 &&
     * !isLoading` stays true after each completed fetch, so the effect
     * re-fired and re-started the request. */

    const sectionMeta = useMemo(
        () => CALL_LIST_SECTIONS.find((s) => s.id === activeSection) || CALL_LIST_SECTIONS[0],
        [activeSection]
    )

    const dormantCount = useMemo(
        () => roster.filter((r) => r.pouring_status === 'dormant' || !r.pouring_status).length,
        [roster]
    )

    if (isLoadingRoster && roster.length === 0) return <CallListSkeleton />

    return (
        <div className="flex-1 min-h-0 overflow-y-auto animate-fade-in-fast" data-content-scroll>
            <div className="px-3 sm:px-4 md:px-6 py-4 flex flex-col gap-4">
                <Header
                    description={sectionMeta.description}
                    dormantCount={dormantCount}
                    label={sectionMeta.label}
                    onRefresh={() => {
                        refreshRoster()
                        if (activeSection === 'activity') loadRecentActivity()
                        if (activeSection === 'team-monitor') loadTeamMonitor({ daysWindow: teamMonitorWindow })
                    }}
                    rosterCount={roster.length}
                />

                <CallListSectionTabs
                    accentColor={tone}
                    activeSection={activeSection}
                    onSelect={setActiveSection}
                    userRoleWeight={userRoleWeight}
                />

                <div className="flex gap-4 items-start">
                    <CallListSidebar
                        accentColor={tone}
                        activeSection={activeSection}
                        onSelect={setActiveSection}
                        userRoleWeight={userRoleWeight}
                    />
                    <TabFadeIn animationKey={activeSection} className="flex-1 min-w-0 flex flex-col gap-3">
                        {activeSection === 'outreach' && (
                            <CallListOutreachPage
                                accentColor={tone}
                                colocationMap={planColocationMap}
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
                                plantNameByCode={plantNameByCode}
                                roster={roster}
                                rosterError={rosterError}
                                saveContact={saveContact}
                                savingContactFor={savingContactFor}
                                savingFor={savingFor}
                                selectedCustomerNum={selectedCustomerNum}
                            />
                        )}
                        {activeSection === 'activity' && (
                            <CallListActivityPage
                                accentColor={tone}
                                isLoading={isLoadingActivity}
                                onRefresh={loadRecentActivity}
                                onSelectCustomer={handleActivitySelectCustomer}
                                recentActivity={recentActivity}
                            />
                        )}
                        {activeSection === 'team-monitor' && userRoleWeight >= 31 && (
                            <CallListTeamMonitorPage
                                daysWindow={teamMonitorWindow}
                                isLoading={isLoadingTeamMonitor}
                                monitor={teamMonitor}
                                // Just update the window state — the page's own
                                // `daysWindow` effect picks up the change and
                                // fires the reload via `onRefresh`. Calling
                                // `loadTeamMonitor` here too caused a double
                                // fetch on every window switch.
                                onChangeWindow={setTeamMonitorWindow}
                                onRefresh={loadTeamMonitor}
                            />
                        )}
                        {activeSection === 'directory' && (
                            <CallListDirectoryPage
                                accentColor={tone}
                                colocationMap={planColocationMap}
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
                                plantNameByCode={plantNameByCode}
                                roster={roster}
                                rosterError={rosterError}
                                saveContact={saveContact}
                                savingContactFor={savingContactFor}
                                savingFor={savingFor}
                                selectedCustomerNum={selectedCustomerNum}
                            />
                        )}
                    </TabFadeIn>
                </div>
            </div>
        </div>
    )
}

function Header({ description, dormantCount, label, onRefresh, rosterCount }) {
    const activeCount = rosterCount - dormantCount
    return (
        <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
                <div className="text-[18px] sm:text-[22px] font-bold leading-tight text-text-primary font-heading">
                    Call List
                </div>
                <div className="text-[11.5px] sm:text-[12px] text-text-secondary">
                    {description} · {dormantCount} dormant · {activeCount} active customer
                    {activeCount === 1 ? '' : 's'}
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onRefresh}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold border-none cursor-pointer bg-bg-secondary border border-border-light text-text-secondary"
                    title="Reload the roster + activity feed"
                >
                    <i className="fas fa-rotate text-[10px]" />
                    Refresh
                </button>
            </div>
            <span className="hidden" data-section-label={label} />
        </div>
    )
}

export default CallListView
