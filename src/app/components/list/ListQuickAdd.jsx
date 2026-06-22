/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { ListService } from '../../../services/ListService'
import { UserService } from '../../../services/UserService'

/**
 * Inline "Add a task and press Enter…" input. The optimistic add flow
 * (`ListService.quickAdd`) makes the new row appear instantly so users can
 * rapid-fire entries without waiting for the network. Shift+Enter (or the
 * "Details" affordance) opens the full add sheet for fields beyond
 * description (deadline, priority, comments, role, etc.).
 *
 * @param {string} accentColor - Theme accent used for the leading icon + focus ring.
 * @param {string} defaultPlantCode - Pre-resolved plant code from the page filter.
 * @param {boolean} [dense] - Compact sizing so the input slots into the filter bar.
 * @param {Array<{plantCode?: string, plant_code?: string, plantName?: string, plant_name?: string}>} plants
 *   The region-scoped plant list rendered in the inline plant menu.
 * @param {Function} [onOpenAdvanced] - Called on Shift+Enter / "Details" with the current draft text.
 */
export default function ListQuickAdd({
    accentColor = '#1e3a5f',
    defaultPlantCode = '',
    dense = false,
    onOpenAdvanced,
    plants = []
}) {
    const inputRef = useRef(null)
    const wrapperRef = useRef(null)
    const menuRef = useRef(null)
    const [text, setText] = useState('')
    const [plantCode, setPlantCode] = useState(defaultPlantCode)
    const [menuOpen, setMenuOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')

    useEffect(() => {
        if (defaultPlantCode && defaultPlantCode !== plantCode) setPlantCode(defaultPlantCode)
    }, [defaultPlantCode]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const onClickOutside = (e) => {
            if (!menuRef.current) return
            if (!menuRef.current.contains(e.target)) setMenuOpen(false)
        }
        if (menuOpen) document.addEventListener('mousedown', onClickOutside)
        return () => document.removeEventListener('mousedown', onClickOutside)
    }, [menuOpen])

    const resolvedPlants = useMemo(
        () =>
            plants.map((p) => ({
                code: p.plantCode || p.plant_code,
                name: p.plantName || p.plant_name
            })),
        [plants]
    )

    const filteredPlants = useMemo(() => {
        if (!search.trim()) return resolvedPlants
        const q = search.toLowerCase()
        return resolvedPlants.filter((p) => p.code?.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q))
    }, [resolvedPlants, search])

    const selectedPlant = resolvedPlants.find((p) => p.code === plantCode)

    const submit = async () => {
        const value = text.trim()
        if (!value || isSaving) return
        if (!plantCode) {
            setError('Pick a plant first')
            setMenuOpen(true)
            setTimeout(() => setError(''), 2500)
            return
        }
        const deadline = new Date()
        deadline.setDate(deadline.getDate() + 14)
        deadline.setHours(17, 0, 0, 0)
        setText('')
        setIsSaving(true)
        try {
            const user = await UserService.getCurrentUser()
            if (!user?.id) throw new Error('Sign-in required')
            ListService.quickAdd({
                comments: '',
                deadline,
                description: value,
                plantCode,
                priority: 'none',
                responsibleRole: null,
                status: 'pending',
                userId: user.id
            })
        } catch (err) {
            setText(value)
            setError(err?.message || 'Could not add task')
            setTimeout(() => setError(''), 3000)
        } finally {
            setIsSaving(false)
            inputRef.current?.focus()
        }
    }

    const onKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
            return
        }
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault()
            onOpenAdvanced?.(text)
            setText('')
            return
        }
        if (e.key === 'Escape' && menuOpen) {
            setMenuOpen(false)
        }
    }

    const plantPickerLabel = selectedPlant ? selectedPlant.code : 'Plant'

    const wrapperPad = dense ? 'px-2.5 py-1' : 'px-3 py-2'
    const wrapperRadius = dense ? 'rounded-md' : 'rounded-xl'
    const inputTextSize = dense ? 'text-[12.5px]' : 'text-[14px]'
    const leadingIconSize = dense ? 'text-[10px]' : 'text-[12px]'

    return (
        <div ref={wrapperRef} className="relative w-full">
            <div
                className={`flex items-center gap-2 border bg-bg-primary transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft,rgba(30,58,95,0.12))] ${wrapperPad} ${wrapperRadius} ${
                    error ? 'border-status-danger' : 'border-border-light'
                }`}
            >
                <i
                    className={`fas ${isSaving ? 'fa-circle-notch fa-spin' : 'fa-plus'} shrink-0 ${leadingIconSize}`}
                    style={{ color: accentColor, opacity: isSaving ? 0.7 : 0.75 }}
                    aria-hidden="true"
                />
                <input
                    ref={inputRef}
                    type="text"
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value)
                        if (error) setError('')
                    }}
                    onKeyDown={onKeyDown}
                    disabled={isSaving}
                    placeholder={dense ? 'Add a task…' : 'Add a task and press Enter…'}
                    aria-label="Add a task"
                    className={`flex-1 min-w-0 bg-transparent border-none outline-none text-text-primary placeholder:text-text-tertiary disabled:opacity-60 ${inputTextSize}`}
                />
                {text.trim() && (
                    <button type="button"
                        type="button"
                        onClick={() => {
                            onOpenAdvanced?.(text)
                            setText('')
                        }}
                        className="hidden sm:inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-text-tertiary hover:text-text-primary hover:bg-bg-secondary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
                        title="Open the full task form (Shift+Enter)"
                    >
                        <i className="fas fa-sliders text-[10px] opacity-70" aria-hidden="true" />
                        Details
                    </button>
                )}
                <div ref={menuRef} className="relative">
                    <button type="button"
                        type="button"
                        onClick={() => setMenuOpen((o) => !o)}
                        aria-haspopup="listbox"
                        aria-expanded={menuOpen}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-mono tabular-nums uppercase tracking-wider transition-[colors,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                            selectedPlant
                                ? 'border-border-light bg-bg-secondary text-text-primary hover:bg-bg-tertiary'
                                : 'border-status-warning text-status-warning'
                        }`}
                        style={selectedPlant ? undefined : { background: 'rgba(245,158,11,0.12)' }}
                        title={selectedPlant?.name || 'Pick a plant'}
                    >
                        <i className="fas fa-building text-[9px] opacity-70" aria-hidden="true" />
                        {plantPickerLabel}
                        <i
                            className={`fas fa-chevron-down text-[8px] opacity-60 transition-transform duration-150 ${menuOpen ? 'rotate-180' : ''}`}
                            aria-hidden="true"
                        />
                    </button>
                    {menuOpen && (
                        <div
                            role="listbox"
                            aria-label="Pick plant for new task"
                            className="absolute right-0 top-full z-40 mt-1.5 w-[260px] max-w-[90vw] origin-top-right rounded-lg border border-border-light bg-bg-primary shadow-[0_8px_24px_rgba(0,0,0,0.18)] animate-filter-fade"
                            style={{ transformOrigin: 'top right' }}
                        >
                            <div className="border-b border-border-light p-2">
                                <div className="relative">
                                    <i
                                        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 fas fa-search text-[10px] text-text-tertiary"
                                        aria-hidden="true"
                                    />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search plants…"
                                        autoFocus
                                        className="w-full rounded-md border border-border-light bg-bg-secondary pl-7 pr-2 py-1.5 text-[12px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-[var(--accent)]/60 focus:ring-2 focus:ring-[var(--accent)]/20"
                                    />
                                </div>
                            </div>
                            <div className="max-h-56 overflow-y-auto p-1">
                                {filteredPlants.length === 0 ? (
                                    <div className="px-2 py-3 text-center text-[11px] text-text-tertiary">
                                        No plants match &ldquo;{search}&rdquo;
                                    </div>
                                ) : (
                                    filteredPlants.map((p) => (
                                        <button type="button"
                                            key={p.code}
                                            type="button"
                                            role="option"
                                            aria-selected={p.code === plantCode}
                                            onClick={() => {
                                                setPlantCode(p.code)
                                                setMenuOpen(false)
                                                setSearch('')
                                                inputRef.current?.focus()
                                            }}
                                            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] transition-colors duration-100 hover:bg-bg-secondary focus-visible:bg-bg-secondary focus-visible:outline-none ${
                                                p.code === plantCode ? 'bg-bg-secondary' : ''
                                            }`}
                                        >
                                            <span className="min-w-[40px] font-mono text-[11px] text-text-tertiary">
                                                {p.code}
                                            </span>
                                            <span className="flex-1 truncate text-text-primary">{p.name}</span>
                                            {p.code === plantCode && (
                                                <i
                                                    className="fas fa-check text-[10px]"
                                                    style={{ color: accentColor }}
                                                    aria-hidden="true"
                                                />
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {error && (
                <div
                    role="alert"
                    className="absolute -bottom-5 left-1 text-[11px] font-medium text-status-danger animate-fade-in"
                >
                    {error}
                </div>
            )}
        </div>
    )
}
