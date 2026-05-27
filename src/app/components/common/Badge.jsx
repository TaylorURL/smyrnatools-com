import React from 'react'

/**
 * Unified Badge component — single source of truth for status pills, count badges,
 * tags, chips, and labels across the entire app. Theme-aware across light/dark/gray
 * via existing CSS custom properties (--status-*, --text-primary, --accent).
 *
 * Common patterns:
 *   <Badge tone="success">Active</Badge>
 *   <Badge tone="warning" size="md" icon="exclamation-triangle">Overdue</Badge>
 *   <Badge tone="danger" variant="solid" shape="pill">Cancelled</Badge>
 *   <Badge tone="danger" count={3} shape="pill" size="xs" />
 *   <Badge tone="accent" removable onRemove={handleRemove}>Plant SC</Badge>
 *   <Badge as="button" tone="accent" active onClick={handleToggle}>Filter</Badge>
 *   <Badge variant="custom" bg="#a1b2c3" fg="#fff">Plant 404</Badge>
 *
 * Migration replaces every inline `<span className="rounded ... px-1 ... text-[9px]
 * font-bold uppercase tracking-wider">` and every per-feature StatusPill/StatusBadge/
 * Chip/Tag/Pill component across the codebase.
 */

/**
 * Tone palette. Soft tints use specific hex codes (`#dcfce7`, `#fef9c3`, …) that
 * the legacy dark-mode CSS shim in `src/app/index.css` auto-flips to dark
 * equivalents (`#162616`, `#1a170a`, …) so the same Tailwind class works across
 * all three themes. Solid variants use the semantic `bg-status-*` tokens with
 * white text. Outline variants use the same status colors at 40% border opacity.
 */
const TONE_STYLES = {
    accent: {
        dotColor: 'bg-accent',
        iconColor: 'text-accent',
        outline: 'border border-accent/40 text-accent bg-transparent',
        soft: 'bg-accent/10 text-accent',
        solid: 'bg-accent text-white'
    },
    danger: {
        dotColor: 'bg-status-danger',
        iconColor: 'text-status-danger',
        outline: 'border border-status-danger/40 text-status-danger bg-transparent',
        soft: 'bg-[#fee2e2] text-text-primary',
        solid: 'bg-status-danger text-white'
    },
    info: {
        dotColor: 'bg-status-shop',
        iconColor: 'text-status-shop',
        outline: 'border border-status-shop/40 text-status-shop bg-transparent',
        soft: 'bg-[#dbeafe] text-text-primary',
        solid: 'bg-status-shop text-white'
    },
    neutral: {
        dotColor: 'bg-status-spare',
        iconColor: 'text-text-tertiary',
        outline: 'border border-border-medium text-text-secondary bg-transparent',
        soft: 'bg-[#f1f5f9] text-text-primary',
        solid: 'bg-status-spare text-white'
    },
    success: {
        dotColor: 'bg-status-active',
        iconColor: 'text-status-active',
        outline: 'border border-status-active/40 text-status-active bg-transparent',
        soft: 'bg-[#dcfce7] text-text-primary',
        solid: 'bg-status-active text-white'
    },
    warning: {
        dotColor: 'bg-status-warning',
        iconColor: 'text-status-warning',
        outline: 'border border-status-warning/40 text-status-warning bg-transparent',
        soft: 'bg-[#fef9c3] text-text-primary',
        solid: 'bg-status-warning text-white'
    }
}

const SIZE_STYLES = {
    lg: {
        dotSize: 'h-2 w-2',
        gap: 'gap-1.5',
        iconSize: 'text-[11px]',
        pad: 'px-2.5 py-1',
        removeSize: 'h-4 w-4',
        text: 'text-xs'
    },
    md: {
        dotSize: 'h-1.5 w-1.5',
        gap: 'gap-1',
        iconSize: 'text-[10px]',
        pad: 'px-2 py-0.5',
        removeSize: 'h-3.5 w-3.5',
        text: 'text-[11px]'
    },
    sm: {
        dotSize: 'h-1.5 w-1.5',
        gap: 'gap-1',
        iconSize: 'text-[9px]',
        pad: 'px-1.5 py-0.5',
        removeSize: 'h-3.5 w-3.5',
        text: 'text-[10px]'
    },
    xs: {
        dotSize: 'h-1 w-1',
        gap: 'gap-0.5',
        iconSize: 'text-[8px]',
        pad: 'px-1 py-0',
        removeSize: 'h-3 w-3',
        text: 'text-[9px]'
    }
}

