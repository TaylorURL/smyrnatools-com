/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useState } from 'react'

import { DEFAULT_ACCENT_COLOR } from '../../constants/themeConstants'
import { usePreferences } from '../../context/PreferencesContext'
import { usePlantPermissions } from '../../hooks/usePlantPermissions'
import { useRegionTransfer } from '../../hooks/useRegionTransfer'
import { DetailViewContext } from './detail-view/DetailViewContext'
import DetailViewDeleteModal from './detail-view/DetailViewDeleteModal'
import DetailViewHeader from './detail-view/DetailViewHeader'
import DetailViewMessagePortal from './detail-view/DetailViewMessagePortal'
import DetailViewMobileNav from './detail-view/DetailViewMobileNav'
import DetailViewNotFound from './detail-view/DetailViewNotFound'
import {
    Banner,
    Button,
    Card,
    Divider,
    Field,
    Input,
    Rating,
    Row,
    Section,
    Select,
    Textarea,
    Toggle
} from './detail-view/DetailViewSubcomponents'
import DetailViewTransferModal from './detail-view/DetailViewTransferModal'

/**
 * Full-screen record page for editing one asset, person, plant or region.
 * The header carries the title, the record's tools (issues, comments,
 * history) and its commit actions (Save, Delete, Transfer); the sections sit
 * as tabs under it. Also owns plant-based edit restrictions, region transfer,
 * delete confirmation, the loading and saving overlays, and the phone's
 * bottom bar, which takes over the tabs and actions under the breakpoint.
 */
function DetailViewSection({
    title,
    subtitle,
    icon,
    onClose,
    onBack,
    headerActions,
    children,
    isSaving = false,
    message = null,
    canEdit = true,
    restrictionWarning = null,
    className = '',
    isLoading = false,
    loadingMessage = 'Loading...',
    notFound = false,
    notFoundMessage = 'Item not found',
    notFoundDescription = 'The requested item could not be found.',
    showDeleteConfirmation = false,
    onDeleteConfirm = null,
    onDeleteCancel = null,
    deleteTitle = 'Delete Item',
    deleteMessage = 'This action cannot be undone.',
    footerActions = null,
    modals = null,
    itemAssignedPlant,
    onCanEditChange,
    currentRegion = null,
    assetType = null,
    onRegionTransfer = null
}) {
    const { preferences } = usePreferences()
    const accent = preferences.accentColor || DEFAULT_ACCENT_COLOR
    const { warning } = usePlantPermissions({ canEdit, itemAssignedPlant, onCanEditChange, restrictionWarning })
    const transfer = useRegionTransfer({ assetType, onRegionTransfer })
    const [activeSection, setActiveSection] = useState('')
    const [sections, setSections] = useState([])
    const registerSection = (section) => {
        setSections((prev) => {
            if (prev.find((s) => s.id === section.id)) return prev
            return [...prev, section]
        })
    }
    useEffect(() => {
        if (sections.length > 0 && !activeSection) {
            setActiveSection(sections[0].id)
        }
    }, [sections, activeSection])
    if (notFound) {
        return (
            <DetailViewNotFound
                accent={accent}
                className={className}
                notFoundDescription={notFoundDescription}
                notFoundMessage={notFoundMessage}
                onBack={onBack}
                onClose={onClose}
            />
        )
    }
    return (
        <DetailViewContext.Provider value={{ activeSection, registerSection, sections, setActiveSection }}>
            <div
                className={`${className} fixed bottom-0 right-0 left-[var(--rail-width,0px)] top-[var(--topbar-height,0px)] z-shell flex flex-col bg-bg-secondary`}
                style={{ '--dv-accent': accent }}
            >
                {isSaving && (
                    <div className="absolute inset-0 z-nav flex flex-col items-center justify-center gap-3 bg-bg-primary/95">
                        <div
                            className="h-10 w-10 rounded-full border-[3px] border-border-light animate-dv-spin"
                            style={{ borderTopColor: accent }}
                        ></div>
                        <span className="text-[12.5px] font-medium text-text-secondary">Saving changes...</span>
                    </div>
                )}
                <DetailViewHeader
                    headerActions={headerActions}
                    icon={icon}
                    onBack={onBack}
                    onClose={onClose}
                    subtitle={subtitle}
                    title={title}
                    commitActions={
                        (footerActions || (transfer.hasTransferPerm && onRegionTransfer && currentRegion)) && (
                            <>
                                {footerActions}
                                {transfer.hasTransferPerm && onRegionTransfer && currentRegion && (
                                    <button
                                        type="button"
                                        className="global-button-secondary"
                                        onClick={transfer.openTransfer}
                                        disabled={isSaving}
                                        title="Transfer Region"
                                    >
                                        <i className="fas fa-arrow-right-arrow-left"></i>
                                        <span>Transfer</span>
                                    </button>
                                )}
                            </>
                        )
                    }
                    tabs={!isLoading && sections.length > 1 ? sections : null}
                    activeSection={activeSection}
                    setActiveSection={setActiveSection}
                />
                <div className="dv-container flex min-h-0 flex-1 overflow-hidden w-full">
                    {isLoading ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-3">
                            <div
                                className="h-10 w-10 rounded-full border-[3px] border-border-light animate-dv-spin"
                                style={{ borderTopColor: accent }}
                            ></div>
                            <span className="text-[12.5px] font-medium text-text-secondary">{loadingMessage}</span>
                        </div>
                    ) : (
                        <>
                            <main className="dv-main-content min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-bg-secondary px-4 py-6 sm:px-6 lg:px-8">
                                <div className="w-full animate-dv-fade-in">{children}</div>
                            </main>
                            <DetailViewMobileNav
                                accent={accent}
                                activeSection={activeSection}
                                footerActions={footerActions}
                                sections={sections}
                                setActiveSection={setActiveSection}
                            />
                        </>
                    )}
                </div>
                <DetailViewMessagePortal message={message} warning={warning} />
                <DetailViewDeleteModal
                    deleteMessage={deleteMessage}
                    deleteTitle={deleteTitle}
                    onDeleteCancel={onDeleteCancel}
                    onDeleteConfirm={onDeleteConfirm}
                    show={showDeleteConfirmation}
                />
                <DetailViewTransferModal
                    accent={accent}
                    assetType={assetType}
                    closeTransfer={transfer.closeTransfer}
                    currentRegion={currentRegion}
                    doTransfer={transfer.doTransfer}
                    plants={transfer.plants}
                    regions={transfer.regions}
                    setTargetPlant={transfer.setTargetPlant}
                    setTargetRegion={transfer.setTargetRegion}
                    show={transfer.showTransfer}
                    targetPlant={transfer.targetPlant}
                    targetRegion={transfer.targetRegion}
                    transferErr={transfer.transferErr}
                    transferring={transfer.transferring}
                />
                {modals}
            </div>
        </DetailViewContext.Provider>
    )
}
DetailViewSection.Section = Section
DetailViewSection.Card = Card
DetailViewSection.Row = Row
DetailViewSection.Field = Field
DetailViewSection.Input = Input
DetailViewSection.Select = Select
DetailViewSection.Textarea = Textarea
DetailViewSection.Button = Button
DetailViewSection.Divider = Divider
DetailViewSection.Banner = Banner
DetailViewSection.Toggle = Toggle
DetailViewSection.Rating = Rating
export default DetailViewSection
