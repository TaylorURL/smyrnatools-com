import React, { useState } from 'react'

import { MaintenanceEquipmentDetail } from '../../../app/components/maintenance/MaintenanceEquipmentDetail'
import { MaintenanceEquipmentModal } from '../../../app/components/maintenance/MaintenanceEquipmentModal'
import { MaintenanceFormsRail } from '../../../app/components/maintenance/MaintenanceFormsRail'
import { MaintenanceLogSidebar } from '../../../app/components/maintenance/MaintenanceLogSidebar'
import { ContentSkeleton } from '../../../app/components/maintenance/MaintenanceLogSkeleton'
import { MaintenanceLogTable } from '../../../app/components/maintenance/MaintenanceLogTable'
import { MaintenanceServiceModal } from '../../../app/components/maintenance/MaintenanceServiceModal'
import { isDarkLikeTheme } from '../../../app/constants/themeConstants'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { useIsMobile } from '../../../app/hooks/useIsMobile'
import { useMaintenanceLogActions } from '../../../app/hooks/useMaintenanceLogActions'
import { useMaintenanceLogFilters } from '../../../app/hooks/useMaintenanceLogFilters'
import MaintenanceFormView from './MaintenanceFormView'

export default function MaintenanceLogView({
    categories,
    categoryFilter,
    dueItems = [],
    equipment,
    formLoading = false,
    loading,
    mySubmissions = [],
    onCloseAddModal,
    onFormDataReload,
    onReload,
    pendingReviews = [],
    permissions = { canCreate: false, canReview: false },
    plants,
    recentEntries,
    reviewedSubmissions = [],
    searchText,
    selectedPlant,
    serviceTypes,
    showAddModal,
    statusFilter
}) {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#2A3163'
    const isDark = isDarkLikeTheme(preferences.themeMode)
    const isMobile = useIsMobile()

    const [calendarDate, setCalendarDate] = useState(new Date())

    const { filtered, sorted, sortKey, sortDir, handleHeaderClick } = useMaintenanceLogFilters({
        categoryFilter,
        equipment,
        plants,
        searchText,
        selectedPlant,
        statusFilter
    })

    const {
        detailTarget,
        editTarget,
        handleDeleteSubmission,
        handleFormSubmitted,
        handleSelectFormItem,
        openEdit,
        openLogService,
        selectedFormItem,
        serviceTarget,
        setDetailTarget,
        setEditTarget,
        setSelectedFormItem,
        setServiceTarget
    } = useMaintenanceLogActions({ onFormDataReload })

    /* Rail is visible to every user — the per-plant rollup is the only
     * way a non-reviewer can see whether the plants in their scope have
     * submitted their monthly maintenance. Permission gates still apply
     * to the destructive actions (create / review / approve / reject)
     * at the service layer; this only controls visibility of the list. */
    const showFormsRail = true

    const equipmentBody = (
        <div className="flex-1 overflow-y-auto">
            <div className="w-full px-3 sm:px-4 lg:px-6 py-3 sm:py-5">
                {loading ? (
                    <ContentSkeleton isMobile={isMobile} />
                ) : (
                    <div className={`flex gap-3 items-start ${isMobile ? 'flex-col' : ''}`}>
                        <div className="flex-1 min-w-0 w-full overflow-hidden">
                            <MaintenanceLogTable
                                sorted={sorted}
                                hasEquipment={equipment.length > 0}
                                sortKey={sortKey}
                                sortDir={sortDir}
                                onHeaderClick={handleHeaderClick}
                                onRowClick={setDetailTarget}
                                onLogService={setServiceTarget}
                                isDark={isDark}
                                accentColor={accentColor}
                            />
                        </div>
                        {!isMobile && (
                            <MaintenanceLogSidebar
                                equipment={equipment}
                                filtered={filtered}
                                recentEntries={recentEntries}
                                calendarDate={calendarDate}
                                onCalendarDateChange={setCalendarDate}
                                isDark={isDark}
                                accentColor={accentColor}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    )

    return (
        <>
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-bg-secondary">
                {showFormsRail && !(isMobile && selectedFormItem) && (
                    <aside className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 overflow-y-auto bg-bg-primary max-h-[50vh] lg:max-h-none border-b lg:border-b-0 lg:border-r border-border-light">
                        <MaintenanceFormsRail
                            accentColor={accentColor}
                            canReview={!!permissions.canReview}
                            dueItems={dueItems}
                            formLoading={formLoading}
                            mySubmissions={mySubmissions}
                            onDeleteSubmission={handleDeleteSubmission}
                            onSelectItem={handleSelectFormItem}
                            pendingReviews={pendingReviews}
                            reviewedSubmissions={reviewedSubmissions}
                            searchText={searchText}
                            selectedItemId={selectedFormItem?.id || null}
                            selectedPlant={selectedPlant}
                        />
                    </aside>
                )}
                <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
                    {selectedFormItem ? (
                        <MaintenanceFormView
                            item={selectedFormItem}
                            onBack={() => setSelectedFormItem(null)}
                            onSubmitted={handleFormSubmitted}
                        />
                    ) : (
                        equipmentBody
                    )}
                </main>
            </div>

            <MaintenanceEquipmentModal
                mode="add"
                isOpen={showAddModal}
                onClose={onCloseAddModal}
                onSaved={() => {
                    onCloseAddModal()
                    onReload()
                }}
                categories={categories}
                plants={plants}
                accentColor={accentColor}
            />

            <MaintenanceServiceModal
                isOpen={!!serviceTarget}
                onClose={() => setServiceTarget(null)}
                onSaved={() => {
                    setServiceTarget(null)
                    onReload()
                }}
                equipment={serviceTarget}
                serviceTypes={serviceTypes}
                accentColor={accentColor}
            />

            <MaintenanceEquipmentDetail
                equipment={detailTarget}
                onClose={() => setDetailTarget(null)}
                onLogService={openLogService}
                onEdit={openEdit}
                onDelete={() => {
                    setDetailTarget(null)
                    onReload()
                }}
                isDark={isDark}
                accentColor={accentColor}
            />

            <MaintenanceEquipmentModal
                mode="edit"
                isOpen={!!editTarget}
                onClose={() => setEditTarget(null)}
                onSaved={() => {
                    setEditTarget(null)
                    onReload()
                }}
                equipment={editTarget}
                categories={categories}
                plants={plants}
                accentColor={accentColor}
            />
        </>
    )
}
