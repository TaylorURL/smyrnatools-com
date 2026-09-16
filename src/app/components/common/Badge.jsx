import React from 'react'

/**
 * The single badge identity for the whole app. Every badge — status pill,
 * plant code, count chip, filter button — renders the same body, and the
 * component enforces that against its own callers:
 *
 *   - The body is neutral and theme-tracking (`bg-bg-tertiary` +
 *     `text-text-primary`). Both tokens adapt across the light, dark, and
 *     grayed themes, so contrast clears WCAG AA with no per-theme tuning.
 *   - Colour lives only in the leading dot (or the leading icon that
 *     replaces it), carrying the semantic: success, warning, danger, info,
 *     neutral, accent, or a data-driven hue via `variant="custom"`.
 *   - Typography is 700-weight uppercase at 0.06em tracking, and the radius
 *     is a flat 4px.
 *
 * The body classes are all `!important` and the shape map collapses every
 * value to one radius, so a caller's `className`, inline `style`, `weight`,
 * `uppercase`, `dot`, or `shape` cannot move any of it. Those props are
 * still accepted, so passing them is harmless but has no effect; `tone`,
 * `variant`, `size`, `icon`, and the custom `bg`/`fg` are the props that
 * actually change what renders.
 *
 * Common patterns:
 *   <Badge tone="success">Active</Badge>
 *   <Badge tone="danger" size="xs" count={3} />
 *   <Badge variant="custom" bg={plantColor}>{plantCode}</Badge>
 *   <Badge as="button" tone="accent" onClick={...}>Filter</Badge>
 */

/**
 * Dot background per tone. These saturated status tokens are the only hue a
 * tone contributes — the body stays `bg-bg-tertiary` regardless.
 */
const TONE_DOT_CLS = {
    accent: 'bg-accent',
    danger: 'bg-status-danger',
    info: 'bg-status-shop',
    neutral: 'bg-status-spare',
    success: 'bg-status-active',
    warning: 'bg-status-warning'
}

/**
 * Text colour per tone, applied to a caller's `icon` — which takes the dot's
 * place as the leading indicator rather than sitting beside it — and to
 * `trailingIcon`. Mirrors `TONE_DOT_CLS` tone for tone.
 */
const TONE_ICON_CLS = {
    accent: 'text-accent',
    danger: 'text-status-danger',
    info: 'text-status-shop',
    neutral: 'text-status-spare',
    success: 'text-status-active',
    warning: 'text-status-warning'
}

/**
 * Metrics per size. The dot scales with the badge, 4px at xs up to 8px at
 * lg, and padding is deliberately asymmetric — lighter on the left, where
 * the dot already supplies visual weight.
 */
const SIZE_STYLES = {
    lg: {
        dotSize: 'h-2 w-2',
        gap: 'gap-2',
        iconSize: 'text-[11px]',
        pad: 'pl-2.5 pr-3 py-1',
        removeSize: 'h-4 w-4',
        text: 'text-[12px]'
    },
    md: {
        dotSize: 'h-1.5 w-1.5',
        gap: 'gap-1.5',
        iconSize: 'text-[10px]',
        pad: 'pl-2 pr-2.5 py-0.5',
        removeSize: 'h-3.5 w-3.5',
        text: 'text-[11px]'
    },
    sm: {
        dotSize: 'h-1.5 w-1.5',
        gap: 'gap-1.5',
        iconSize: 'text-[10px]',
        pad: 'pl-1.5 pr-2 py-0.5',
        removeSize: 'h-3 w-3',
        text: 'text-[10px]'
    },
    xs: {
        dotSize: 'h-1 w-1',
        gap: 'gap-1',
        iconSize: 'text-[8px]',
        // 2px is the minimum vertical padding that clears descenders here:
        // at 9px with leading-none, py-0 crops the tails of g/y/p/q against
        // the body edge.
        pad: 'pl-1 pr-1.5 py-0.5',
        removeSize: 'h-3 w-3',
        text: 'text-[9px]'
    }
}

/**
 * Every entry maps to `rounded` on purpose. Call sites pass `shape="pill"`,
 * `"square"`, and the rest, but one radius for every badge is the point of
 * the component, so each request resolves to the same 4px — and the base
 * classes below pin it again with `!rounded`.
 */
const SHAPE_CLS = {
    pill: 'rounded',
    rounded: 'rounded',
    'rounded-md': 'rounded',
    square: 'rounded'
}

/** Badge label for a numeric `count`, capped at "99+". Returns null for
 *  zero, negatives, and non-numbers, which renders a badge with a dot and no
 *  label rather than hiding it. */
const formatCount = (count) => {
    if (typeof count !== 'number' || count <= 0) return null
    if (count > 99) return '99+'
    return String(count)
}

/**
 * Render one of the badge's icon slots. A string is a Font Awesome name and
 * may be written either bare (`"check"`) or prefixed (`"fa-check"`); the
 * prefix is stripped so both spellings resolve to the same icon. A React
 * node is rendered as-is, uncoloured and unsized.
 */
const renderIconNode = (node, sizeCfg, colorCls) => {
    if (!node) return null
    if (typeof node === 'string') {
        const name = node.replace(/^fa-/, '')
        return <i className={`fas fa-${name} ${sizeCfg.iconSize} ${colorCls}`} aria-hidden="true" />
    }
    return node
}

