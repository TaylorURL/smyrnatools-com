import React, { useId } from 'react'

/**
 * The dialog look without the dialog: the same header, toolbar, scrolling
 * body and footer as `ui/Dialog`, laid out as a card that sits in the page
 * (the comments and issues panel docked beside a list). No portal, no scrim,
 * no focus trap; it fills whatever column it is mounted in.
 */
export default function DockedPanel({
    bodyClassName = 'px-6 py-5',
    children,
    description,
    eyebrow,
    footer,
    headerActions,
    onClose,
    title,
    toolbar
}) {
    const titleId = useId()
    const descriptionId = useId()
    return (
        <section
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descriptionId : undefined}
            className="flex h-full w-full flex-col overflow-hidden rounded-card border border-border-light bg-bg-primary"
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
            {!toolbar && <div className="shrink-0 border-b border-border-light" />}
            <div className={`min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>
            {footer && (
                <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border-light bg-bg-secondary px-6 py-3.5">
                    {footer}
                </footer>
            )}
        </section>
    )
}
