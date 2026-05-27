/**
 * Server-side badge HTML renderer — mirrors the React `<Badge />` component's
 * tones and sizes for use in email templates (daily-plan-email.js, etc.).
 *
 * Email clients strip `<style>` blocks and disallow class-based styling, so
 * every badge ships its design as a flat inline style string. The tone palette
 * intentionally mirrors `src/app/components/common/Badge.jsx` so the visual
 * language stays identical between in-app pills and rendered emails.
 *
 * Usage:
 *   const { renderBadgeHtml } = require('./badgeHtml');
 *   renderBadgeHtml({ label: 'Needs help', tone: 'danger' })
 *   renderBadgeHtml({ label: 'Covered', tone: 'success' })
 *   renderBadgeHtml({ label: 'Direct load', tone: 'info', size: 'sm' })
 *   renderBadgeHtml({ label: '★ SC', bg: '#a1b2c3', fg: '#fff' }) // custom
 */

const TONE_PALETTE = {
    accent: {
        soft: { bg: 'rgba(30,58,95,0.12)', fg: '#1e3a5f' },
        solid: { bg: '#1e3a5f', fg: '#ffffff' },
    },
    danger: {
        soft: { bg: 'rgba(220,38,38,0.12)', fg: '#b91c1c' },
        solid: { bg: '#dc2626', fg: '#ffffff' },
    },
    info: {
        soft: { bg: 'rgba(14,165,233,0.12)', fg: '#0369a1' },
        solid: { bg: '#2563eb', fg: '#ffffff' },
    },
    neutral: {
        soft: { bg: 'rgba(100,116,139,0.12)', fg: '#475569' },
        solid: { bg: '#64748b', fg: '#ffffff' },
    },
    success: {
        soft: { bg: 'rgba(22,163,74,0.12)', fg: '#15803d' },
        solid: { bg: '#16a34a', fg: '#ffffff' },
    },
    warning: {
        soft: { bg: 'rgba(217,119,6,0.12)', fg: '#c2410c' },
        solid: { bg: '#d97706', fg: '#ffffff' },
    },
};

const SIZE_PALETTE = {
    lg: { font: 11, letter: 0.1, padX: 10, padY: 4 },
    md: { font: 10.5, letter: 0.08, padX: 9, padY: 3 },
    sm: { font: 10, letter: 0.08, padX: 9, padY: 3 },
    xs: { font: 9, letter: 0.06, padX: 6, padY: 2 },
};

const SHAPE_RADIUS = {
    pill: '999px',
    rounded: '4px',
    'rounded-md': '6px',
    square: '2px',
};

const htmlEscape = value => {
    const str = value == null ? '' : String(value);
    return str.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
};

/**
 * Renders an inline-styled `<span>` badge suitable for email HTML.
 *
 * @param {object} opts
 * @param {string} opts.label                       — badge text
 * @param {'success'|'warning'|'danger'|'info'|'neutral'|'accent'} [opts.tone='neutral']
 * @param {'soft'|'solid'} [opts.variant='soft']    — fill style
 * @param {'xs'|'sm'|'md'|'lg'} [opts.size='sm']    — type scale
 * @param {'pill'|'rounded'|'rounded-md'|'square'} [opts.shape='pill']
 * @param {boolean} [opts.bold=true]
 * @param {boolean} [opts.uppercase=true]
 * @param {string} [opts.bg]                        — custom background (overrides tone)
 * @param {string} [opts.fg]                        — custom foreground (overrides tone)
 * @param {string} [opts.marginRight]               — e.g. '6px' for trailing space
 * @returns {string}                                — HTML string
 */
function renderBadgeHtml({
    label,
    tone = 'neutral',
    variant = 'soft',
    size = 'sm',
    shape = 'pill',
    bold = true,
    uppercase = true,
    bg,
    fg,
    marginRight,
} = {}) {
    const sizeCfg = SIZE_PALETTE[size] || SIZE_PALETTE.sm;
    const toneCfg = (TONE_PALETTE[tone] || TONE_PALETTE.neutral)[variant]
        || (TONE_PALETTE[tone] || TONE_PALETTE.neutral).soft;
    const finalBg = bg || toneCfg.bg;
    const finalFg = fg || toneCfg.fg;
    const radius = SHAPE_RADIUS[shape] || SHAPE_RADIUS.pill;

    const styleParts = [
        'display:inline-block',
        `padding:${sizeCfg.padY}px ${sizeCfg.padX}px`,
        `border-radius:${radius}`,
        `font-size:${sizeCfg.font}px`,
        `font-weight:${bold ? 700 : 500}`,
        `background:${finalBg}`,
        `color:${finalFg}`,
    ];
    if (uppercase) {
        styleParts.push('text-transform:uppercase', `letter-spacing:${sizeCfg.letter}em`);
    }
    if (marginRight) {
        styleParts.push(`margin-right:${marginRight}`);
    }

    return `<span style="${styleParts.join(';')};">${htmlEscape(label)}</span>`;
}

module.exports = { renderBadgeHtml, TONE_PALETTE, SIZE_PALETTE, SHAPE_RADIUS, htmlEscape };
