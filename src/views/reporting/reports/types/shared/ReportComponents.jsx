import React from 'react'

const RPT_INPUT =
    'w-full rounded-md border border-border-light bg-bg-primary px-3.5 py-2.5 text-sm text-text-primary box-border disabled:bg-bg-secondary disabled:text-text-tertiary focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors duration-150 placeholder:text-text-tertiary'
const RPT_TEXTAREA = `${RPT_INPUT} min-h-[60px] resize-y`
const TH_STYLE =
    'bg-bg-secondary px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary border-b border-border-light'
const TD_STYLE =
    'px-4 py-3 text-[0.9375rem] text-text-primary border-b border-border-light align-middle bg-bg-primary last:border-b-0'

export function EmptyState({ icon = 'fa-inbox', title, subtitle, success = false }) {
    return (
        <div
            className={`text-center p-8 rounded-card border text-[0.9375rem] ${
                success
                    ? 'bg-status-active/10 border-status-active/20 text-text-primary'
                    : 'bg-bg-secondary border-border-light text-text-secondary'
            }`}
        >
            {icon && (
                <i
                    className={`fas ${icon} text-4xl mb-3 block ${success ? 'text-status-active' : 'text-text-tertiary'}`}
                    aria-hidden="true"
                />
            )}
            {title && <h4 className="font-heading text-base font-semibold text-text-primary">{title}</h4>}
            {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
        </div>
    )
}

export function SectionHeader({ icon, title, subtitle }) {
    return (
        <div className="flex items-start gap-3 mb-5">
            {icon && (
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/10 text-accent text-base">
                    <i className={`fas ${icon}`} aria-hidden="true" />
                </div>
            )}
            <div>
                <h3 className="font-heading text-lg font-semibold text-text-primary m-0">{title}</h3>
                {subtitle && <p className="text-sm text-text-secondary mt-1 mb-0">{subtitle}</p>}
            </div>
        </div>
    )
}

export { RPT_INPUT, RPT_TEXTAREA, TD_STYLE, TH_STYLE }
