import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

import MessageService from '../../../services/MessageService'
import { UserService } from '../../../services/UserService'
import { usePreferences } from '../../context/PreferencesContext'
import ErrorMessage from '../common/ErrorMessage'
import LoadingScreen from '../common/LoadingScreen'

const SEVERITY_PALETTE = {
    High: { bg: '#fee2e2', fg: '#b91c1c', icon: 'fa-fire' },
    Low: { bg: '#dcfce7', fg: '#166534', icon: 'fa-leaf' },
    Medium: { bg: '#dbeafe', fg: '#1e40af', icon: 'fa-bolt' }
}

const PILL_BASE =
    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-wider'

const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
}

const getInitials = (mgr) => {
    if (!mgr) return '?'
    const f = mgr.firstName?.[0] || ''
    const l = mgr.lastName?.[0] || ''
    return (f + l).toUpperCase() || '?'
}

const getNameInitials = (name) => {
    if (!name || name === 'Unknown') return '?'
    const parts = name.split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
}

function SendIssueMessageModal({ issue, itemNumber, itemType, creatorName, onClose }) {
    const [managers, setManagers] = useState([])
    const [selectedManager, setSelectedManager] = useState(null)
    const [commentary, setCommentary] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState('')
    const [managerDropdownOpen, setManagerDropdownOpen] = useState(false)
    const dropdownRef = useRef(null)
    const { preferences } = usePreferences()
    const accent = preferences?.accentColor || '#1e3a5f'
    const regionCode = preferences?.selectedRegion?.code || ''
    const sevConfig = SEVERITY_PALETTE[issue.severity] || SEVERITY_PALETTE.Medium

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setManagerDropdownOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setLoading(true)
            try {
                const list = await MessageService.getRegionalRecipients(regionCode)
                if (!cancelled) setManagers(list)
            } catch {
                setError('Failed to load team members')
            }
            setLoading(false)
        }
        load()
        return () => {
            cancelled = true
        }
    }, [regionCode])

    const handleSend = async () => {
        if (!selectedManager || sending) return
        setSending(true)
        setError('')
        try {
            const currentUser = await UserService.getCurrentUser()
            const subject = `Issue on ${itemType} ${itemNumber || ''} — ${issue.severity} Severity`
            const attachment = {
                meta: {
                    issueId: issue.id,
                    issueText: issue.issue,
                    itemNumber,
                    itemType,
                    reportedBy: creatorName,
                    severity: issue.severity
                },
                type: 'issue'
            }
            await MessageService.sendMessage(
                currentUser?.id,
                selectedManager.id,
                subject,
                commentary || issue.issue,
                attachment
            )
            window.dispatchEvent(new Event('messages-refresh'))
            setSent(true)
        } catch (e) {
            setError(e?.message || 'Failed to send message')
        }
        setSending(false)
    }

    return (
        <div
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
            className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-[rgba(15,_23,_42,_0.65)]"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="flex flex-col max-h-[90vh] max-w-[520px] w-full overflow-hidden rounded bg-bg-primary border border-border-light"
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div
                            className="w-7 h-7 rounded flex items-center justify-center shrink-0 bg-bg-tertiary"
                            style={{ color: accent }}
                        >
                            <i className="fas fa-paper-plane text-[12px]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                                Send Message
                            </div>
                            <div className="text-[12px] truncate text-text-primary">Notify a team member</div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded transition-colors bg-transparent text-text-secondary"
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                        <i className="fas fa-times text-[12px]" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3">
                    {sent ? (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <div className="w-12 h-12 rounded flex items-center justify-center bg-green-100 text-[#166534]">
                                <i className="fas fa-check text-[18px]" />
                            </div>
                            <div className="text-[14px] font-semibold text-text-primary">Message Sent</div>
                            <div className="text-[11px] text-text-secondary">
                                {selectedManager?.firstName} {selectedManager?.lastName} will be notified
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded text-[10.5px] font-semibold uppercase tracking-wider px-3 py-1.5 mt-1 text-white"
                                style={{ background: accent }}
                            >
                                Done
                            </button>
                        </div>
                    ) : (
                        <>
                            <div
                                className="rounded mb-3 overflow-hidden bg-bg-secondary border border-border-light"
                                style={{ borderLeft: `3px solid ${sevConfig.fg}` }}
                            >
                                <div className="px-3 py-2.5">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                                            {itemType}
                                        </span>
                                        <span className="text-[12px] font-semibold font-mono tabular-nums text-text-primary">
                                            {itemNumber || 'N/A'}
                                        </span>
                                        <span
                                            className={PILL_BASE + ' ml-auto'}
                                            style={{ background: sevConfig.bg, color: sevConfig.fg }}
                                        >
                                            <i className={`fas ${sevConfig.icon} text-[8px]`} />
                                            {issue.severity}
                                        </span>
                                    </div>
                                    <p className="text-[12px] leading-relaxed m-0 whitespace-pre-wrap text-text-primary">
                                        {issue.issue}
                                    </p>
                                    <div className="text-[10.5px] mt-1.5 text-text-tertiary">
                                        Reported by {creatorName}
                                    </div>
                                </div>
                            </div>

                            <div className="mb-3">
                                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1 text-text-secondary">
                                    Send to
                                </label>
                                {loading ? (
                                    <div className="rounded px-3 py-2 bg-bg-secondary border border-border-light">
                                        <LoadingScreen message="Loading team members..." inline />
                                    </div>
                                ) : (
                                    <div ref={dropdownRef} className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setManagerDropdownOpen((prev) => !prev)}
                                            className="w-full flex items-center gap-2.5 rounded px-3 py-2 text-left text-[12px] bg-bg-secondary"
                                            style={{
                                                border: `1px solid ${managerDropdownOpen ? accent : 'var(--border-light)'}`,
                                                color: selectedManager ? 'var(--text-primary)' : 'var(--text-tertiary)'
                                            }}
                                        >
                                            {selectedManager ? (
                                                <>
                                                    <div
                                                        className="w-7 h-7 rounded flex items-center justify-center shrink-0 text-[10px] font-bold text-white"
                                                        style={{ background: accent }}
                                                    >
                                                        {getInitials(selectedManager)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-semibold truncate">
                                                            {selectedManager.firstName} {selectedManager.lastName}
                                                        </div>
                                                        <div className="text-[10.5px] truncate text-text-secondary">
                                                            {selectedManager.roleName}
                                                            {selectedManager.plantCode
                                                                ? ` · ${selectedManager.plantCode}`
                                                                : ''}
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fas fa-user-plus text-[12px]" />
                                                    <span>Select a recipient...</span>
                                                </>
                                            )}
                                            <i
                                                className="fas fa-chevron-down text-[9px] ml-auto text-text-secondary"
                                                style={{
                                                    transform: managerDropdownOpen ? 'rotate(180deg)' : 'none',
                                                    transition: 'transform 0.2s'
                                                }}
                                            />
                                        </button>
                                        {managerDropdownOpen && (
                                            <div
                                                className="absolute left-0 right-0 mt-1 rounded overflow-y-auto z-10 bg-bg-primary border border-border-light"
                                                style={{ maxHeight: 220, top: '100%' }}
                                            >
                                                {managers.length === 0 ? (
                                                    <div className="text-center py-3 text-[11px] text-text-tertiary">
                                                        No team members found
                                                    </div>
                                                ) : (
                                                    managers.map((mgr) => {
                                                        const isSelected = selectedManager?.id === mgr.id
                                                        return (
                                                            <button
                                                                key={mgr.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedManager(mgr)
                                                                    setManagerDropdownOpen(false)
                                                                }}
                                                                className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors border-b border-border-light"
                                                                style={{
                                                                    background: isSelected
                                                                        ? 'var(--bg-tertiary)'
                                                                        : 'transparent'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    if (!isSelected)
                                                                        e.currentTarget.style.background =
                                                                            'var(--bg-secondary)'
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    if (!isSelected)
                                                                        e.currentTarget.style.background = 'transparent'
                                                                }}
                                                            >
                                                                <div
                                                                    className="w-6 h-6 rounded flex items-center justify-center shrink-0 text-[9px] font-bold"
                                                                    style={{
                                                                        background: isSelected
                                                                            ? accent
                                                                            : 'var(--bg-tertiary)',
                                                                        color: isSelected
                                                                            ? '#fff'
                                                                            : 'var(--text-secondary)'
                                                                    }}
                                                                >
                                                                    {getInitials(mgr)}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-[12px] font-semibold truncate text-text-primary">
                                                                        {mgr.firstName} {mgr.lastName}
                                                                    </div>
                                                                    <div className="text-[10.5px] truncate text-text-secondary">
                                                                        {mgr.roleName}
                                                                        {mgr.plantCode ? ` · ${mgr.plantCode}` : ''}
                                                                    </div>
                                                                </div>
                                                                {isSelected && (
                                                                    <i
                                                                        className="fas fa-check text-[10px]"
                                                                        style={{ color: accent }}
                                                                    />
                                                                )}
                                                            </button>
                                                        )
                                                    })
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="mb-3">
                                <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1 text-text-secondary">
                                    Message{' '}
                                    <span className="font-normal normal-case text-text-tertiary">(optional)</span>
                                </label>
                                <textarea
                                    value={commentary}
                                    onChange={(e) => setCommentary(e.target.value)}
                                    placeholder="Add context, questions, or instructions..."
                                    rows="3"
                                    className="w-full rounded outline-none px-3 py-2 text-[12px] resize-vertical bg-bg-secondary border border-border-light text-text-primary"
                                />
                            </div>

                            {error && (
                                <div className="rounded px-3 py-2 mb-3 text-[11px] font-semibold bg-red-100 text-red-700">
                                    <i className="fas fa-exclamation-triangle mr-2 text-[10px]" />
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleSend}
                                disabled={!selectedManager || sending}
                                className="w-full rounded text-[11px] font-semibold uppercase tracking-wider py-2 inline-flex items-center justify-center gap-1.5"
                                style={{
                                    background: !selectedManager || sending ? 'var(--bg-tertiary)' : accent,
                                    color: !selectedManager || sending ? 'var(--text-tertiary)' : '#fff',
                                    cursor: !selectedManager || sending ? 'not-allowed' : 'pointer'
                                }}
                            >
                                <i className={`fas ${sending ? 'fa-spinner fa-spin' : 'fa-paper-plane'} text-[10px]`} />
                                {sending ? 'Sending' : 'Send Message'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

function IssueModalSection({ itemId, itemNumber, itemType, onClose, service }) {
    const { preferences } = usePreferences()
    const accent = preferences?.accentColor || '#1e3a5f'
    const [issues, setIssues] = useState([])
    const [newIssue, setNewIssue] = useState('')
    const [severity, setSeverity] = useState('Medium')
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState(null)
    const [userNames, setUserNames] = useState({})
    const [canDelete, setCanDelete] = useState(false)
    const [activeTab, setActiveTab] = useState('open')
    const [messageIssue, setMessageIssue] = useState(null)

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

    const sortedIssues = [...issues].sort((a, b) => new Date(b.time_created) - new Date(a.time_created))
    const openIssues = sortedIssues.filter((issue) => !issue.time_completed)
    const resolvedIssues = sortedIssues.filter((issue) => issue.time_completed)

    const fetchIssues = useCallback(async () => {
        setIsLoading(true)
        setError(null)
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
            setUserNames((prev) => ({ ...prev, ...names }))
        } catch {
            setError('Failed to load issues. Please try again.')
            setIssues([])
        } finally {
            setIsLoading(false)
        }
    }, [itemId, service])

    useEffect(() => {
        if (itemId) fetchIssues()
    }, [itemId, fetchIssues])

    const handleDeleteIssue = async (issueId) => {
        if (!window.confirm('Are you sure you want to delete this issue?')) return
        try {
            await service.deleteIssue(issueId)
            fetchIssues()
        } catch {
            setError('Failed to delete issue. Please try again.')
        }
    }

    const handleCompleteIssue = async (issueId) => {
        try {
            await service.completeIssue(issueId)
            fetchIssues()
        } catch {
            setError('Failed to complete issue. Please try again.')
        }
    }

    const handleAddIssue = async (e) => {
        e.preventDefault()
        if (!newIssue.trim()) {
            setError('Please enter an issue description')
            return
        }
        setIsSubmitting(true)
        setError(null)
        try {
            const currentUser = await UserService.getCurrentUser()
            const userId = currentUser?.id || null
            if (!userId) {
                setError('You must be logged in to add an issue')
                return
            }
            await service.addIssue(itemId, newIssue, severity, userId)
            setNewIssue('')
            setSeverity('Medium')
            fetchIssues()
        } catch (err) {
            setError(err.message || 'Failed to add issue. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const getCreatorName = (issue) => {
        if (issue.created_by && userNames[issue.created_by]) return userNames[issue.created_by]
        return 'Unknown'
    }

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose()
    }

    const displayIssues = activeTab === 'open' ? openIssues : resolvedIssues
    if (typeof document === 'undefined' || !document.body) return null

    const TabBtn = ({ id, label, count, icon }) => {
        const isActive = activeTab === id
        return (
            <button
                onClick={() => setActiveTab(id)}
                className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider"
                style={{
                    background: isActive ? accent : 'var(--bg-tertiary)',
                    color: isActive ? '#fff' : 'var(--text-secondary)'
                }}
            >
                <i className={`fas ${icon} text-[10px]`} />
                {label}
                {count > 0 && (
                    <span
                        className="rounded px-1 font-mono tabular-nums"
                        style={{
                            background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--bg-secondary)',
                            color: isActive ? '#fff' : 'var(--text-secondary)'
                        }}
                    >
                        {count}
                    </span>
                )}
            </button>
        )
    }

    return ReactDOM.createPortal(
        <>
            <div
                onClick={handleBackdropClick}
                className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-[rgba(15,_23,_42,_0.65)]"
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex flex-col max-h-[90vh] max-w-[580px] w-full overflow-hidden rounded bg-bg-primary border border-border-light"
                >
                    <div className="px-4 py-3 border-b border-border-light">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded flex items-center justify-center shrink-0 bg-bg-tertiary text-text-secondary">
                                    <i className="fas fa-exclamation-circle text-[12px]" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                                        {itemType} · Issues
                                    </div>
                                    <div className="text-[14px] font-semibold font-mono tabular-nums truncate text-text-primary">
                                        {itemNumber || itemId}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-7 h-7 flex items-center justify-center rounded transition-colors bg-transparent text-text-secondary"
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                                <i className="fas fa-times text-[12px]" />
                            </button>
                        </div>
                        <div className="flex gap-1.5 mt-2.5">
                            <TabBtn id="open" label="Open" count={openIssues.length} icon="fa-clock" />
                            <TabBtn
                                id="resolved"
                                label="Resolved"
                                count={resolvedIssues.length}
                                icon="fa-check-circle"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-3">
                        <ErrorMessage message={error} onDismiss={() => setError(null)} />

                        {activeTab === 'open' && (
                            <form onSubmit={handleAddIssue} className="mb-3">
                                <div className="rounded p-2.5 bg-bg-secondary border border-border-light">
                                    <textarea
                                        value={newIssue}
                                        onChange={(e) => setNewIssue(e.target.value)}
                                        placeholder="What's the issue?"
                                        disabled={isSubmitting}
                                        rows="2"
                                        className="w-full rounded outline-none p-2 resize-none text-[12px] bg-bg-primary border border-border-light text-text-primary"
                                    />
                                    <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {['Low', 'Medium', 'High'].map((sev) => {
                                                const config = SEVERITY_PALETTE[sev]
                                                const isActive = severity === sev
                                                return (
                                                    <button
                                                        key={sev}
                                                        type="button"
                                                        onClick={() => setSeverity(sev)}
                                                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider"
                                                        style={{
                                                            background: isActive ? config.bg : 'var(--bg-tertiary)',
                                                            color: isActive ? config.fg : 'var(--text-secondary)'
                                                        }}
                                                    >
                                                        <i className={`fas ${config.icon} text-[9px]`} />
                                                        {sev}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting || !newIssue.trim()}
                                            className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider"
                                            style={{
                                                background:
                                                    isSubmitting || !newIssue.trim() ? 'var(--bg-tertiary)' : accent,
                                                color:
                                                    isSubmitting || !newIssue.trim() ? 'var(--text-tertiary)' : '#fff',
                                                cursor: isSubmitting || !newIssue.trim() ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            <i className="fas fa-paper-plane text-[10px]" />
                                            {isSubmitting ? 'Submitting' : 'Submit'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}

                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <LoadingScreen message="Loading issues..." inline={true} />
                            </div>
                        ) : displayIssues.length === 0 ? (
                            <div className="flex flex-col items-center py-8 px-4 text-center text-text-tertiary">
                                <i
                                    className={`fas ${activeTab === 'open' ? 'fa-clipboard-check' : 'fa-trophy'} text-2xl mb-2`}
                                />
                                <p className="text-[12px] m-0 font-semibold text-text-secondary">
                                    {activeTab === 'open' ? 'No open issues' : 'No resolved issues yet'}
                                </p>
                            </div>
                        ) : (
                            <div className="rounded overflow-hidden bg-bg-primary border border-border-light">
                                {displayIssues.map((issue) => {
                                    const sevConfig = SEVERITY_PALETTE[issue.severity] || SEVERITY_PALETTE.Medium
                                    const isResolved = !!issue.time_completed
                                    const creatorName = getCreatorName(issue)
                                    return (
                                        <div
                                            key={issue.id}
                                            className="flex items-start gap-2.5 px-3 py-2.5 border-b border-border-light"
                                            style={{ opacity: isResolved ? 0.7 : 1 }}
                                        >
                                            <div className="w-7 h-7 rounded flex items-center justify-center shrink-0 text-[10px] font-bold bg-bg-tertiary text-text-secondary">
                                                {getNameInitials(creatorName)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                    <span className="text-[12px] font-semibold text-text-primary">
                                                        {creatorName}
                                                    </span>
                                                    <span
                                                        className={PILL_BASE}
                                                        style={{ background: sevConfig.bg, color: sevConfig.fg }}
                                                    >
                                                        <i className={`fas ${sevConfig.icon} text-[8px]`} />
                                                        {issue.severity}
                                                    </span>
                                                    <span className="text-[10.5px] font-mono tabular-nums text-text-tertiary">
                                                        {formatDate(issue.time_created)}
                                                    </span>
                                                </div>
                                                <p className="text-[12px] leading-relaxed m-0 whitespace-pre-wrap break-words text-text-secondary">
                                                    {issue.issue}
                                                </p>
                                                {isResolved && (
                                                    <div className="flex items-center gap-1 mt-1 text-[10.5px] font-semibold text-[#166534]">
                                                        <i className="fas fa-check text-[9px]" />
                                                        Resolved {formatDate(issue.time_completed)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex shrink-0 gap-1">
                                                {!isResolved && (
                                                    <>
                                                        <button
                                                            onClick={() => handleCompleteIssue(issue.id)}
                                                            title="Mark resolved"
                                                            className="w-6 h-6 flex items-center justify-center rounded transition-colors bg-transparent text-green-500"
                                                            onMouseEnter={(e) =>
                                                                (e.currentTarget.style.background =
                                                                    'var(--bg-tertiary)')
                                                            }
                                                            onMouseLeave={(e) =>
                                                                (e.currentTarget.style.background = 'transparent')
                                                            }
                                                        >
                                                            <i className="fas fa-check text-[10px]" />
                                                        </button>
                                                        <button
                                                            onClick={() => setMessageIssue(issue)}
                                                            title="Send message"
                                                            className="w-6 h-6 flex items-center justify-center rounded transition-colors bg-transparent"
                                                            style={{ color: accent }}
                                                            onMouseEnter={(e) =>
                                                                (e.currentTarget.style.background =
                                                                    'var(--bg-tertiary)')
                                                            }
                                                            onMouseLeave={(e) =>
                                                                (e.currentTarget.style.background = 'transparent')
                                                            }
                                                        >
                                                            <i className="fas fa-paper-plane text-[10px]" />
                                                        </button>
                                                    </>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        onClick={() => handleDeleteIssue(issue.id)}
                                                        title="Delete"
                                                        className="w-6 h-6 flex items-center justify-center rounded transition-colors bg-transparent text-text-tertiary"
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = 'var(--bg-tertiary)'
                                                            e.currentTarget.style.color = '#dc2626'
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = 'transparent'
                                                            e.currentTarget.style.color = 'var(--text-tertiary)'
                                                        }}
                                                    >
                                                        <i className="fas fa-trash text-[10px]" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {messageIssue && (
                <SendIssueMessageModal
                    issue={messageIssue}
                    itemNumber={itemNumber}
                    itemType={itemType}
                    creatorName={getCreatorName(messageIssue)}
                    onClose={() => setMessageIssue(null)}
                />
            )}
        </>,
        document.body
    )
}

export default IssueModalSection
