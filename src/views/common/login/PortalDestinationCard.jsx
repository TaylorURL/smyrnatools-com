/* eslint-disable react/forbid-dom-props */
import React, { memo } from 'react'

/**
 * Horizontal portal destination row used in the LoginView "Choose a destination"
 * rail. Renders as either:
 *   - an external `<a>` (when `href` is provided) — opens in a new tab,
 *     decorated with the standard external-link rel attributes
 *   - a `<button>` (when `onClick` is provided) — used for in-app routes
 *
 * Layout: icon chip on the left, title + description in the middle,
 * action indicator on the right. Translucent dark-glass surface that
 * brightens on hover/focus to read against the ambient video background.
 */
const PortalDestinationCard = memo(function PortalDestinationCard({
    title,
    description,
    icon,
    href,
    onClick,
    accent,
    badge,
    label
}) {
    const isExternal = Boolean(href)
    const baseClasses =
        'group relative flex w-full items-center gap-5 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.035] px-5 py-4 text-left no-underline shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-md transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out motion-reduce:transition-none hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.07] hover:shadow-[0_18px_60px_rgba(0,0,0,0.35)] focus-visible:-translate-y-0.5 focus-visible:border-white/60 focus-visible:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950'
    const content = (
        <>
            <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-inner"
                style={{
                    background: accent
                        ? `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 60%, black) 100%)`
                        : 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)'
                }}
                aria-hidden="true"
            >
                {icon}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                    <span className="font-heading text-base font-bold leading-tight tracking-tight text-white sm:text-lg">
                        {title}
                    </span>
                    {badge && (
                        <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-white/85">
                            {badge}
                        </span>
                    )}
                </div>
                <span className="text-[0.825rem] leading-snug text-white/60">{description}</span>
            </div>
            <span className="ml-2 hidden shrink-0 items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-wider text-white/70 transition-colors duration-150 group-hover:text-white sm:inline-flex">
                <span className="hidden lg:inline">{label || (isExternal ? 'Visit' : 'Open')}</span>
                <i
                    className={`fas ${isExternal ? 'fa-arrow-up-right-from-square' : 'fa-arrow-right'} text-[0.7rem] transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none`}
                    aria-hidden="true"
                />
            </span>
        </>
    )
    if (isExternal) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={baseClasses}>
                {content}
            </a>
        )
    }
    return (
        <button type="button" onClick={onClick} className={baseClasses}>
            {content}
        </button>
    )
})

export default PortalDestinationCard
