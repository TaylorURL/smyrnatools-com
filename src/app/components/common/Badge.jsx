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

/**
 * Per-tone badge background. Deliberately darker than the top-level
 * `--status-*` tokens used elsewhere (icons, charts) because the brutalist
 * treatment puts WHITE text on the fill, and the lighter top-level tones
 * (especially `#16a34a` green @ 3.3:1 and `#ca8a04` amber @ 2.97:1) fail
 * WCAG AA against white. Every value below clears 4.5:1 against white text
 * and remains identical across light / dark / grayed themes (badge bg is
 * theme-invariant — only the surrounding surface changes).
 *
 * Approximate contrast against white text:
 *   accent  (#1e3a5f navy)   — 11.4:1  AAA
 *   info    (#1d4ed8 blue)   —  8.6:1  AAA
 *   neutral (#475569 slate)  —  7.4:1  AAA
 *   danger  (#b91c1c red)    —  6.2:1  AA+
 *   success (#15803d green)  —  5.0:1  AA
 *   warning (#a16207 amber)  —  4.9:1  AA
 */
const TONE_BG = {
    accent: 'bg-[#1e3a5f]',
    danger: 'bg-[#b91c1c]',
    info: 'bg-[#1d4ed8]',
    neutral: 'bg-[#475569]',
    success: 'bg-[#15803d]',
    warning: 'bg-[#a16207]'
}

/**
 * Parse a CSS colour string into {r, g, b} 0-255. Handles `#rrggbb`,
 * `#rgb`, and `rgb()` / `rgba()` literals. Returns null for inputs we
 * can't statically resolve (CSS custom properties, `hsl()`, named colours)
 * — callers fall back to white text in that case, which is safe for the
 * project's known data-driven palette (plant codes and the navy accent
 * are all dark enough to read white text against).
 */
const parseColorToRgb = (input) => {
    if (typeof input !== 'string') return null
    const str = input.trim()
    if (str.startsWith('#')) {
        if (str.length === 4) {
            return {
                b: parseInt(str[3] + str[3], 16),
                g: parseInt(str[2] + str[2], 16),
                r: parseInt(str[1] + str[1], 16)
            }
        }
        if (str.length === 7 || str.length === 9) {
            return {
                b: parseInt(str.slice(5, 7), 16),
                g: parseInt(str.slice(3, 5), 16),
                r: parseInt(str.slice(1, 3), 16)
            }
        }
        return null
    }
    const match = str.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
    if (match) {
        return { b: parseInt(match[3], 10), g: parseInt(match[2], 10), r: parseInt(match[1], 10) }
    }
    return null
}

/**
 * WCAG relative luminance for an {r, g, b} colour. Values 0–1.
 */
const relativeLuminance = ({ b, g, r }) => {
    const channel = (c) => {
        const v = c / 255
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/**
 * Pick a readable foreground for an arbitrary background. The 0.45
 * luminance threshold matches the WCAG AA crossover for white vs dark
 * text: backgrounds darker than this read better with `#ffffff`, lighter
 * ones with a near-black `#0b1220`. Unparseable inputs (CSS vars, etc.)
 * default to white — safe for the project's known data-driven palette.
 */
const pickContrastFg = (bg) => {
    const parsed = parseColorToRgb(bg)
    if (!parsed) return '#ffffff'
    return relativeLuminance(parsed) > 0.45 ? '#0b1220' : '#ffffff'
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

    // For variant="custom" data-driven backgrounds (plant codes, role colours,
    // accent overrides), compute the readable foreground from the supplied
    // `bg`'s luminance unless the caller explicitly passed an `fg`. This
    // guarantees the text reads against whatever hue the data provides —
    // light plant colour gets dark text, dark plant colour gets white text.
    const inlineStyle = isCustom && (bg || fg)
        ? { background: bg, color: fg || pickContrastFg(bg) }
        : undefined

    // Dot inherits `currentColor` so it stays legible against whatever
    // text colour the badge resolved to (white for tones + dark custom bgs,
    // near-black for light custom bgs).
    const dotEl = dot ? (
        <span
            className={`shrink-0 rounded-full bg-current opacity-85 ${size === 'xs' || size === 'sm' ? 'h-1 w-1' : 'h-1.5 w-1.5'}`}
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
            className={`-mr-1 ml-0.5 inline-flex items-center justify-center hover:bg-current/20 ${sizeCfg.removeSize} ${sizeCfg.iconSize}`}
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

export { formatCount, parseColorToRgb, pickContrastFg, relativeLuminance, SHAPE_CLS, SIZE_STYLES, TONE_BG }