/**
 * Drop `background`, `backgroundColor`, and `color` from a caller's inline
 * `style` — the three properties that could recolour the body away from the
 * uniform neutral. Everything else (positioning, min-width, transitions)
 * passes through, and a style left with no properties returns undefined so
 * the attribute is omitted entirely.
 */
const cleanStyleProp = (style) => {
    if (!style || typeof style !== 'object') return style
    const { background, backgroundColor, color, ...rest } = style
    void background
    void backgroundColor
    void color
    return Object.keys(rest).length > 0 ? rest : undefined
}

export default function Badge({
    children,
    tone = 'neutral',
    variant,
    size = 'sm',
    shape = 'rounded',
    weight: _weight,
    uppercase: _uppercase,
    icon,
    trailingIcon,
    dot: _dot,
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

    const interactive = Boolean(onClick) || as === 'button' || Boolean(href)
    const Element = as || (href ? 'a' : interactive ? 'button' : 'span')

    // A caller reaching for `style={{ background: ... }}` would otherwise
    // beat every class below, so the body colours are stripped before the
    // rest of the props are spread onto the element.
    const cleanedRest = { ...rest, style: cleanStyleProp(rest.style) }
    if (cleanedRest.style === undefined) delete cleanedRest.style

    // The `!` on the second line is load-bearing. `className` is appended
    // last, but Tailwind's output order — not the order classes appear in
    // the attribute — decides which utility wins, so an unmarked
    // `font-bold` here loses to a caller's `font-semibold`. Marking the
    // whole identity as important is what makes it unoverridable.
    const classes = [
        'inline-flex items-center justify-center text-center align-middle shrink-0 box-border whitespace-nowrap leading-none',
        '!uppercase !tracking-[0.06em] !font-bold !text-text-primary !bg-bg-tertiary !rounded',
        sizeCfg.text,
        sizeCfg.pad,
        sizeCfg.gap,
        shapeCls,
        interactive &&
            'cursor-pointer transition-[transform,filter] duration-100 ease-out hover:brightness-95 active:scale-[0.97]',
        active && 'ring-1 ring-inset ring-accent/40',
        pulse && 'animate-pulse',
        className
    ]
        .filter(Boolean)
        .join(' ')

    // Exactly one leading indicator, chosen in this order:
    //   1. the caller's `icon`, tinted by tone or by the custom hue;
    //   2. a dot, but only where there is a semantic colour for it to
    //      carry — any tone variant, or a custom variant given `bg`/`fg`;
    //   3. nothing, for a custom variant with no colour. Those callers
    //      supply their own icon inside `children`, and a dot would only
    //      eat the left padding.
    //
    // `bg` and `fg` reach the dot or the icon and never the body: the body
    // keeps its theme-tracking classes so text contrast survives every
    // theme, which a caller-supplied foreground could not guarantee.
    const dotColorCls = isCustom ? '' : (TONE_DOT_CLS[tone] ?? TONE_DOT_CLS.neutral)
    const iconColorCls = isCustom ? '' : (TONE_ICON_CLS[tone] ?? TONE_ICON_CLS.neutral)
    const customColor = isCustom ? bg || fg : null
    const renderDot = !icon && (!isCustom || customColor)

    const leadingEl = icon ? (
        renderIconNode(icon, sizeCfg, isCustom ? '' : iconColorCls)
    ) : renderDot ? (
        <span
            className={`shrink-0 rounded-full ${sizeCfg.dotSize} ${dotColorCls}`}
            /* eslint-disable-next-line react/forbid-dom-props -- data-driven dot colour for variant="custom" */
            style={customColor ? { background: customColor } : undefined}
            aria-hidden="true"
        />
    ) : null

    // A custom hue has to land on the icon through an inline style, which
    // needs an element of its own — the icon itself may be a caller's React
    // node that takes no styling from here.
    const leadingWrapper =
        icon && customColor ? (
            <span
                className="inline-flex shrink-0"
                /* eslint-disable-next-line react/forbid-dom-props -- data-driven icon colour for variant="custom" */
                style={{ color: customColor }}
            >
                {leadingEl}
            </span>
        ) : (
            leadingEl
        )

    const content = count != null ? formatCount(count) : children

    const removeBtn = removable ? (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation()
                onRemove?.()
            }}
            className={`-mr-1 ml-0.5 inline-flex items-center justify-center hover:bg-current/10 ${sizeCfg.removeSize} ${sizeCfg.iconSize}`}
            aria-label="Remove"
        >
            <i className="fas fa-times" aria-hidden="true" />
        </button>
    ) : null

    const elementProps = {
        className: classes,
        onClick,
        title,
        ...cleanedRest
    }
    if (Element === 'button') {
        elementProps.type = elementProps.type ?? 'button'
    }
    if (Element === 'a' && href) {
        elementProps.href = href
    }

    // `content` is spread straight into the flex row rather than wrapped in
    // a span. Callers passing several children — an icon plus two spans, for
    // one — need each to be its own flex item to pick up the row's `gap-*`;
    // a wrapper would collapse them into one item with no spacing between.
    return (
        <Element {...elementProps}>
            {leadingWrapper}
            {content != null && content !== '' && content}
            {renderIconNode(trailingIcon, sizeCfg, isCustom ? '' : iconColorCls)}
            {removeBtn}
        </Element>
    )
}

export { cleanStyleProp, SIZE_STYLES }
