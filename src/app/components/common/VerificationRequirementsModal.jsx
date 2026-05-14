/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom'

import APIUtility from '../../../utils/APIUtility'
import GrammarUtility from '../../../utils/GrammarUtility'
import { ValidationUtility } from '../../../utils/ValidationUtility'
import { SECTION_LABEL_CLASS } from '../../constants/verificationModalConstants'
import { useAccentColor } from '../../hooks/useAccentColor'
import useVerificationModalData from '../../hooks/useVerificationModalData'
import { Banner } from '../verification/VerificationAtoms'
import VerificationChecklistSection from '../verification/VerificationChecklistSection'
import VerificationCommentsSection from '../verification/VerificationCommentsSection'
import VerificationIssuesSection from '../verification/VerificationIssuesSection'
import VerificationOperatorSection from '../verification/VerificationOperatorSection'
import ConfirmDialog from './ConfirmDialog'

/**
 * Multi-section verification checklist modal for asset verification workflows.
 * Collects and validates required fields (VIN, make, model, year, service dates),
 * operator information (phone, rating), displays open maintenance issues and comments,
 * and enforces business rules before allowing verification.
 */
export default function VerificationRequirementsModal({
    open,
    onClose,
    onSaveAndVerify,
    missingFields = [],
    vin,
    make,
    model,
    year,
    lastServiceDate,
    lastChipDate,
    setVin,
    setMake,
    setModel,
    setYear,
    setLastServiceDate,
    setLastChipDate,
    isServiceOverdue,
    assignedOperator,
    itemType,
    itemId,
    service,
    status
}) {
    const accentColor = useAccentColor()
    const [isSavingPhone, setIsSavingPhone] = useState(false)
    const [pendingDeleteIssueId, setPendingDeleteIssueId] = useState(null)
    const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState(null)
    const [expandedSection, setExpandedSection] = useState(null)

    const {
        canDelete,
        comments,
        fetchComments,
        fetchIssues,
        fetchOperatorData,
        isLoadingComments,
        isLoadingIssues,
        isLoadingOperator,
        issues,
        operatorData,
        operatorPhone,
        operatorRating,
        sectionsReady,
        setOperatorPhone,
        setOperatorRating,
        userNames
    } = useVerificationModalData({ assignedOperator, itemId, open, service })

    const openIssues = issues.filter((issue) => !issue.time_completed)
    const phoneOk = assignedOperator ? operatorPhone && operatorPhone.trim().length > 0 : true
    const ratingOk = assignedOperator ? operatorRating > 0 : true
    const operatorOk = phoneOk && ratingOk
    const serviceOverdue =
        lastServiceDate && typeof isServiceOverdue === 'function' ? isServiceOverdue(lastServiceDate) : false

    useEffect(() => {
        if (!open) {
            setExpandedSection(null)
            return
        }
        const allSectionsReady = Object.values(sectionsReady).every((ready) => ready)
        if (!allSectionsReady) return
        // Auto-expand the highest-priority section that needs attention.
        // Only one section is open at a time so the modal stays scannable.
        let priority = null
        if (missingFields.length > 0 || serviceOverdue) priority = 'checklist'
        else if (!operatorOk) priority = 'operator'
        else if (openIssues.length > 0) priority = 'issues'
        else if (comments.length > 0) priority = 'comments'
        if (priority) {
            const id = setTimeout(() => setExpandedSection(priority), 400)
            return () => clearTimeout(id)
        }
    }, [
        open,
        sectionsReady,
        operatorOk,
        openIssues.length,
        missingFields.length,
        itemId,
        service,
        serviceOverdue,
        comments.length
    ])

    const handleSaveOperatorPhone = async () => {
        if (!operatorPhone || !assignedOperator) return
        setIsSavingPhone(true)
        const formatted = GrammarUtility.formatPhone(operatorPhone)
        const { res } = await APIUtility.post('/operator-service/patch-phone-rating', {
            employeeId: assignedOperator,
            phone: formatted
        })
        if (res.ok) {
            setOperatorPhone(formatted)
            await fetchOperatorData()
        }
        setIsSavingPhone(false)
    }

    const handleSaveOperatorRating = async (rating) => {
        if (!assignedOperator) return
        const { res } = await APIUtility.post('/operator-service/patch-phone-rating', {
            employeeId: assignedOperator,
            rating
        })
        if (res.ok) setOperatorRating(rating)
    }

    const handleCompleteIssue = async (issueId) => {
        try {
            await service.completeIssue(issueId)
            await fetchIssues()
        } catch (error) {
            console.error('Failed to complete issue:', error)
        }
    }

    const handleDeleteIssue = (issueId) => setPendingDeleteIssueId(issueId)
    const confirmDeleteIssue = async () => {
        const issueId = pendingDeleteIssueId
        setPendingDeleteIssueId(null)
        try {
            await service.deleteIssue(issueId)
            await fetchIssues()
        } catch (error) {
            console.error('Failed to delete issue:', error)
        }
    }
    const handleDeleteComment = (commentId) => setPendingDeleteCommentId(commentId)
    const confirmDeleteComment = async () => {
        const commentId = pendingDeleteCommentId
        setPendingDeleteCommentId(null)
        try {
            await service.deleteComment(commentId)
            await fetchComments()
        } catch (error) {
            console.error('Failed to delete comment:', error)
        }
    }

    const handleSaveAndVerify = async () => {
        if (assignedOperator && operatorPhone && operatorPhone.trim().length > 0) {
            await handleSaveOperatorPhone()
        }
        onSaveAndVerify()
    }

    const vinInfo = useMemo(() => ValidationUtility.explainVIN(vin || ''), [vin])
    if (!open) return null
    const needsVin = missingFields.includes('VIN')
    const needsMake = missingFields.includes('Make')
    const needsModel = missingFields.includes('Model')
    const needsYear = missingFields.includes('Year')
    const vinOk = needsVin ? vinInfo.valid : true
    const makeOk = needsMake ? !!String(make).trim() : true
    const modelOk = needsModel ? !!String(model).trim() : true
    const yearOk = needsYear ? !!String(year).trim() : true
    const requiredFieldsOk = vinOk && makeOk && modelOk && yearOk
    const hasHighSeverityIssues = openIssues.some((issue) => issue.severity === 'High')
    const isMixerInShopWithoutIssues =
        itemType?.toLowerCase() === 'mixer' && status === 'In Shop' && openIssues.length === 0
    const canVerify = requiredFieldsOk && operatorOk && !isMixerInShopWithoutIssues

    // Single-section accordion: clicking an open section closes it, clicking
    // another swaps the open one.
    const toggleSection = (sectionName) => setExpandedSection((prev) => (prev === sectionName ? null : sectionName))
    const isSectionExpanded = (sectionName) => expandedSection === sectionName

    if (typeof document === 'undefined' || !document.body) return null

    return (
        <>
            {ReactDOM.createPortal(
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-[rgba(15,_23,_42,_0.65)]"
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="flex w-full max-w-[600px] flex-col overflow-hidden rounded max-h-[90vh] bg-bg-primary border border-border-light">
                        <div className="flex items-center justify-between gap-2.5 px-3 py-2 shrink-0 border-b border-border-light">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                    className="flex h-7 w-7 items-center justify-center rounded shrink-0 bg-bg-tertiary"
                                    style={{ color: accentColor }}
                                >
                                    <i className="fas fa-clipboard-check text-[12px]" />
                                </div>
                                <div className="min-w-0">
                                    <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                        Verification Checklist
                                    </div>
                                    <div className="text-[11px] truncate text-text-tertiary">
                                        Review requirements before verifying this {itemType?.toLowerCase()}
                                    </div>
                                </div>
                            </div>
                            <button
                                className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-bg-tertiary text-text-secondary"
                                onClick={onClose}
                                title="Close"
                                aria-label="Close"
                            >
                                <i className="fas fa-times text-[11px]" />
                            </button>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2 bg-bg-secondary">
                            {sectionsReady.checklist && (
                                <VerificationChecklistSection
                                    accentColor={accentColor}
                                    expanded={isSectionExpanded('checklist')}
                                    lastChipDate={lastChipDate}
                                    lastServiceDate={lastServiceDate}
                                    make={make}
                                    makeOk={makeOk}
                                    model={model}
                                    modelOk={modelOk}
                                    needsMake={needsMake}
                                    needsModel={needsModel}
                                    needsVin={needsVin}
                                    needsYear={needsYear}
                                    onToggle={() => toggleSection('checklist')}
                                    requiredFieldsOk={requiredFieldsOk}
                                    serviceOverdue={serviceOverdue}
                                    setLastChipDate={setLastChipDate}
                                    setLastServiceDate={setLastServiceDate}
                                    setMake={setMake}
                                    setModel={setModel}
                                    setVin={setVin}
                                    setYear={setYear}
                                    vin={vin}
                                    vinInfo={vinInfo}
                                    vinOk={vinOk}
                                    year={year}
                                    yearOk={yearOk}
                                />
                            )}

                            {assignedOperator && sectionsReady.operator && (
                                <VerificationOperatorSection
                                    accentColor={accentColor}
                                    expanded={isSectionExpanded('operator')}
                                    isLoadingOperator={isLoadingOperator}
                                    isSavingPhone={isSavingPhone}
                                    onSavePhone={handleSaveOperatorPhone}
                                    onSaveRating={handleSaveOperatorRating}
                                    onToggle={() => toggleSection('operator')}
                                    operatorData={operatorData}
                                    operatorOk={operatorOk}
                                    operatorPhone={operatorPhone}
                                    operatorRating={operatorRating}
                                    phoneOk={phoneOk}
                                    ratingOk={ratingOk}
                                    setOperatorPhone={setOperatorPhone}
                                />
                            )}

                            {itemId && service && sectionsReady.issues && (
                                <VerificationIssuesSection
                                    accentColor={accentColor}
                                    canDelete={canDelete}
                                    expanded={isSectionExpanded('issues')}
                                    hasHighSeverityIssues={hasHighSeverityIssues}
                                    isLoadingIssues={isLoadingIssues}
                                    onCompleteIssue={handleCompleteIssue}
                                    onDeleteIssue={handleDeleteIssue}
                                    onToggle={() => toggleSection('issues')}
                                    openIssues={openIssues}
                                    userNames={userNames}
                                />
                            )}

                            {itemId && service && sectionsReady.comments && (
                                <VerificationCommentsSection
                                    accentColor={accentColor}
                                    comments={comments}
                                    expanded={isSectionExpanded('comments')}
                                    isLoadingComments={isLoadingComments}
                                    onDeleteComment={handleDeleteComment}
                                    onToggle={() => toggleSection('comments')}
                                    userNames={userNames}
                                />
                            )}
                        </div>

                        {isMixerInShopWithoutIssues && (
                            <div className="mx-3 mb-2">
                                <Banner tone="danger" icon="fa-exclamation-triangle">
                                    Mixers in &quot;In Shop&quot; status must have at least one active issue before they
                                    can be verified. Please add an issue describing why this mixer is in the shop.
                                </Banner>
                            </div>
                        )}

                        <div className="flex gap-2 px-3 py-2 shrink-0 bg-bg-secondary border-t border-border-light">
                            <button
                                onClick={onClose}
                                className="flex-1 rounded px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider cursor-pointer transition-colors hover:brightness-95 bg-bg-primary border border-border-light text-text-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveAndVerify}
                                disabled={!canVerify}
                                className="flex-[2] flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ background: accentColor }}
                            >
                                <i className="fas fa-check-circle text-[10px]" />
                                {canVerify ? 'Save & Verify' : 'Complete Requirements'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            <ConfirmDialog
                isOpen={pendingDeleteIssueId !== null}
                onConfirm={confirmDeleteIssue}
                onCancel={() => setPendingDeleteIssueId(null)}
                title="Delete Issue"
                message="Are you sure you want to delete this issue?"
                confirmLabel="Delete"
                variant="danger"
            />
            <ConfirmDialog
                isOpen={pendingDeleteCommentId !== null}
                onConfirm={confirmDeleteComment}
                onCancel={() => setPendingDeleteCommentId(null)}
                title="Delete Comment"
                message="Are you sure you want to delete this comment?"
                confirmLabel="Delete"
                variant="danger"
            />
        </>
    )
}
