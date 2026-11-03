/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useState } from 'react'

import { UserService } from '../../../services/UserService'
import APIUtility from '../../../utils/APIUtility'
import ErrorReporterUtility from '../../../utils/ErrorReporterUtility'
import GrammarUtility from '../../../utils/GrammarUtility'
import { ValidationUtility } from '../../../utils/ValidationUtility'
import { useAccentColor } from '../../hooks/useAccentColor'
import useVerificationModalData from '../../hooks/useVerificationModalData'
import Dialog from '../ui/Dialog'
import VerificationChecklistSection, { parseHoursValue } from '../verification/VerificationChecklistSection'
import VerificationCommentsSection from '../verification/VerificationCommentsSection'
import VerificationIssuesSection from '../verification/VerificationIssuesSection'
import VerificationOperatorSection from '../verification/VerificationOperatorSection'
import ConfirmDialog from './ConfirmDialog'
import useDialogClose from './useDialogClose'

/**
 * Translates a raw error message from the verify API call into a clear,
 * actionable reason the user can act on. Defaults to the original message
 * when no known signal matches so server-supplied detail still surfaces.
 */
function buildVerifyFailureReason(rawMessage, itemTypeDisplay) {
    const message = String(rawMessage || '').trim()
    const lower = message.toLowerCase()
    const target = (itemTypeDisplay || 'asset').toLowerCase()
    if (
        lower.includes('unauthorized') ||
        lower.includes('session') ||
        lower.includes('401') ||
        lower.includes('user id is required') ||
        lower.includes('no current user')
    ) {
        return `Your session expired before we could save this ${target}. Refresh the page, sign in again, and re-enter the hours.`
    }
    if (lower.includes('forbidden') || lower.includes('permission') || lower.includes('access denied')) {
        return `Your account does not have permission to verify this ${target}. Ask an administrator to grant access for this plant or region.`
    }
    if (
        lower.includes('timed out') ||
        lower.includes('timeout') ||
        lower.includes('network') ||
        lower.includes('fetch')
    ) {
        return `Network problem reached the server but the verification did not save. Check your connection and try again.`
    }
    if (lower.includes('not found')) {
        return `This ${target} could not be found on the server — it may have been retired or removed by another user. Close and reopen the list.`
    }
    if (message) return `We could not save this verification: ${message}`
    return `We could not save this verification. Try again — if it keeps failing, refresh the page or contact support.`
}

/** A flat danger notice: the reason verification can't go ahead. */
const NOTICE_DANGER =
    'rounded-[4px] border border-[color:var(--notice-danger-border)] bg-[color:var(--notice-danger-bg)] px-3 py-2 text-[13px] leading-snug text-[color:var(--notice-danger-strong)]'

/** How many of the requirements are met, as a line of text and a thin bar
 *  that turns green once nothing is left in the way. */
