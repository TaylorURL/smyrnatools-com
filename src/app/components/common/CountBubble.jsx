import React from 'react'

/**
 * Solid fill per tone. The count reads white on every one of them in both
 * themes, which is the point: a count pinned to an icon or an avatar
 * has to be legible at a glance, and Badge's neutral body with a coloured
 * dot reads as a tag, not as "you have 2 of these".
 */
const TONE_FILL_CLS = {
    accent: 'bg-accent',
    danger: 'bg-status-danger',
    info: 'bg-status-shop',
    neutral: 'bg-status-spare',
    success: 'bg-status-active',
    warning: 'bg-status-warning'
}

const SIZE_CLS = {
    md: 'h-[18px] min-w-[18px] px-[5px] text-[10.5px]',
    sm: 'h-4 min-w-[16px] px-1 text-[9.5px]'
}

/** Count label capped at "9+" (sm) or "99+" (md), so the bubble stays round
 *  for the single digits it shows nearly all the time. */
const formatCount = (count, size) => {
    const cap = size === 'sm' ? 9 : 99
    return count > cap ? `${cap}+` : String(count)
}

/**
 * A count pinned to the corner of an icon button or an avatar — unread
 * messages, online users, open issues. Renders nothing for zero.
 *
 * `ring` is the surface the bubble sits on (a Tailwind ring colour class),
 * drawn as a 2px cut-out so the bubble separates cleanly from whatever it
 * overlaps instead of colliding with the icon or initials beneath it.
 * Position it from the caller with `className` (e.g. `absolute -top-1.5
 * -right-1.5`).
 */
export default function CountBubble({
    count,
    tone = 'danger',
    size = 'md',
    ring = 'ring-bg-primary',
    className = '',
    title
}) {
    if (!count || count <= 0) return null
    return (
        <span
            className={`pointer-events-none inline-flex items-center justify-center rounded-full font-bold leading-none tabular-nums text-white ring-2 ${ring} ${TONE_FILL_CLS[tone] ?? TONE_FILL_CLS.danger} ${SIZE_CLS[size] ?? SIZE_CLS.md} ${className}`}
            title={title}
            aria-hidden={title ? undefined : 'true'}
        >
            {formatCount(count, size)}
        </span>
    )
}
