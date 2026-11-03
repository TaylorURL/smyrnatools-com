/* eslint-disable react/forbid-dom-props */
import React, { Children, useEffect, useId, useRef } from 'react'
import ReactDOM from 'react-dom'

/** Panel widths. A dialog is sized for what it holds — a confirmation is
 *  narrow, a list or a two-column form is wide — never to fill the screen. */
const SIZES = {
    lg: 'max-w-[720px]',
    md: 'max-w-[560px]',
    sm: 'max-w-[420px]',
    xl: 'max-w-[960px]'
}

/** Open dialogs, oldest first. Only the last one answers Escape and Tab, so
 *  a picker or a confirmation opened over another dialog closes on its own. */
const openStack = []

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The one dialog shell. Every popup in the app sits in it, so they share a
 * scrim, a panel, a header and a footer:
 *
 *   - header: an optional small line above the title (`eyebrow`), the title
 *     in the heading face at 20px, an optional line of context below it, and
 *     a close button. No icon tile beside the title.
 *   - `toolbar`: search and filters, ruled off under the header, outside the
 *     scrolling area so they stay put while the list moves.
 *   - body: the only part that scrolls. `bodyClassName` sets its padding;
 *     lists that rule their own rows pass `p-0`.
 *   - `footer`: actions on the right, cancel before the primary action.
 *
 * Escape and the scrim close it (only the top one when dialogs are
 * stacked), Tab stays inside it, and the page behind it doesn't scroll.
 * Focus lands on the panel or a field marked `data-autofocus`, or stays on a
 * field that focused itself, and goes back to whatever opened the dialog
 * when it closes. `onClose` may be a new function on every render.
 */
export default function Dialog({
    bodyClassName = 'px-6 py-5',
    bodyRef,
    children,
    description,
    eyebrow,
    footer,
    headerActions,
    onClose,
    open = true,
    size = 'md',
    tall = false,
    title,
    toolbar,
    zClassName = 'z-modal'
}) {
    const panelRef = useRef(null)
    const onCloseRef = useRef(onClose)
    const openerRef = useRef(null)
    const wasOpenRef = useRef(false)
    const titleId = useId()
    const descriptionId = useId()

    // The opener is read during render, before any field inside the dialog
    // can focus itself with `autoFocus` and hide what had focus before.
    if (open && !wasOpenRef.current && typeof document !== 'undefined') {
        openerRef.current = document.activeElement
    }
    wasOpenRef.current = open

    useEffect(() => {
        onCloseRef.current = onClose
    })

    useEffect(() => {
        if (!open) return undefined
        const entry = {}
        openStack.push(entry)
        const opener = openerRef.current
        const panel = panelRef.current
        if (!panel?.contains(document.activeElement)) {
            const first = panel?.querySelector('[data-autofocus], [autofocus]')
            ;(first || panel)?.focus({ preventScroll: true })
        }
        const { overflow } = document.body.style
        document.body.style.overflow = 'hidden'

        const handleKey = (event) => {
            if (openStack[openStack.length - 1] !== entry) return
            if (event.key === 'Escape') {
                event.stopPropagation()
                onCloseRef.current?.()
                return
            }
            if (event.key !== 'Tab' || !panelRef.current) return
            const items = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null)
            if (items.length === 0) return
            const firstItem = items[0]
            const lastItem = items[items.length - 1]
            if (event.shiftKey && document.activeElement === firstItem) {
                event.preventDefault()
                lastItem.focus()
            } else if (!event.shiftKey && document.activeElement === lastItem) {
                event.preventDefault()
                firstItem.focus()
            }
        }
        document.addEventListener('keydown', handleKey)
        return () => {
            document.removeEventListener('keydown', handleKey)
            const index = openStack.indexOf(entry)
            if (index !== -1) openStack.splice(index, 1)
            if (openStack.length === 0) document.body.style.overflow = overflow
            if (opener && opener.isConnected && typeof opener.focus === 'function') {
                opener.focus({ preventScroll: true })
            }
        }
    }, [open])

    if (!open || typeof document === 'undefined' || !document.body) return null
    const hasBody = Children.toArray(children).length > 0

    return ReactDOM.createPortal(
        <div
            className={`fixed inset-0 ${zClassName} flex items-end justify-center sm:items-center sm:p-6`}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onCloseRef.current?.()
            }}
            style={{ background: 'var(--scrim)' }}
        >
            {/* The panel takes focus only so Tab starts inside it; it is not a
                control. `focus-visible:outline-none` outranks the base layer's
                `div:focus-visible` ring, which plain `outline-none` does not,
                so a key pressed inside no longer rings the whole dialog. */}
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                aria-describedby={description ? descriptionId : undefined}
                tabIndex={-1}
                className={`flex w-full ${SIZES[size] || SIZES.md} ${
                    tall ? 'h-[min(88vh,880px)]' : 'max-h-[min(88vh,880px)]'
                } flex-col overflow-hidden rounded-t-modal border border-border-light bg-bg-primary shadow-modal outline-none focus-visible:outline-none animate-dialog-in motion-reduce:animate-none sm:rounded-modal`}
            >
                <header className="flex shrink-0 items-start gap-4 px-6 pb-4 pt-5">
                    <div className="min-w-0 flex-1">
                        {eyebrow && <div className="mb-0.5 truncate text-[12px] text-text-secondary">{eyebrow}</div>}
                        {title && (
                            <h2
                                id={titleId}
                                className="m-0 truncate font-heading text-[20px] font-semibold leading-tight tracking-tight text-text-primary"
                            >
                                {title}
                            </h2>
                        )}
                        {description && (
                            <p id={descriptionId} className="m-0 mt-1 text-[13px] text-text-secondary">
                                {description}
                            </p>
                        )}
                    </div>
                    {headerActions && <div className="flex shrink-0 items-center gap-2">{headerActions}</div>}
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="-mr-2 -mt-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-none bg-transparent text-text-secondary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
                    >
                        <i className="fas fa-times text-[14px]" aria-hidden="true" />
                    </button>
                </header>
                {toolbar && <div className="shrink-0 border-b border-border-light px-6 pb-4">{toolbar}</div>}
                {!toolbar && hasBody && <div className="shrink-0 border-b border-border-light" />}
                {hasBody && (
                    <div ref={bodyRef} className={`min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}>
                        {children}
                    </div>
                )}
                {footer && (
                    <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border-light bg-bg-secondary px-6 py-3.5">
                        {footer}
                    </footer>
                )}
            </div>
        </div>,
        document.body
    )
}

/** A label above a control, the way every dialog form lays out a field. */
export function DialogField({ children, hint, htmlFor, label }) {
    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <label htmlFor={htmlFor} className="text-[12px] font-medium text-text-secondary">
                    {label}
                </label>
            )}
            {children}
            {hint && <p className="m-0 text-[12px] text-text-tertiary">{hint}</p>}
        </div>
    )
}

/** Input, select and textarea classes for fields inside a dialog. */
export const DIALOG_INPUT =
    'w-full h-9 rounded-[4px] border border-border-medium bg-bg-primary px-3 text-[13px] text-text-primary placeholder:text-text-tertiary outline-none transition-colors duration-150 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:bg-bg-tertiary disabled:text-text-tertiary'
export const DIALOG_TEXTAREA =
    'w-full min-h-[96px] rounded-[4px] border border-border-medium bg-bg-primary px-3 py-2 text-[13px] leading-relaxed text-text-primary placeholder:text-text-tertiary outline-none transition-colors duration-150 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 resize-y'