function ProgressTrack({ blockers, total }) {
    const completed = total - blockers
    const percent = total === 0 ? 100 : Math.round((completed / total) * 100)
    return (
        <div>
            <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[12px] font-medium text-text-secondary">
                    {blockers === 0 ? 'Ready to verify' : `${completed} of ${total} requirements met`}
                </span>
                <span className="text-[12px] tabular-nums text-text-tertiary">{percent}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-bg-tertiary">
                <div
                    className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${
                        blockers === 0 ? 'bg-status-active' : 'bg-accent'
                    }`}
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    )
}

/**
 * Multi-section verification checklist modal for asset verification workflows.
 * Collects and validates required fields, operator information, displays open
 * maintenance issues and comments, and enforces business rules before verifying.
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
    hours,
    lastServiceDate,
    lastChipDate,
    setVin,
    setMake,
    setModel,
    setYear,
    setHours,
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
    const { anchorRef, handleClose } = useDialogClose(onClose)
    const [isSavingPhone, setIsSavingPhone] = useState(false)
    const [pendingDeleteIssueId, setPendingDeleteIssueId] = useState(null)
    const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState(null)
    const [expandedSection, setExpandedSection] = useState(null)
    const [isVerifying, setIsVerifying] = useState(false)
    const [verifyError, setVerifyError] = useState(null)

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

    // Once every section has loaded, auto-expand the one most in need of
    // attention — verification blockers (checklist, operator) ahead of
    // informational sections (issues, comments).
    useEffect(() => {
        if (!open) {
            setExpandedSection(null)
            setVerifyError(null)
            setIsVerifying(false)
            return
        }
        const allSectionsReady = Object.values(sectionsReady).every((ready) => ready)
        if (!allSectionsReady) return
        let priority = null
        const needsHoursAttention = typeof setHours === 'function' && !parseHoursValue(hours).valid
        if (missingFields.length > 0 || serviceOverdue || needsHoursAttention) priority = 'checklist'
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
        comments.length,
        hours,
        setHours
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

    const handleAddIssue = async ({ severity, text }) => {
        if (!service?.addIssue || !itemId) return
        const trimmed = text.trim()
        if (!trimmed) return
        const currentUser = await UserService.getCurrentUser()
        const userId = currentUser?.id || currentUser || null
        await service.addIssue(itemId, trimmed, severity, userId)
        await fetchIssues()
    }

    const handleAddComment = async (text) => {
        if (!service?.addComment || !itemId) return
        const trimmed = text.trim()
        if (!trimmed) return
        const currentUser = await UserService.getCurrentUser()
        const userId = currentUser?.id || currentUser || null
        await service.addComment(itemId, trimmed, userId)
        await fetchComments()
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
        if (isVerifying) return
        setVerifyError(null)
        setIsVerifying(true)
        try {
            if (assignedOperator && operatorPhone && operatorPhone.trim().length > 0) {
                await handleSaveOperatorPhone()
            }
            await onSaveAndVerify()
        } catch (error) {
            const normalized = error instanceof Error ? error : new Error(String(error))
            ErrorReporterUtility.reportError(normalized, {
                context: 'VerificationRequirementsModal.handleSaveAndVerify',
                itemId,
                itemType
            })
            setVerifyError(buildVerifyFailureReason(normalized.message, itemTypeDisplay))
        } finally {
            setIsVerifying(false)
        }
    }

    const vinInfo = useMemo(() => ValidationUtility.explainVIN(vin || ''), [vin])
    if (!open) return null
    const needsVin = missingFields.includes('VIN')
    const needsMake = missingFields.includes('Make')
    const needsModel = missingFields.includes('Model')
    const needsYear = missingFields.includes('Year')
    const needsHours = typeof setHours === 'function'
    const vinOk = needsVin ? vinInfo.valid : true
    const makeOk = needsMake ? !!String(make).trim() : true
    const modelOk = needsModel ? !!String(model).trim() : true
    const yearOk = needsYear ? !!String(year).trim() : true
    const hoursOk = needsHours ? parseHoursValue(hours).valid : true
    const requiredFieldsOk = vinOk && makeOk && modelOk && yearOk && hoursOk
    const hasHighSeverityIssues = openIssues.some((issue) => issue.severity === 'High')
    const isMixerInShopWithoutIssues =
        itemType?.toLowerCase() === 'mixer' && status === 'In Shop' && openIssues.length === 0
    const canVerify = requiredFieldsOk && operatorOk && !isMixerInShopWithoutIssues

    const totalRequirements = 2 + (isMixerInShopWithoutIssues ? 1 : 0)
    const blockers = (requiredFieldsOk ? 0 : 1) + (operatorOk ? 0 : 1) + (isMixerInShopWithoutIssues ? 1 : 0)

    const toggleSection = (sectionName) => setExpandedSection((prev) => (prev === sectionName ? null : sectionName))
    const isSectionExpanded = (sectionName) => expandedSection === sectionName

    if (typeof document === 'undefined' || !document.body) return null

    const itemTypeDisplay = itemType ? itemType.charAt(0).toUpperCase() + itemType.slice(1).toLowerCase() : 'Asset'

    return (
        <>
            <Dialog
                open
                onClose={handleClose}
                size="md"
                title={`Verify ${itemTypeDisplay.toLowerCase()}`}
                description="Review the items below before confirming verification."
                zClassName="z-system"
                bodyClassName="bg-bg-secondary px-6 py-5"
                toolbar={<ProgressTrack blockers={blockers} total={totalRequirements} />}
                footer={
                    <>
                        <button type="button" onClick={onClose} disabled={isVerifying} className="btn-secondary">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveAndVerify}
                            disabled={!canVerify || isVerifying}
                            aria-busy={isVerifying}
                            className="btn-primary"
                        >
                            {isVerifying && <i className="fas fa-spinner fa-spin text-[12px]" aria-hidden="true" />}
                            {isVerifying
                                ? `Verifying ${itemTypeDisplay.toLowerCase()}…`
                                : canVerify
                                  ? `Verify ${itemTypeDisplay.toLowerCase()}`
                                  : 'Complete required items'}
                        </button>
                    </>
                }
            >
                <div ref={anchorRef} className="flex flex-col gap-3">
                    {sectionsReady.checklist && (
                        <VerificationChecklistSection
                            expanded={isSectionExpanded('checklist')}
                            hours={hours}
                            hoursOk={hoursOk}
                            lastChipDate={lastChipDate}
                            lastServiceDate={lastServiceDate}
                            make={make}
                            makeOk={makeOk}
                            model={model}
                            modelOk={modelOk}
                            needsHours={needsHours}
                            needsMake={needsMake}
                            needsModel={needsModel}
                            needsVin={needsVin}
                            needsYear={needsYear}
                            onToggle={() => toggleSection('checklist')}
                            requiredFieldsOk={requiredFieldsOk}
                            serviceOverdue={serviceOverdue}
                            setHours={setHours}
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
                            canAddIssue={typeof service?.addIssue === 'function'}
                            canDelete={canDelete}
                            expanded={isSectionExpanded('issues')}
                            hasHighSeverityIssues={hasHighSeverityIssues}
                            isLoadingIssues={isLoadingIssues}
                            onAddIssue={handleAddIssue}
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
                            canAddComment={typeof service?.addComment === 'function'}
                            comments={comments}
                            expanded={isSectionExpanded('comments')}
                            isLoadingComments={isLoadingComments}
                            onAddComment={handleAddComment}
                            onDeleteComment={handleDeleteComment}
                            onToggle={() => toggleSection('comments')}
                            userNames={userNames}
                        />
                    )}

                    {isMixerInShopWithoutIssues && (
                        <div className={NOTICE_DANGER}>
                            Mixers in &quot;In Shop&quot; status need at least one active issue before they can be
                            verified. Add an issue describing why this mixer is in the shop.
                        </div>
                    )}

                    {verifyError && (
                        <div role="alert" aria-live="polite" className={NOTICE_DANGER}>
                            {verifyError}
                        </div>
                    )}
                </div>
            </Dialog>
            <ConfirmDialog
                isOpen={pendingDeleteIssueId !== null}
                onConfirm={confirmDeleteIssue}
                onCancel={() => setPendingDeleteIssueId(null)}
                title="Delete this issue?"
                message="This can't be undone."
                confirmLabel="Delete"
                variant="danger"
            />
            <ConfirmDialog
                isOpen={pendingDeleteCommentId !== null}
                onConfirm={confirmDeleteComment}
                onCancel={() => setPendingDeleteCommentId(null)}
                title="Delete this comment?"
                message="This can't be undone."
                confirmLabel="Delete"
                variant="danger"
            />
        </>
    )
}
