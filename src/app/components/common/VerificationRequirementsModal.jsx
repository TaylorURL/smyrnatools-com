import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom'

import { Database } from '../../../services/DatabaseService'
import { UserService } from '../../../services/UserService'
import DateUtility from '../../../utils/DateUtility'
import GrammarUtility from '../../../utils/GrammarUtility'
import { ValidationUtility } from '../../../utils/ValidationUtility'
import { useAccentColor } from '../../hooks/useAccentColor'
import ConfirmDialog from './ConfirmDialog'
import LoadingScreen from './LoadingScreen'

const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
const PILL_BASE =
    'inline-flex items-center rounded text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 shrink-0'
const FIELD_LABEL_CLASS = 'block text-[10px] font-semibold uppercase tracking-wider mb-1.5'

const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

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
    const [operatorData, setOperatorData] = useState(null)
    const [operatorPhone, setOperatorPhone] = useState('')
    const [operatorRating, setOperatorRating] = useState(0)
    const [issues, setIssues] = useState([])
    const [isLoadingOperator, setIsLoadingOperator] = useState(false)
    const [isLoadingIssues, setIsLoadingIssues] = useState(false)
    const [isSavingPhone, setIsSavingPhone] = useState(false)
    const [userNames, setUserNames] = useState({})
    const [expandedSection, setExpandedSection] = useState(null)
    const [comments, setComments] = useState([])
    const [isLoadingComments, setIsLoadingComments] = useState(false)
    const [canDelete, setCanDelete] = useState(false)
    const [pendingDeleteIssueId, setPendingDeleteIssueId] = useState(null)
    const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState(null)
    const [sectionsReady, setSectionsReady] = useState({
        checklist: false,
        comments: false,
        issues: false,
        operator: false
    })
    const openIssues = issues.filter((issue) => !issue.time_completed)
    const phoneOk = assignedOperator ? operatorPhone && operatorPhone.trim().length > 0 : true
    const ratingOk = assignedOperator ? operatorRating > 0 : true
    const operatorOk = phoneOk && ratingOk
    const serviceOverdue =
        lastServiceDate && typeof isServiceOverdue === 'function' ? isServiceOverdue(lastServiceDate) : false

    useEffect(() => {
        async function checkDeletePermission() {
            try {
                const currentUser = await UserService.getCurrentUser()
                const userId = currentUser?.id || null
                if (userId) {
                    const hasPermission = await UserService.hasPermission(userId, 'detailview.bypass.plantrestriction')
                    setCanDelete(hasPermission)
                }
            } catch {
                setCanDelete(false)
            }
        }
        checkDeletePermission()
    }, [])

    const fetchOperatorData = useCallback(async () => {
        setIsLoadingOperator(true)
        try {
            const { data, error } = await Database.from('operators')
                .select('*')
                .eq('employee_id', assignedOperator)
                .single()
            if (error) {
                console.error('Failed to fetch operator:', error)
                setOperatorData(null)
            } else if (data) {
                setOperatorData(data)
                setOperatorPhone(data.phone || '')
                setOperatorRating(typeof data.rating === 'number' ? data.rating : Number(data.rating) || 0)
            }
        } catch (error) {
            console.error('Failed to fetch operator:', error)
            setOperatorData(null)
        } finally {
            setIsLoadingOperator(false)
        }
    }, [assignedOperator])

    const fetchIssues = useCallback(async () => {
        setIsLoadingIssues(true)
        try {
            const fetchedIssues = await service.fetchIssues(itemId)
            setIssues(Array.isArray(fetchedIssues) ? fetchedIssues : [])
            const userIds = new Set()
            fetchedIssues.forEach((issue) => {
                if (issue.created_by) userIds.add(issue.created_by)
            })
            const names = {}
            for (const userId of userIds) {
                try {
                    const displayName = await UserService.getUserDisplayName(userId)
                    names[userId] = displayName || 'Unknown'
                } catch {
                    names[userId] = 'Unknown'
                }
            }
            setUserNames((prevNames) => ({ ...prevNames, ...names }))
        } catch (error) {
            console.error('Failed to fetch issues:', error)
            setIssues([])
        } finally {
            setIsLoadingIssues(false)
        }
    }, [service, itemId])

    const fetchComments = useCallback(async () => {
        setIsLoadingComments(true)
        try {
            const fetchedComments = await service.fetchComments(itemId)
            setComments(Array.isArray(fetchedComments) ? fetchedComments : [])
            const userIds = new Set()
            fetchedComments.forEach((comment) => {
                if (comment.author) userIds.add(comment.author)
            })
            const names = {}
            for (const userId of userIds) {
                try {
                    const displayName = await UserService.getUserDisplayName(userId)
                    names[userId] = displayName || 'Unknown'
                } catch {
                    names[userId] = 'Unknown'
                }
            }
            setUserNames((prevNames) => ({ ...prevNames, ...names }))
        } catch (error) {
            console.error('Failed to fetch comments:', error)
            setComments([])
        } finally {
            setIsLoadingComments(false)
        }
    }, [service, itemId])

    useEffect(() => {
        if (!open) {
            setSectionsReady({
                checklist: false,
                comments: false,
                issues: false,
                operator: false
            })
            setExpandedSection(null)
            return
        }
        const timers = []
        const delay = (fn, ms) => {
            const id = setTimeout(fn, ms)
            timers.push(id)
        }
        delay(() => setSectionsReady((prev) => ({ ...prev, checklist: true })), 50)
        if (assignedOperator) {
            fetchOperatorData().then(() => {
                delay(() => setSectionsReady((prev) => ({ ...prev, operator: true })), 150)
            })
        } else {
            delay(() => setSectionsReady((prev) => ({ ...prev, operator: true })), 150)
        }
        if (itemId && service) {
            fetchIssues().then(() => {
                delay(() => setSectionsReady((prev) => ({ ...prev, issues: true })), 250)
            })
            fetchComments().then(() => {
                delay(() => setSectionsReady((prev) => ({ ...prev, comments: true })), 350)
            })
        } else {
            delay(() => setSectionsReady((prev) => ({ ...prev, comments: true, issues: true })), 250)
        }
        return () => timers.forEach(clearTimeout)
    }, [open, assignedOperator, itemId, fetchOperatorData, fetchIssues, fetchComments, service])

    useEffect(() => {
        if (!open) return
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
        try {
            const formatted = GrammarUtility.formatPhone(operatorPhone)
            const { error } = await Database.from('operators')
                .update({ phone: formatted })
                .eq('employee_id', assignedOperator)
            if (error) {
                console.error('Failed to save phone:', error)
            } else {
                setOperatorPhone(formatted)
                await fetchOperatorData()
            }
        } catch (error) {
            console.error('Failed to save phone:', error)
        } finally {
            setIsSavingPhone(false)
        }
    }

    const handleSaveOperatorRating = async (rating) => {
        if (!assignedOperator) return
        try {
            const { error } = await Database.from('operators')
                .update({ rating: rating })
                .eq('employee_id', assignedOperator)
            if (error) console.error('Failed to save rating:', error)
            else setOperatorRating(rating)
        } catch (error) {
            console.error('Failed to save rating:', error)
        }
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
    const formatDate = (dateString) => {
        if (!dateString) return ''
        return new Date(dateString).toLocaleString()
    }
    const ratingLabels = [null, 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

    // Single-section accordion: clicking an open section closes it, clicking
    // another swaps the open one.
    const toggleSection = (sectionName) => setExpandedSection((prev) => (prev === sectionName ? null : sectionName))
    const isSectionExpanded = (sectionName) => expandedSection === sectionName

    if (typeof document === 'undefined' || !document.body) return null

    const severityPalette = (severity) => {
        switch (severity) {
            case 'High':
                return { bg: '#fee2e2', fg: '#b91c1c' }
            case 'Medium':
                return { bg: '#fef3c7', fg: '#92400e' }
            case 'Low':
                return { bg: '#dbeafe', fg: '#1e40af' }
            default:
                return { bg: 'var(--bg-tertiary)', fg: 'var(--text-secondary)' }
        }
    }

    return (
        <>
            {ReactDOM.createPortal(
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-[rgba(15,_23,_42,_0.65)]"
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="flex w-full max-w-[600px] flex-col overflow-hidden rounded max-h-[90vh] bg-bg-primary border border-border-light">
                        {/* Header */}
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

                        {/* Body */}
                        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2 bg-bg-secondary">
                            {/* Checklist section */}
                            {sectionsReady.checklist && (
                                <Section
                                    icon="fa-tasks"
                                    title="Required Information"
                                    accentColor={accentColor}
                                    expanded={isSectionExpanded('checklist')}
                                    onToggle={() => toggleSection('checklist')}
                                    pill={
                                        serviceOverdue ? (
                                            <Pill bg="#fef3c7" fg="#92400e">
                                                Service Overdue
                                            </Pill>
                                        ) : !requiredFieldsOk ? (
                                            <Pill bg="#fee2e2" fg="#b91c1c">
                                                Incomplete
                                            </Pill>
                                        ) : (
                                            <Pill bg="#dcfce7" fg="#166534">
                                                Complete
                                            </Pill>
                                        )
                                    }
                                >
                                    <div className="flex flex-col gap-3">
                                        {needsVin && (
                                            <div>
                                                <FieldLabel required={!vinOk}>VIN</FieldLabel>
                                                <input
                                                    type="text"
                                                    placeholder="17 characters (no I, O, Q)"
                                                    value={vin}
                                                    onChange={(e) =>
                                                        setVin(e.target.value.toUpperCase().replace(/[IOQ]/g, ''))
                                                    }
                                                    className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none font-mono tabular-nums"
                                                    style={{
                                                        ...FIELD_STYLE,
                                                        borderColor: vin && !vinOk ? '#dc2626' : 'var(--border-light)'
                                                    }}
                                                />
                                                <Hint>17 characters. Letters I, O, and Q are not used.</Hint>
                                                {vin && !vinOk && (
                                                    <div className="mt-1">
                                                        {vinInfo.reasons.map((r) => (
                                                            <div key={r} className="text-[10.5px] text-red-600">
                                                                {r}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {needsMake && (
                                            <SimpleField
                                                label="Make"
                                                required={!makeOk}
                                                value={make}
                                                onChange={setMake}
                                                placeholder="Make"
                                            />
                                        )}
                                        {needsModel && (
                                            <SimpleField
                                                label="Model"
                                                required={!modelOk}
                                                value={model}
                                                onChange={setModel}
                                                placeholder="Model"
                                            />
                                        )}
                                        {needsYear && (
                                            <SimpleField
                                                label="Year"
                                                required={!yearOk}
                                                value={year}
                                                onChange={setYear}
                                                placeholder="Year"
                                            />
                                        )}
                                        {(!lastServiceDate || serviceOverdue) && (
                                            <div>
                                                <FieldLabel>Last Service Date</FieldLabel>
                                                <input
                                                    type="date"
                                                    value={
                                                        lastServiceDate
                                                            ? lastServiceDate instanceof Date
                                                                ? lastServiceDate.toISOString().split('T')[0]
                                                                : String(lastServiceDate).split('T')[0]
                                                            : ''
                                                    }
                                                    onChange={(e) =>
                                                        setLastServiceDate(
                                                            e.target.value
                                                                ? DateUtility.parseLocalDate(e.target.value)
                                                                : null
                                                        )
                                                    }
                                                    className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none"
                                                    style={FIELD_STYLE}
                                                />
                                                {lastServiceDate && serviceOverdue && (
                                                    <Banner tone="warn" icon="fa-exclamation-triangle">
                                                        Service is overdue. You can still verify but service is
                                                        recommended.
                                                    </Banner>
                                                )}
                                                <Hint>
                                                    Service will show as overdue if it has been more than 6 months since
                                                    last serviced. Service is determined by hours on the asset — check
                                                    hours of service.
                                                </Hint>
                                            </div>
                                        )}
                                        {typeof lastChipDate !== 'undefined' && !lastChipDate && (
                                            <div>
                                                <FieldLabel>Last Chip Date</FieldLabel>
                                                <input
                                                    type="date"
                                                    value={
                                                        lastChipDate
                                                            ? lastChipDate instanceof Date
                                                                ? lastChipDate.toISOString().split('T')[0]
                                                                : String(lastChipDate).split('T')[0]
                                                            : ''
                                                    }
                                                    onChange={(e) =>
                                                        setLastChipDate(
                                                            e.target.value
                                                                ? DateUtility.parseLocalDate(e.target.value)
                                                                : null
                                                        )
                                                    }
                                                    className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none"
                                                    style={FIELD_STYLE}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </Section>
                            )}

                            {/* Operator section */}
                            {assignedOperator && sectionsReady.operator && (
                                <Section
                                    icon="fa-user"
                                    title="Operator Information"
                                    accentColor={accentColor}
                                    expanded={isSectionExpanded('operator')}
                                    onToggle={() => toggleSection('operator')}
                                    pill={
                                        operatorOk ? (
                                            <Pill bg="#dcfce7" fg="#166534">
                                                Complete
                                            </Pill>
                                        ) : !phoneOk && !ratingOk ? (
                                            <Pill bg="#fee2e2" fg="#b91c1c">
                                                Phone & Rating
                                            </Pill>
                                        ) : !phoneOk ? (
                                            <Pill bg="#fee2e2" fg="#b91c1c">
                                                Phone Required
                                            </Pill>
                                        ) : (
                                            <Pill bg="#fee2e2" fg="#b91c1c">
                                                Rating Required
                                            </Pill>
                                        )
                                    }
                                >
                                    {isLoadingOperator ? (
                                        <LoadingScreen message="Loading operator data..." inline={true} />
                                    ) : operatorData ? (
                                        <div>
                                            <OperatorRow label="Name" value={operatorData.name || 'N/A'} />
                                            {operatorData.position && (
                                                <OperatorRow label="Position" value={operatorData.position} />
                                            )}
                                            {operatorData.smyrna_id && (
                                                <OperatorRow label="Employee ID" value={operatorData.smyrna_id} mono />
                                            )}
                                            <OperatorRow
                                                label="Performance Rating"
                                                required={!ratingOk}
                                                value={
                                                    <div>
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="flex gap-0.5">
                                                                {[1, 2, 3, 4, 5].map((star) => (
                                                                    <button
                                                                        key={star}
                                                                        type="button"
                                                                        onClick={() => handleSaveOperatorRating(star)}
                                                                        className="border-none bg-transparent p-0 cursor-pointer"
                                                                        aria-label={`Rate ${star} of 5`}
                                                                    >
                                                                        <i
                                                                            className="fas fa-star text-[14px]"
                                                                            style={{
                                                                                color:
                                                                                    star <= operatorRating
                                                                                        ? '#f59e0b'
                                                                                        : 'var(--bg-tertiary)'
                                                                            }}
                                                                        />
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <span className="text-[11px] text-text-secondary">
                                                                {operatorRating > 0
                                                                    ? `${operatorRating}/5 · ${ratingLabels[operatorRating]}`
                                                                    : 'Not yet rated'}
                                                            </span>
                                                        </div>
                                                        {!ratingOk && (
                                                            <RequiredHint>
                                                                Rating required for verification
                                                            </RequiredHint>
                                                        )}
                                                    </div>
                                                }
                                            />
                                            <OperatorRow
                                                label="Phone Number"
                                                required={!phoneOk}
                                                last
                                                value={
                                                    <div>
                                                        <div className="flex gap-1.5">
                                                            <input
                                                                type="tel"
                                                                placeholder="(555) 555-5555"
                                                                value={operatorPhone}
                                                                onChange={(e) => setOperatorPhone(e.target.value)}
                                                                className="flex-1 rounded px-2.5 py-1.5 text-[12.5px] outline-none font-mono tabular-nums"
                                                                style={{
                                                                    ...FIELD_STYLE,
                                                                    borderColor: !phoneOk
                                                                        ? '#dc2626'
                                                                        : 'var(--border-light)'
                                                                }}
                                                            />
                                                            <button
                                                                onClick={handleSaveOperatorPhone}
                                                                disabled={isSavingPhone || !operatorPhone.trim()}
                                                                className="flex h-7 w-7 items-center justify-center rounded text-white border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                                style={{ background: accentColor }}
                                                                aria-label="Save phone"
                                                            >
                                                                <i
                                                                    className={`fas ${isSavingPhone ? 'fa-spinner fa-spin' : 'fa-save'} text-[11px]`}
                                                                />
                                                            </button>
                                                        </div>
                                                        {!phoneOk && (
                                                            <RequiredHint>Phone required for verification</RequiredHint>
                                                        )}
                                                    </div>
                                                }
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-6 px-3 text-center text-text-tertiary">
                                            <i className="fas fa-exclamation-triangle text-2xl mb-2" />
                                            <div className="text-[12px] font-semibold text-text-primary">
                                                Unable to load operator information
                                            </div>
                                            <div className="text-[11px] mt-0.5">
                                                The operator may have been removed or there was a connection issue
                                            </div>
                                        </div>
                                    )}
                                </Section>
                            )}

                            {/* Issues section */}
                            {itemId && service && sectionsReady.issues && (
                                <Section
                                    icon="fa-wrench"
                                    title="Maintenance Issues"
                                    accentColor={accentColor}
                                    expanded={isSectionExpanded('issues')}
                                    onToggle={() => toggleSection('issues')}
                                    pill={
                                        openIssues.length === 0 ? (
                                            <Pill bg="#dcfce7" fg="#166534">
                                                Complete
                                            </Pill>
                                        ) : (
                                            <Pill bg="#dbeafe" fg="#1e40af">
                                                {openIssues.length} Open
                                            </Pill>
                                        )
                                    }
                                >
                                    <Banner tone="warn" icon="fa-info-circle">
                                        Issues are shown for awareness only. Marking them resolved is optional.
                                    </Banner>
                                    {isLoadingIssues ? (
                                        <LoadingScreen message="Loading issues..." inline={true} />
                                    ) : openIssues.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-6 text-green-600">
                                            <i className="fas fa-check-circle text-2xl mb-1.5" />
                                            <span className="text-[12px] font-semibold">
                                                No open maintenance issues
                                            </span>
                                        </div>
                                    ) : (
                                        <>
                                            {hasHighSeverityIssues && (
                                                <Banner tone="danger" icon="fa-exclamation-triangle">
                                                    High severity issues detected. Consider resolving before
                                                    verification.
                                                </Banner>
                                            )}
                                            <div className="flex flex-col gap-1.5">
                                                {openIssues.map((issue) => {
                                                    const sev = severityPalette(issue.severity)
                                                    return (
                                                        <div
                                                            key={issue.id}
                                                            className="rounded p-2.5"
                                                            style={FIELD_STYLE}
                                                        >
                                                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                                <span
                                                                    className={PILL_BASE}
                                                                    style={{ background: sev.bg, color: sev.fg }}
                                                                >
                                                                    {issue.severity}
                                                                </span>
                                                                <span className="flex items-center gap-1 text-[10.5px] text-text-secondary">
                                                                    <i className="fas fa-user text-[9px]" />
                                                                    {userNames[issue.created_by] || 'Unknown'}
                                                                </span>
                                                                <span className="text-[10.5px] font-mono tabular-nums text-text-tertiary">
                                                                    {formatDate(issue.time_created)}
                                                                </span>
                                                                <div className="ml-auto flex gap-1">
                                                                    <IconButton
                                                                        icon="fa-check"
                                                                        bg="#dcfce7"
                                                                        fg="#166534"
                                                                        onClick={() => handleCompleteIssue(issue.id)}
                                                                        title="Mark as resolved"
                                                                    />
                                                                    {canDelete && (
                                                                        <IconButton
                                                                            icon="fa-trash"
                                                                            bg="#fee2e2"
                                                                            fg="#b91c1c"
                                                                            onClick={() => handleDeleteIssue(issue.id)}
                                                                            title="Delete issue"
                                                                        />
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="text-[12px] leading-snug text-text-primary">
                                                                {issue.issue}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </>
                                    )}
                                </Section>
                            )}

                            {/* Comments section */}
                            {itemId && service && sectionsReady.comments && (
                                <Section
                                    icon="fa-comments"
                                    title="Comments"
                                    accentColor={accentColor}
                                    expanded={isSectionExpanded('comments')}
                                    onToggle={() => toggleSection('comments')}
                                    pill={
                                        comments.length === 0 ? (
                                            <Pill bg="#dcfce7" fg="#166534">
                                                Complete
                                            </Pill>
                                        ) : (
                                            <Pill bg="#dbeafe" fg="#1e40af">
                                                {comments.length}
                                            </Pill>
                                        )
                                    }
                                >
                                    <Banner tone="warn" icon="fa-info-circle">
                                        Comments are shown for awareness only. Deleting them is optional.
                                    </Banner>
                                    {isLoadingComments ? (
                                        <LoadingScreen message="Loading comments..." inline={true} />
                                    ) : comments.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-6 text-text-tertiary">
                                            <i className="fas fa-info-circle text-2xl mb-1.5" />
                                            <span className="text-[12px]">No comments</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-1.5">
                                            {comments.map((comment) => (
                                                <div key={comment.id} className="rounded p-2.5" style={FIELD_STYLE}>
                                                    <div className="mb-1.5 flex items-center justify-between gap-2">
                                                        <span className="text-[10.5px] font-mono tabular-nums text-text-tertiary">
                                                            {formatDate(comment.createdAt)}
                                                        </span>
                                                        <IconButton
                                                            icon="fa-trash"
                                                            bg="#fee2e2"
                                                            fg="#b91c1c"
                                                            onClick={() => handleDeleteComment(comment.id)}
                                                            title="Delete comment"
                                                        />
                                                    </div>
                                                    <div className="text-[12px] leading-snug text-text-primary">
                                                        {comment.text}
                                                    </div>
                                                    {comment.author && userNames[comment.author] && (
                                                        <div className="mt-1.5 flex items-center gap-1 text-[10.5px] text-text-secondary">
                                                            <i className="fas fa-user text-[9px]" />
                                                            {userNames[comment.author]}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Section>
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

                        {/* Footer */}
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

/* ── Plan-tab styled atoms ─────────────────────────────────────────────── */

function Section({ accentColor, children, expanded, icon, onToggle, pill, title }) {
    return (
        <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left cursor-pointer border-none transition-colors hover:bg-bg-tertiary bg-transparent"
            >
                <div className="flex items-center gap-2 min-w-0">
                    <div
                        className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary"
                        style={{ color: accentColor }}
                    >
                        <i className={`fas ${icon} text-[11px]`} />
                    </div>
                    <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                        {title}
                    </span>
                    {pill}
                </div>
                <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} text-[10px] text-text-tertiary`} />
            </button>
            {expanded && <div className="px-3 py-2.5 bg-bg-primary border-t border-border-light">{children}</div>}
        </div>
    )
}

function Pill({ bg, children, fg }) {
    return (
        <span className={PILL_BASE} style={{ background: bg, color: fg }}>
            {children}
        </span>
    )
}

function FieldLabel({ children, required }) {
    return (
        <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
            {children}
            {required && (
                <span className="ml-1.5 inline-flex items-center rounded px-1 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-white bg-red-600">
                    Required
                </span>
            )}
        </label>
    )
}

function SimpleField({ label, onChange, placeholder, required, value }) {
    return (
        <div>
            <FieldLabel required={required}>{label}</FieldLabel>
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none"
                style={FIELD_STYLE}
            />
        </div>
    )
}

function Hint({ children }) {
    return <p className="mt-1 text-[10.5px] leading-snug text-text-tertiary">{children}</p>
}

function RequiredHint({ children }) {
    return (
        <div className="mt-1 flex items-center gap-1 text-[10.5px] text-red-600">
            <i className="fas fa-exclamation-circle text-[10px]" />
            {children}
        </div>
    )
}

function Banner({ children, icon, tone = 'warn' }) {
    const palette =
        tone === 'danger'
            ? { bg: '#fee2e2', border: '#fca5a5', fg: '#b91c1c' }
            : { bg: '#fef3c7', border: '#fcd34d', fg: '#92400e' }
    return (
        <div
            className="flex items-start gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-medium leading-snug mb-2"
            style={{
                background: palette.bg,
                border: `1px solid ${palette.border}`,
                color: palette.fg
            }}
        >
            <i className={`fas ${icon} text-[11px] mt-0.5 shrink-0`} />
            <span>{children}</span>
        </div>
    )
}

function OperatorRow({ label, last, mono, required, value }) {
    return (
        <div
            className="flex items-start gap-3 py-2"
            style={{ borderBottom: last ? 'none' : '1px solid var(--border-light)' }}
        >
            <div className="w-[40%] shrink-0">
                <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                    {label}
                </div>
                {required && (
                    <span className="mt-1 inline-flex items-center rounded px-1 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-white bg-red-600">
                        Required
                    </span>
                )}
            </div>
            <div className={`flex-1 min-w-0 text-[12.5px] ${mono ? 'font-mono tabular-nums' : ''} text-text-primary`}>
                {value}
            </div>
        </div>
    )
}

function IconButton({ bg, fg, icon, onClick, title }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            aria-label={title}
            className="flex h-6 w-6 items-center justify-center rounded border-none cursor-pointer transition-colors hover:brightness-95"
            style={{ background: bg, color: fg }}
        >
            <i className={`fas ${icon} text-[10px]`} />
        </button>
    )
}
