/* eslint-disable react/forbid-dom-props */
import React, { useCallback, useEffect, useRef, useState } from 'react'

import CrmService from '../../../../services/CrmService'
import { UserService } from '../../../../services/UserService'

/**
 * Modal that lets a manager paste a CSV block of `CustomerNumOrName, RepName`
 * lines, resolves each rep name to a user id via a case-insensitive lookup
 * against the full user roster, then calls the bulk-assign endpoint and
 * reports the matched / unmatched counts.
 */
export function BulkAssignSalesRepsModal({ accentColor, onClose, onDone }) {
    const [text, setText] = useState('')
    const [users, setUsers] = useState([])
    const [isLoadingUsers, setIsLoadingUsers] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const textareaRef = useRef(null)
    const mounted = useRef(true)

    useEffect(() => {
        mounted.current = true
        textareaRef.current?.focus()
        UserService.getAllUsersWithProfilesAndRoles()
            .then((all) => {
                if (mounted.current) setUsers(all)
            })
            .catch(() => {
                // Non-fatal — assignment will fail if rep name can't be resolved.
            })
            .finally(() => {
                if (mounted.current) setIsLoadingUsers(false)
            })
        return () => {
            mounted.current = false
        }
    }, [])

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Escape') onClose()
        },
        [onClose]
    )

    const resolveRepName = useCallback(
        (repName) => {
            const normalized = repName.trim().toLowerCase()
            const match = users.find((u) => {
                const fullName = `${u.firstName} ${u.lastName}`.trim().toLowerCase()
                const email = (u.email ?? '').toLowerCase()
                return fullName === normalized || email === normalized
            })
            return match?.id ?? null
        },
        [users]
    )

    const handleAssign = useCallback(async () => {
        setError(null)
        const lines = text
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
        if (lines.length === 0) return

        const assignments = lines
            .map((line) => {
                const commaIndex = line.lastIndexOf(',')
                if (commaIndex === -1) return null
                const customerRaw = line.slice(0, commaIndex).trim()
                const repRaw = line.slice(commaIndex + 1).trim()
                if (!customerRaw || !repRaw) return null
                const repUserId = resolveRepName(repRaw)
                if (!repUserId) return null
                // Treat as a customer number if it looks numeric; otherwise name.
                const isNumeric = /^\d+$/.test(customerRaw)
                return isNumeric ? { customerNum: customerRaw, repUserId } : { customerName: customerRaw, repUserId }
            })
            .filter(Boolean)

        if (assignments.length === 0) {
            setError('No valid lines found. Format each line as: CustomerNumOrName, Rep Full Name')
            return
        }

        setIsSaving(true)
        try {
            const data = await CrmService.bulkAssignSalesReps(assignments)
            if (mounted.current) {
                setResult(data)
                onDone?.()
            }
        } catch (err) {
            if (mounted.current) setError(err?.message || 'Assignment failed')
        } finally {
            if (mounted.current) setIsSaving(false)
        }
    }, [text, resolveRepName, onDone])

    return (
        // Backdrop
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="Bulk assign sales reps"
        >
            {/* Panel */}
            <div
                className="relative w-full max-w-lg rounded-md border border-border-light bg-bg-primary flex flex-col gap-0 overflow-hidden"
                style={{ boxShadow: 'var(--shadow-lg)', transformOrigin: 'center' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-light"
                    style={{ background: `${accentColor}0d` }}
                >
                    <div>
                        <div className="text-[14px] font-bold text-text-primary">Bulk assign sales reps</div>
                        <div className="text-[11.5px] text-text-secondary mt-0.5">
                            Paste lines in the format:{' '}
                            <span className="font-mono">CustomerNumOrName, Rep Full Name</span>
                        </div>
                    </div>
                    <button type="button"
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-1.5 border-none bg-transparent cursor-pointer text-text-tertiary hover:text-text-primary active:scale-[0.97] transition-[colors,transform] duration-150 ease-out"
                        aria-label="Close"
                    >
                        <i className="fas fa-times text-[13px]" aria-hidden="true" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex flex-col gap-3 px-4 py-4">
                    {isLoadingUsers && (
                        <div className="text-[11.5px] text-text-tertiary">
                            <i className="fas fa-spinner fa-spin mr-1.5 text-[10px]" aria-hidden="true" />
                            Loading user roster…
                        </div>
                    )}

                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={'12345, Jane Smith\nAcme Paving, John Doe'}
                        rows={8}
                        className="w-full rounded-md border border-border-light bg-bg-secondary px-3 py-2 text-[12.5px] font-mono text-text-primary placeholder:text-text-tertiary outline-none resize-y focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)]"
                        aria-label="Assignments text"
                    />

                    {error && (
                        <div className="rounded-md p-2.5 text-[12px] bg-[rgba(220,38,38,0.1)] border border-[rgba(220,38,38,0.25)] text-text-primary">
                            {error}
                        </div>
                    )}

                    {result && <ResultBanner matched={result.matched} unmatched={result.unmatched} />}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-light bg-bg-secondary">
                    <button type="button"
                        type="button"
                        onClick={onClose}
                        className="rounded-md px-3 py-1.5 text-[12px] font-semibold border border-border-light bg-transparent text-text-secondary cursor-pointer active:scale-[0.97] transition-[colors,transform] duration-150 ease-out hover:text-text-primary"
                    >
                        {result ? 'Close' : 'Cancel'}
                    </button>
                    {!result && (
                        <button type="button"
                            type="button"
                            onClick={handleAssign}
                            disabled={!text.trim() || isSaving || isLoadingUsers}
                            className="rounded-md px-3 py-1.5 text-[12px] font-semibold text-white cursor-pointer active:scale-[0.97] transition-[colors,transform] duration-150 ease-out disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{ background: accentColor }}
                        >
                            {isSaving ? 'Assigning…' : 'Assign'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

function ResultBanner({ matched, unmatched }) {
    const unmatchedList = Array.isArray(unmatched) ? unmatched : []
    return (
        <div className="rounded-md border border-border-light bg-bg-secondary px-3 py-2.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-text-primary">
                <i className="fas fa-circle-check text-[11px] text-green-500" aria-hidden="true" />
                {matched ?? 0} assignment{matched === 1 ? '' : 's'} applied
            </div>
            {unmatchedList.length > 0 && (
                <div className="text-[11.5px] text-text-secondary">
                    <span className="font-semibold">{unmatchedList.length} unmatched:</span>{' '}
                    {unmatchedList.slice(0, 5).join(', ')}
                    {unmatchedList.length > 5 && ` and ${unmatchedList.length - 5} more`}
                </div>
            )}
        </div>
    )
}
