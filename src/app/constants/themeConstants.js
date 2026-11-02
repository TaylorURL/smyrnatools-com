/** Fallback accent color used when user has no custom preference. */
export const DEFAULT_ACCENT_COLOR = '#1e3a5f'
/** Fallback theme mode used when user has no custom preference. */
export const DEFAULT_THEME_MODE = 'light'

/** The two themes the app ships: light and dark. */
const THEME_MODES = new Set(['light', 'dark'])

export const isDarkLikeTheme = (mode) => mode === 'dark'

/** Maps a stored theme preference onto a theme the app still has. The gray
 *  theme was retired, and anyone who had it chose a darker look, so they land
 *  on dark; anything else unrecognised falls back to the default. */
export const normalizeThemeMode = (mode) => {
    if (THEME_MODES.has(mode)) return mode
    if (mode === 'grayed') return 'dark'
    return DEFAULT_THEME_MODE
}
