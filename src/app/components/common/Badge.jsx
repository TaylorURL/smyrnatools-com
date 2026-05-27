import React from 'react'

/**
 * Unified Badge — brutalist treatment.
 *
 * Every badge across the app shares one visual identity: saturated tone
 * background, white 800-weight uppercase text with wide tracking, sharp
 * 2px corners, and a hard offset drop shadow. Picked from #12 in
 * `badge-designs.html` because the dashboard is fleet/industrial software
 * and the brutalist look carries the no-nonsense weight that fits.
 *
 * What varies per call site is only the tone (success / warning / danger /
 * info / neutral / accent) and optionally the size (xs–lg). Everything
 * else — shape, weight, casing, shadow offset scale, padding rhythm — is
 * fixed by the component so a status pill in a table cell, a count overlay
 * on an icon button, and a plant code chip in a header all look visually
 * identical. The shadow colour is theme-aware via the
 * `--badge-shadow-color` CSS custom property so the offset stays visible
 * in light, dark, and grayed themes.
 *
 * The `variant`, `weight`, and `uppercase` props are retained for
 * backwards compatibility with the ~290 existing call sites but are now
 * effectively no-ops — the brutalist style is the only style. The single
 * meaningful escape hatch is `variant="custom"`, which keeps the
 * brutalist shape (corners, padding, shadow, weight, casing) but lets
 * the caller pass `bg` / `fg` for data-driven colors (per-plant
 * identifier, per-user accent, role colour from DB).
 *
 * Common patterns:
 *   <Badge tone="success">Active</Badge>
 *   <Badge tone="danger" size="xs" count={3} />
 *   <Badge variant="custom" bg={plantColor}>{plantCode}</Badge>
 *   <Badge as="button" tone="accent" onClick={...}>Filter</Badge>
 */

const TONE_BG = {
    accent: 'bg-accent',
    danger: 'bg-status-danger',
    info: 'bg-status-shop',
    neutral: 'bg-status-spare',
    success: 'bg-status-active',
    warning: 'bg-status-warning'
}

/**
 * Per-size rhythm. The shadow offset scales with the badge so xs chips
 * carry a 1.5px shadow while lg chips carry 3px — brutalism remains
 * visually proportional at every size.
 */
const SIZE_STYLES = {
    lg: {
        gap: 'gap-1.5',
        iconSize: 'text-[11px]',
        pad: 'px-3.5 py-1',
        removeSize: 'h-4 w-4',
        shadow: 'shadow-[3px_3px_0_var(--badge-shadow-color)]',
        text: 'text-[12px]'
    },
    md: {
        gap: 'gap-1',
        iconSize: 'text-[10px]',
        pad: 'px-3 py-0.5',
        removeSize: 'h-3.5 w-3.5',
        shadow: 'shadow-[2px_2px_0_var(--badge-shadow-color)]',
        text: 'text-[11px]'
    },
    sm: {
        gap: 'gap-1',
        iconSize: 'text-[10px]',
        pad: 'px-2.5 py-0.5',
        removeSize: 'h-3 w-3',
        shadow: 'shadow-[2px_2px_0_var(--badge-shadow-color)]',
        text: 'text-[10px]'
    },
    xs: {
        gap: 'gap-0.5',
        iconSize: 'text-[8px]',
        pad: 'px-1.5 py-0',
        removeSize: 'h-3 w-3',
        shadow: 'shadow-[1.5px_1.5px_0_var(--badge-shadow-color)]',
        text: 'text-[9px]'
    }
}

/**
 * Brutalism is most legible at near-square. The `shape` prop survives so
 * call sites that request a pill (e.g. count overlays) get one, but the
 * default radius is 2px — square enough to feel structural.
 */
const SHAPE_CLS = {
    pill: 'rounded-full',
    rounded: 'rounded-sm',
    'rounded-md': 'rounded',
    square: 'rounded-none'
}

const formatCount = (count) => {
    if (typeof count !== 'number' || count <= 0) return null
    if (count > 99) return '99+'
    return String(count)
}

