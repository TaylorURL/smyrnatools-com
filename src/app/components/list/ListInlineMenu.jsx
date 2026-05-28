/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Portal-rendered popover used for inline status / priority changes on a
 * list row. Positions itself relative to the trigger via viewport coords so
 * it escapes any container clipping (group cards, sticky filter bar, etc.).
 * Auto-flips upward when the menu would overflow the viewport bottom.
 *
 * The trigger element passes its own ref and the controlled `open` state.
 * Click-outside, Escape, and selection all dismiss via `onClose`.
 *
 * @param {boolean} open
 * @param {Function} onClose
 * @param {{ current: HTMLElement | null }} triggerRef
 * @param {Array<{ value: string, label: string, icon?: string, color?: string }>} options
 * @param {string} [selectedValue]
 * @param {Function} onSelect - Called with the selected option value.
 * @param {string} [align] - 'start' (default), 'end' — which edge aligns to the trigger.
 * @param {string} [title] - Optional header title for the menu.
 */
export default function ListInlineMenu({
    align = 'start',
    onClose,
    onSelect,
    open,
    options,
    selectedValue,
    title,
    triggerRef
}) {
    const menuRef = useRef(null)
    const [coords, setCoords] = useState(null)
    const [highlightIdx, setHighlightIdx] = useState(-1)

    const optionList = useMemo(() => options || [], [options])

    useLayoutEffect(() => {
        if (!open || !triggerRef?.current) return
        const update = () => {
            const trigger = triggerRef.current
            if (!trigger) return
            const rect = trigger.getBoundingClientRect()
            const menuEl = menuRef.current
            const menuW = menuEl ? menuEl.offsetWidth : 200
            const menuH = menuEl ? menuEl.offsetHeight : 220
            const viewportW = window.innerWidth
            const viewportH = window.innerHeight
            const spaceBelow = viewportH - rect.bottom
            const spaceAbove = rect.top
            const placeAbove = spaceBelow < menuH + 16 && spaceAbove > spaceBelow
            const top = placeAbove
                ? Math.max(8, rect.top - menuH - 6)
                : Math.min(viewportH - menuH - 8, rect.bottom + 6)
            let left
            if (align === 'end') {
                left = rect.right - menuW
            } else {
                left = rect.left
            }
            left = Math.max(8, Math.min(left, viewportW - menuW - 8))
            setCoords({ left, placeAbove, top })
        }
        update()
        const id = window.requestAnimationFrame(update)
        window.addEventListener('resize', update)
        window.addEventListener('scroll', update, true)
        return () => {
            window.cancelAnimationFrame(id)
            window.removeEventListener('resize', update)
            window.removeEventListener('scroll', update, true)
        }
    }, [open, triggerRef, align])

    useEffect(() => {
        if (!open) {
            setHighlightIdx(-1)
            return
        }
        const initial = optionList.findIndex((o) => o.value === selectedValue)
        setHighlightIdx(initial >= 0 ? initial : 0)
    }, [open, selectedValue, optionList])

    useEffect(() => {
        if (!open) return undefined
        const onDocClick = (e) => {
            if (menuRef.current?.contains(e.target)) return
            if (triggerRef?.current?.contains(e.target)) return
            onClose?.()
        }
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                onClose?.()
                return
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHighlightIdx((i) => (i + 1) % optionList.length)
                return
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHighlightIdx((i) => (i - 1 + optionList.length) % optionList.length)
                return
            }
            if (e.key === 'Enter') {
                e.preventDefault()
                const opt = optionList[highlightIdx]
                if (opt) {
                    onSelect?.(opt.value)
                    onClose?.()
                }
            }
        }
        document.addEventListener('mousedown', onDocClick)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDocClick)
            document.removeEventListener('keydown', onKey)
        }
    }, [open, onClose, onSelect, optionList, highlightIdx, triggerRef])

    if (!open || typeof document === 'undefined') return null

    const visibleCoords = coords || { left: -9999, top: -9999 }

    return createPortal(
        <div
            ref={menuRef}
            role="listbox"
            aria-label={title || 'Choose option'}
            className="fixed z-[1100] min-w-[180px] max-w-[280px] rounded-lg border border-border-light bg-bg-primary shadow-[0_12px_32px_rgba(0,0,0,0.18)] animate-filter-fade"
            style={{
                left: visibleCoords.left,
                top: visibleCoords.top,
                transformOrigin: visibleCoords.placeAbove ? 'bottom left' : 'top left'
            }}
        >
            {title && (
                <div className="border-b border-border-light px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                    {title}
                </div>
            )}
            <div className="p-1">
                {optionList.map((opt, idx) => {
                    const isSelected = opt.value === selectedValue
                    const isHighlighted = idx === highlightIdx
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onMouseEnter={() => setHighlightIdx(idx)}
                            onClick={(e) => {
                                e.stopPropagation()
                                onSelect?.(opt.value)
                                onClose?.()
                            }}
                            className={`flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors duration-100 ${
                                isHighlighted ? 'bg-bg-secondary text-text-primary' : 'text-text-primary'
                            }`}
                        >
                            {opt.icon && (
                                <span
                                    className="flex h-5 w-5 items-center justify-center rounded-md text-[10px]"
                                    style={
                                        opt.color
                                            ? { background: `${opt.color}1f`, color: opt.color }
                                            : { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }
                                    }
                                >
                                    <i className={`fas ${opt.icon}`} aria-hidden="true" />
                                </span>
                            )}
                            <span className="flex-1 truncate">{opt.label}</span>
                            {isSelected && (
                                <i
                                    className="fas fa-check text-[10px] text-accent"
                                    style={{ color: 'var(--accent)' }}
                                    aria-hidden="true"
                                />
                            )}
                        </button>
                    )
                })}
            </div>
        </div>,
        document.body
    )
}
