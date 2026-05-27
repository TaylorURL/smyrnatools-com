/**
 * Server-side badge HTML renderer — brutalist treatment.
 *
 * Mirrors the React `<Badge />` component (`src/app/components/common/Badge
 * .jsx`) exactly so email-rendered badges share the same visual identity
 * as in-app badges: saturated tone background, white 800-weight uppercase
 * text with 0.08em tracking, sharp 2px corners, and a hard offset drop
 * shadow at `rgba(0,0,0,0.75)`.
 *
 * Email clients strip `<style>` blocks and disallow class-based styling,
 * so every badge ships its design as a flat inline style string. The
 * shadow color is hard-coded (CSS custom properties aren't supported in
 * most email clients) — emails always render against a light background
 * so the 75% black shadow is consistently visible.
 *
 * Usage:
 *   const { renderBadgeHtml } = require('./badgeHtml');
 *   renderBadgeHtml({ label: 'Needs help', tone: 'danger' })
 *   renderBadgeHtml({ label: 'Covered', tone: 'success' })
 *   renderBadgeHtml({ label: 'Direct load', tone: 'info', size: 'sm' })
 *   renderBadgeHtml({ label: '★ SC', bg: '#a1b2c3' })   // data-driven
 */

/**
 * Per-tone badge background — mirrors `TONE_BG` in
 * `src/app/components/common/Badge.jsx`. Values are deliberately darker
 * than the top-level `--status-*` tokens used elsewhere because the
 * brutalist treatment puts WHITE text on the fill, and the lighter
 * tones (especially `#16a34a` green @ 3.3:1 and `#ca8a04` amber @ 2.97:1)
 * fail WCAG AA against white. Every value below clears 4.5:1.
 */
const TONE_BG = {
    accent: '#1e3a5f',
    danger: '#b91c1c',
    info: '#1d4ed8',
    neutral: '#475569',
    success: '#15803d',
    warning: '#a16207'
}

/**
 * Parse `#rrggbb` / `#rgb` / `rgb()` / `rgba()` → {r, g, b} 0-255. Returns
 * null for CSS custom properties, named colours, and `hsl()` — callers
 * fall back to white text.
 */
const parseColorToRgb = (input) => {
    if (typeof input !== 'string') return null
    const str = input.trim()
    if (str.startsWith('#')) {
        if (str.length === 4) {
            return {
                r: parseInt(str[1] + str[1], 16),
                g: parseInt(str[2] + str[2], 16),
                b: parseInt(str[3] + str[3], 16)
            }
        }
        if (str.length === 7 || str.length === 9) {
            return {
                r: parseInt(str.slice(1, 3), 16),
                g: parseInt(str.slice(3, 5), 16),
                b: parseInt(str.slice(5, 7), 16)
            }
        }
        return null
    }
    const match = str.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
    if (match) {
        return { r: parseInt(match[1], 10), g: parseInt(match[2], 10), b: parseInt(match[3], 10) }
    }
    return null
}

/**
 * WCAG relative luminance for an {r, g, b} colour.
 */
const relativeLuminance = ({ r, g, b }) => {
    const channel = (c) => {
        const v = c / 255
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/**
 * Pick a readable foreground for an arbitrary background. Threshold of
 * 0.45 luminance matches the WCAG AA crossover for white vs dark text.
 * Unparseable inputs default to white.
 */
const pickContrastFg = (bg) => {
    const parsed = parseColorToRgb(bg)
    if (!parsed) return '#ffffff'
    return relativeLuminance(parsed) > 0.45 ? '#0b1220' : '#ffffff'
}

/**
 * Per-size rhythm. Padding, font-size, and shadow offset all scale together
 * so the brutalist proportion holds at every chip size.
 */
const SIZE_PALETTE = {
    lg: { font: 12, padX: 14, padY: 4, shadow: '3px 3px 0' },
    md: { font: 11, padX: 12, padY: 2, shadow: '2px 2px 0' },
    sm: { font: 10, padX: 10, padY: 2, shadow: '2px 2px 0' },
    xs: { font: 9, padX: 6, padY: 0, shadow: '1.5px 1.5px 0' }
}

const SHAPE_RADIUS = {
    pill: '999px',
    rounded: '2px',
    'rounded-md': '4px',
    square: '0'
}

const SHADOW_COLOR = 'rgba(0,0,0,0.75)'

const htmlEscape = (value) => {
    const str = value == null ? '' : String(value)
    return str.replace(
        /[&<>"']/g,
        (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]
    )
}

/**
 * Renders an inline-styled `<span>` badge suitable for email HTML. Every
 * call produces the same brutalist visual — saturated tone background,
 * white 800-weight uppercase text, 2px corners, hard offset shadow.
 *
 * @param {object} opts
 * @param {string} opts.label                     — badge text
 * @param {'success'|'warning'|'danger'|'info'|'neutral'|'accent'} [opts.tone='neutral']
 * @param {'xs'|'sm'|'md'|'lg'} [opts.size='sm']
 * @param {'pill'|'rounded'|'rounded-md'|'square'} [opts.shape='rounded']
 * @param {string} [opts.bg]                      — custom background (overrides tone — for plant codes, role colors)
 * @param {string} [opts.fg='#ffffff']            — custom foreground (defaults white to maintain brutalist contrast)
 * @param {string} [opts.marginRight]             — e.g. '6px' for trailing space
 * @returns {string}                              — HTML string
 */
function renderBadgeHtml({
    label,
    tone = 'neutral',
    size = 'sm',
    shape = 'rounded',
    bg,
    fg,
    marginRight
} = {}) {
    const sizeCfg = SIZE_PALETTE[size] || SIZE_PALETTE.sm
    const finalBg = bg || TONE_BG[tone] || TONE_BG.neutral
    // If caller supplied a data-driven `bg` without an explicit `fg`, pick a
    // contrast-safe text colour from the bg's luminance. Tone-based bgs are
    // pre-checked to pass 4.5:1 against white so they fall through to the
    // hardcoded white below.
    const finalFg = fg || (bg ? pickContrastFg(bg) : '#ffffff')
    const radius = SHAPE_RADIUS[shape] || SHAPE_RADIUS.rounded

    const styleParts = [
        'display:inline-block',
        `padding:${sizeCfg.padY}px ${sizeCfg.padX}px`,
        `border-radius:${radius}`,
        `font-size:${sizeCfg.font}px`,
        'font-weight:800',
        'text-transform:uppercase',
        'letter-spacing:0.08em',
        `background:${finalBg}`,
        `color:${finalFg}`,
        `box-shadow:${sizeCfg.shadow} ${SHADOW_COLOR}`
    ]
    if (marginRight) {
        styleParts.push(`margin-right:${marginRight}`)
    }

    return `<span style="${styleParts.join(';')};">${htmlEscape(label)}</span>`
}

module.exports = {
    htmlEscape,
    parseColorToRgb,
    pickContrastFg,
    relativeLuminance,
    renderBadgeHtml,
    SHADOW_COLOR,
    SHAPE_RADIUS,
    SIZE_PALETTE,
    TONE_BG
}