const renderIconNode = (node, sizeCfg) => {
    if (!node) return null
    if (typeof node === 'string') {
        return <i className={`fas fa-${node} ${sizeCfg.iconSize}`} aria-hidden="true" />
    }
    return node
}

export default function Badge({
    children,
    tone = 'neutral',
    variant,
    size = 'sm',
    shape = 'rounded',
    // weight / uppercase accepted for back-compat with the ~290 existing call
    // sites — the brutalist treatment fixes weight at 800 and casing at
    // uppercase, so these are intentionally consumed-then-ignored.
    weight: _weight,
    uppercase: _uppercase,
    icon,
    trailingIcon,
    dot = false,
    count,
    removable = false,
    onRemove,
    as,
    onClick,
    href,
    active = false,
    pulse = false,
    bg,
    fg,
    title,
    className = '',
    ...rest
}) {
    const sizeCfg = SIZE_STYLES[size] ?? SIZE_STYLES.sm
    const shapeCls = SHAPE_CLS[shape] ?? SHAPE_CLS.rounded
    const isCustom = variant === 'custom' || variant === 'custom-solid'
    const toneBgCls = isCustom ? '' : (TONE_BG[tone] ?? TONE_BG.neutral)

    const interactive = Boolean(onClick) || as === 'button' || Boolean(href)
    const Element = as || (href ? 'a' : interactive ? 'button' : 'span')

    /*
     * Single visual treatment for every badge:
     *   - inline-flex + defensive centering (justify-center / text-center /
     *     align-middle / shrink-0 / box-border) so badges render identically
     *     regardless of parent text-align, justify-content, or width pressure.
     *   - white 800-weight uppercase text with 0.08em tracking.
     *   - hard offset shadow scaled per size, colour driven by
     *     --badge-shadow-color (set in src/app/index.css per theme).
     *   - active:translate + shadow-none feels "pressed in" — the badge
     *     drops into the space its shadow occupied.
     */
    const classes = [
        'inline-flex items-center justify-center text-center align-middle shrink-0 box-border whitespace-nowrap leading-none uppercase tracking-[0.08em] font-extrabold text-white',
        sizeCfg.text,
        sizeCfg.pad,
        sizeCfg.gap,
        shapeCls,
        toneBgCls,
        sizeCfg.shadow,
        interactive &&
            'cursor-pointer transition-[transform,box-shadow,filter] duration-100 ease-out hover:brightness-110 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none',
        active && 'translate-x-[1px] translate-y-[1px] !shadow-none',
        pulse && 'animate-pulse',
        className
    ]
        .filter(Boolean)
        .join(' ')

    const inlineStyle = isCustom && (bg || fg) ? { background: bg, color: fg || '#ffffff' } : undefined

    const dotEl = dot ? (
        <span
            className={`shrink-0 rounded-full bg-white/85 ${size === 'xs' || size === 'sm' ? 'h-1 w-1' : 'h-1.5 w-1.5'}`}
            aria-hidden="true"
        />
    ) : null

    const content = count != null ? formatCount(count) : children

    const removeBtn = removable ? (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation()
                onRemove?.()
            }}
            className={`-mr-1 ml-0.5 inline-flex items-center justify-center hover:bg-white/20 ${sizeCfg.removeSize} ${sizeCfg.iconSize}`}
            aria-label="Remove"
        >
            <i className="fas fa-times" aria-hidden="true" />
        </button>
    ) : null

    const elementProps = {
        className: classes,
        onClick,
        style: inlineStyle,
        title,
        ...rest
    }
    if (Element === 'button') {
        elementProps.type = elementProps.type ?? 'button'
    }
    if (Element === 'a' && href) {
        elementProps.href = href
    }

    return (
        <Element {...elementProps}>
            {dotEl}
            {renderIconNode(icon, sizeCfg)}
            {content != null && content !== '' && <span>{content}</span>}
            {renderIconNode(trailingIcon, sizeCfg)}
            {removeBtn}
        </Element>
    )
}

export { formatCount,SHAPE_CLS, SIZE_STYLES, TONE_BG }
