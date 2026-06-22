/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useState } from 'react'

import { usePlanNotesFormatter } from '../../../../hooks/usePlanNotesFormatter'
import MarkdownView from './MarkdownView'

/**
 * Notes editor with AI-formatted read view. Raw notes are always stored as
 * the author typed them; the read mode shows a Grok-polished markdown render
 * cached on the plan's `_meta` blob so we don't re-query Grok on every render.
 */
function PlanNotesSection({
    accentColor,
    cachedFormatted,
    cachedSource,
    canEdit = true,
    notes,
    onFormattedChange,
    setNotes
}) {
    const { cacheMatches, error, loading, trimmed } = usePlanNotesFormatter({
        cachedFormatted,
        cachedSource,
        notes,
        onFormattedChange
    })
    const [mode, setMode] = useState(() => (trimmed ? 'view' : 'edit'))

    useEffect(() => {
        if (!trimmed) setMode('edit')
    }, [trimmed])

    const displaySource = cacheMatches ? cachedFormatted : notes
    const showStatusBar = mode === 'edit' || (mode === 'view' && loading)

    return (
        <div className="flex flex-col gap-3">
            {showStatusBar && <PlanNotesStatusBar accentColor={accentColor} loading={loading} mode={mode} />}

            {mode === 'edit' && (
                <textarea
                    value={notes || ''}
                    onChange={(e) => setNotes?.(e.target.value)}
                    placeholder="Anything special about today — weather, plant closures, special events, etc."
                    rows={5}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-y bg-bg-secondary border border-border-light text-text-primary placeholder:text-text-tertiary transition-colors duration-150 hover:border-border-medium focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_25%,transparent)]"
                />
            )}

            {mode === 'view' && !trimmed && <PlanNotesEmptyHint />}

            {mode === 'view' && trimmed && (
                <div className="rounded-lg px-4 py-3.5 bg-bg-secondary border border-border-light">
                    <MarkdownView source={displaySource} />
                    {error && (
                        <div className="text-[11px] mt-2 text-text-primary">
                            <i className="fas fa-triangle-exclamation mr-1" />
                            {error}
                        </div>
                    )}
                </div>
            )}

            {canEdit && (
                <PlanNotesModeToggle
                    accentColor={accentColor}
                    mode={mode}
                    onToggle={() => setMode((prev) => (prev === 'edit' ? 'view' : 'edit'))}
                />
            )}
        </div>
    )
}

function PlanNotesStatusBar({ accentColor, loading, mode }) {
    return (
        <div className="flex items-center gap-2 text-[11px] text-text-tertiary">
            {mode === 'view' && loading && (
                <>
                    <i
                        className="fas fa-wand-magic-sparkles fa-fade text-[11px]"
                        style={{ color: 'var(--text-primary)' }}
                    />
                    <span>Formatting with AI…</span>
                </>
            )}
            {mode === 'edit' && (
                <>
                    <i className="fas fa-pen-to-square text-[10px]" />
                    <span>Editing raw notes</span>
                </>
            )}
        </div>
    )
}

function PlanNotesEmptyHint() {
    return (
        <div className="rounded-lg p-4 text-[12.5px] italic text-center bg-bg-secondary text-text-tertiary">
            No notes yet. Click <b>Edit</b> to add context for today&apos;s plan.
        </div>
    )
}

function PlanNotesModeToggle({ accentColor, mode, onToggle }) {
    const isEditing = mode === 'edit'
    return (
        <div className="flex justify-end">
            <button type="button"
                type="button"
                onClick={onToggle}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold border-none cursor-pointer flex items-center gap-1.5 active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
                style={{
                    background: isEditing ? accentColor : 'var(--bg-secondary)',
                    color: isEditing ? '#fff' : 'var(--text-primary)'
                }}
            >
                <i className={`fas ${isEditing ? 'fa-check' : 'fa-pen'} text-[10px]`} />
                {isEditing ? 'Done' : 'Edit'}
            </button>
        </div>
    )
}

export default PlanNotesSection
