/* eslint-disable react/forbid-dom-props */
import React, { memo } from 'react'

/**
 * Glass-style destination tile used in the portal hero. Renders as either:
 *   - an external `<a>` (when `href` is provided) — opens in a new tab,
 *     decorated with the standard external-link rel attributes
 *   - a `<button>` (when `onClick` is provided) — used for in-app routes
 *
 * Visual treatment matches the cinematic dark-glass aesthetic of the
 * portal: translucent surface, hairline border that brightens on
 * hover/focus, accent-tinted icon chip, subtle lift transition.
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
        'group relative flex h-full w-full flex-col items-start gap-5 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.04] p-6 text-left no-underline shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-md transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out motion-reduce:transition-none hover:-translate-y-1 hover:border-white/35 hover:bg-white/[0.08] hover:shadow-[0_18px_60px_rgba(0,0,0,0.35)] focus-visible:-translate-y-1 focus-visible:border-white/60 focus-visible:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950'
    const content = (
        <>
            {badge && (
                <span className="absolute right-4 top-4 rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-white/85">
                    {badge}
                </span>
            )}
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
            <div className="flex flex-1 flex-col gap-1.5">
                <span className="font-heading text-lg font-bold leading-tight tracking-tight text-white">
                    {title}
                </span>
                <span className="text-[0.85rem] leading-relaxed text-white/65">{description}</span>
            </div>
            <span className="mt-auto inline-flex items-center gap-2 text-[0.8rem] font-semibold uppercase tracking-wider text-white/80 transition-colors duration-150 group-hover:text-white">
                {label || (isExternal ? 'Visit site' : 'Open')}
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