const SHAPE_STYLES = {
    pill: 'rounded-full',
    rounded: 'rounded',
    'rounded-md': 'rounded-md',
    square: 'rounded-sm'
}

const WEIGHT_STYLES = {
    bold: 'font-bold',
    medium: 'font-medium',
    semibold: 'font-semibold'
}

/**
 * Formats a count badge value. >99 becomes "99+", otherwise stringifies as-is.
 * Returns null for non-positive values so the badge renders nothing.
 */
const formatCount = (count) => {
    if (typeof count !== 'number' || count <= 0) return null
    if (count > 99) return '99+'
    return String(count)
}

/**
 * Renders an icon node. Accepts a Font Awesome class suffix (e.g. "check") or
 * any ReactNode (svg, emoji, etc.). FA strings get themed automatically.
 */
const renderIconNode = (node, sizeCfg, toneIconColor, isCustomVariant) => {
    if (!node) return null
    if (typeof node === 'string') {
        // For custom variant, omit toneIconColor so the inline `fg` (color) cascades
        // to the icon via currentColor instead of being overridden by tone gray.
        const colorCls = isCustomVariant ? '' : toneIconColor
        return <i className={`fas fa-${node} ${sizeCfg.iconSize} ${colorCls}`} aria-hidden="true" />
    }
    return node
}

export default function Badge({
    children,
    tone = 'neutral',
    variant = 'soft',
    size = 'sm',
    shape = 'rounded',
    weight = 'bold',
    uppercase = true,
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
    const shapeCls = SHAPE_STYLES[shape] ?? SHAPE_STYLES.rounded
    const toneCfg = TONE_STYLES[tone] ?? TONE_STYLES.neutral
    const weightCls = WEIGHT_STYLES[weight] ?? WEIGHT_STYLES.bold

    const isCustom = variant === 'custom'
    const variantCls = isCustom ? '' : (toneCfg[variant] ?? toneCfg.soft)

    const interactive = Boolean(onClick) || as === 'button' || Boolean(href)
    const Element = as || (href ? 'a' : interactive ? 'button' : 'span')

    // Base classes are intentionally defensive so the badge looks identical in
    // every parent context (table cell with text-align:right, flex row with
    // justify-end, header, anywhere). `justify-center` + `text-center` neutralize
    // alignment bleed; `shrink-0` prevents crushing in narrow flex layouts;
    // `align-middle` anchors the badge on the inline baseline; `box-border`
    // keeps padding from inflating width unpredictably; `leading-none` already
    // prevents line-height inflation.
    const classes = [
        'inline-flex items-center justify-center text-center align-middle shrink-0 box-border whitespace-nowrap leading-none',
        sizeCfg.text,
        sizeCfg.pad,
        sizeCfg.gap,
        shapeCls,
        weightCls,
        variantCls,
        uppercase && 'uppercase tracking-wider',
        interactive &&
            'cursor-pointer transition-[transform,filter,background-color,color] duration-150 ease-out active:scale-[0.97]',
        interactive && !active && variant === 'soft' && 'hover:brightness-95',
        active && 'ring-1 ring-inset ring-current/40',
        pulse && 'animate-pulse',
        className
    ]
        .filter(Boolean)
        .join(' ')

    const inlineStyle = isCustom || bg || fg ? { background: bg, color: fg } : undefined

    const dotEl = dot ? (
        <span
            className={`shrink-0 rounded-full ${sizeCfg.dotSize} ${typeof dot === 'string' ? '' : toneCfg.dotColor}`}
            // eslint-disable-next-line react/forbid-dom-props -- data-driven dot color (e.g., per-plant accent) requires inline style
            style={typeof dot === 'string' ? { background: dot } : undefined}
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
            className={`ml-0.5 inline-flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 ${sizeCfg.removeSize} ${sizeCfg.iconSize}`}
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
            {renderIconNode(icon, sizeCfg, toneCfg.iconColor, isCustom)}
            {content != null && content !== '' && <span>{content}</span>}
            {renderIconNode(trailingIcon, sizeCfg, toneCfg.iconColor, isCustom)}
            {removeBtn}
        </Element>
    )
}

export { formatCount, SHAPE_STYLES, SIZE_STYLES, TONE_STYLES, WEIGHT_STYLES }
