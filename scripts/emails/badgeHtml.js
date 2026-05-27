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
 * Tone palette mirrors the React Badge `bg-status-*` tokens (also defined
 * as CSS custom properties in `src/app/index.css`).
 */
const TONE_BG = {
    accent: '#1e3a5f',
    danger: '#dc2626',
    info: '#2563eb',
    neutral: '#64748b',
    success: '#16a34a',
    warning: '#ca8a04'
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
    const finalFg = fg || '#ffffff'
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

module.exports = { renderBadgeHtml, TONE_BG, SIZE_PALETTE, SHAPE_RADIUS, SHADOW_COLOR, htmlEscape }
