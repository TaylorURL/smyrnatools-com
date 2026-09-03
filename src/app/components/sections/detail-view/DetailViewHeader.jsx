import React from 'react'

/**
 * Top-of-shell header for detail views. The sizing here is the desktop case;
 * `.dv-header` and `.dv-header-title` in `index.css` shrink it under the
 * mobile breakpoint, so changing a size here needs the matching rule checked.
 */
export default function DetailViewHeader({ headerActions, icon, onBack, onClose, subtitle, title }) {
    return (
        <div className="relative border-b border-border-light bg-bg-primary">
            <div className="dv-header relative flex items-center gap-3 px-4 py-2.5">
                <button
                    type="button"
                    onClick={onBack || onClose}
                    aria-label="Back"
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border-none bg-bg-secondary text-[13px] text-text-secondary cursor-pointer transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
                >
                    <i className="fas fa-arrow-left"></i>
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                        {icon && <i className={`${icon} text-text-secondary text-[14px]`}></i>}
                        <h1 className="dv-header-title m-0 truncate text-[15px] font-bold text-text-primary">
                            {title}
                        </h1>
                    </div>
                    {subtitle && <p className="m-0 text-[11.5px] text-text-secondary">{subtitle}</p>}
                </div>
                <div className="dv-header-actions flex items-center gap-1.5">{headerActions}</div>
            </div>
        </div>
    )
}
