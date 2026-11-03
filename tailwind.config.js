/**
 * A theme colour that takes an opacity modifier (`ring-accent/30`,
 * `bg-status-danger/10`). Tailwind cannot put an alpha on a bare
 * `var(--accent)`, so every such utility built no rule at all: tints never
 * showed and focus rings fell back to Tailwind's default blue. Mixing with
 * transparent keeps the variable live, so both themes still apply.
 */
const themeColor =
    (name) =>
    ({ opacityValue }) =>
        // A plain `bg-accent` is handed `var(--tw-bg-opacity, 1)`; nothing in the
        // app sets those opacity variables, so it stays the bare variable.
        opacityValue === undefined || opacityValue === '1' || String(opacityValue).startsWith('var(--tw-')
            ? `var(--${name})`
            : `color-mix(in srgb, var(--${name}) calc(${opacityValue} * 100%), transparent)`

module.exports = {
    content: ['./src/**/*.{js,jsx,ts,tsx}', './index.html'],
    theme: {
        extend: {
            colors: {
                accent: themeColor('accent'),
                'accent-hover': themeColor('accent-hover'),
                'accent-dark': themeColor('accent-dark'),
                'bg-primary': themeColor('bg-primary'),
                'bg-secondary': themeColor('bg-secondary'),
                'bg-tertiary': themeColor('bg-tertiary'),
                'text-primary': themeColor('text-primary'),
                'text-secondary': themeColor('text-secondary'),
                'text-tertiary': themeColor('text-tertiary'),
                'border-light': themeColor('border-light'),
                'border-medium': themeColor('border-medium'),
                'bg-hover': themeColor('bg-hover'),
                'status-active': themeColor('status-active'),
                'status-warning': themeColor('status-warning'),
                'status-danger': themeColor('status-danger'),
                'status-shop': themeColor('status-shop'),
                'status-spare': themeColor('status-spare')
            },
            fontFamily: {
                sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
                heading: ['var(--font-heading)', 'system-ui', 'sans-serif'],
                mono: ['var(--font-mono)', 'ui-monospace', 'monospace']
            },
            boxShadow: {
                card: 'var(--shadow-card)',
                raised: 'var(--shadow-raised)',
                modal: 'var(--shadow-modal)',
                glow: 'var(--shadow-glow)'
            },
            dropShadow: {
                glow: 'var(--drop-shadow-glow)'
            },
            borderRadius: {
                card: '6px',
                modal: '8px'
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease',
                'fade-in-fast': 'fadeIn 0.2s ease-out',
                'fade-out': 'fadeOut 0.3s ease',
                'fade-slide-in': 'fadeSlideIn 0.2s ease-out',
                'slide-up': 'slideUp 0.3s ease',
                'pulse-slow': 'pulse 2s ease-in-out infinite',
                'msg-in': 'msgIn 0.3s ease-out',
                'fade-in-up': 'fadeInUp 0.45s ease-out both',
                'reveal-left': 'revealFromLeft 0.5s ease-out both',
                'reveal-right': 'revealFromRight 0.5s ease-out both',
                'drawer-in-left': 'drawerInLeft 0.22s ease-out both',
                'reveal-up': 'revealFromUp 0.5s ease-out both',
                'pop-in': 'popIn 0.2s ease-out',
                'dialog-in': 'dialogIn 0.16s ease-out',
                'slide-in-row': 'slideInRow 0.4s ease-out both',
                'comment-slide-in': 'commentSlideIn 0.3s ease-out',
                'comment-fade-in': 'fadeIn 0.2s ease',
                'confirm-slide-in': 'confirmSlideIn 0.2s ease-out',
                shimmer: 'shimmer 1.5s infinite',
                'plan-overbook-glow': 'planOverbookGlow 2.4s ease-in-out infinite',
                'plan-overbook-wobble': 'planOverbookWobble 2.4s ease-in-out infinite',
                'filter-fade': 'filterFadeIn 0.15s ease-out',
                'fuse-shimmer': 'fuseShimmer 2.2s ease-in-out infinite',
                'fuse-pulse': 'fusePulse 1.6s ease-in-out infinite',
                'tutorial-pulse': 'tutorialPulse 2s ease-in-out infinite',
                'dv-spin': 'dvSpin 0.7s linear infinite',
                'dv-fade-in': 'dvFadeIn 0.3s ease-out',
                'dv-slide-up': 'dvSlideUp 0.3s ease-out',
                'dv-scale-in': 'dvScaleIn 0.2s ease-out'
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' }
                },
                fadeOut: {
                    '0%': { opacity: '1' },
                    '100%': { opacity: '0' }
                },
                fadeSlideIn: {
                    '0%': { opacity: '0', transform: 'translateY(-8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' }
                },
                pulse: {
                    '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.4' },
                    '40%': { transform: 'scale(1)', opacity: '1' }
                },
                planOverbookGlow: {
                    '0%, 100%': {
                        boxShadow: '0 0 0 0 color-mix(in srgb, var(--notice-danger) 55%, transparent)'
                    },
                    '50%': { boxShadow: '0 0 0 6px transparent' }
                },
                planOverbookWobble: {
                    '0%, 100%': { transform: 'rotate(0deg)' },
                    '25%': { transform: 'rotate(-7deg)' },
                    '75%': { transform: 'rotate(7deg)' }
                },
                filterFadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(-4px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' }
                },
                fuseShimmer: {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(250%)' }
                },
                fusePulse: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.55' }
                },
                // TutorialPopup sets --tutorial-accent as an inline style, so
                // the ring colour follows the user's accent at runtime rather
                // than being baked in at build time.
                tutorialPulse: {
                    '0%, 100%': {
                        boxShadow: '0 0 0 0 color-mix(in srgb, var(--tutorial-accent, var(--accent)) 40%, transparent)'
                    },
                    '50%': { boxShadow: '0 0 0 8px transparent' }
                },
                dvSpin: {
                    to: { transform: 'rotate(360deg)' }
                },
                dvFadeIn: {
                    from: { opacity: '0', transform: 'translateY(8px)' },
                    to: { opacity: '1', transform: 'translateY(0)' }
                },
                dvSlideUp: {
                    from: { transform: 'translateY(100%)' },
                    to: { transform: 'translateY(0)' }
                },
                dvScaleIn: {
                    from: { opacity: '0', transform: 'translateY(-50%) scaleY(0)' },
                    to: { opacity: '1', transform: 'translateY(-50%) scaleY(1)' }
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' }
                },
                msgIn: {
                    '0%': { opacity: '0', transform: 'translateY(-8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' }
                },
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(16px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' }
                },
                revealFromLeft: {
                    '0%': { opacity: '0', transform: 'translateX(-18px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' }
                },
                drawerInLeft: {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(0)' }
                },
                revealFromRight: {
                    '0%': { opacity: '0', transform: 'translateX(18px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' }
                },
                revealFromUp: {
                    '0%': { opacity: '0', transform: 'translateY(14px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' }
                },
                dialogIn: {
                    '0%': { opacity: '0', transform: 'translateY(6px) scale(0.985)' },
                    '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
                },
                popIn: {
                    '0%': { transform: 'scale(0.8)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' }
                },
                slideInRow: {
                    '0%': { opacity: '0', transform: 'translateX(-20px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' }
                },
                commentSlideIn: {
                    '0%': { opacity: '0', transform: 'translateY(20px) scale(0.98)' },
                    '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
                },
                confirmSlideIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95) translateY(10px)' },
                    '100%': { opacity: '1', transform: 'scale(1) translateY(0)' }
                },
                shimmer: {
                    '0%': { backgroundPosition: '200% 0' },
                    '100%': { backgroundPosition: '-200% 0' }
                }
            }
        }
    },
    plugins: []
}
