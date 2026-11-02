import { useCallback, useEffect } from 'react'

import { isDarkLikeTheme, normalizeThemeMode } from '../constants/themeConstants'
import { usePreferences } from '../context/PreferencesContext'

/**
 * Applies the user's theme mode (light / dark) by toggling the `dark` class
 * on `<html>`. Adds a brief transition class for smooth color animation
 * during switches.
 *
 * The `dark` class drives Tailwind's `dark:` variants AND the dark CSS
 * token block in `index.css`.
 */
export function useThemeMode() {
    const { preferences, updatePreferences } = usePreferences()
    const themeMode = normalizeThemeMode(preferences.themeMode)
    useEffect(() => {
        const root = document.documentElement
        root.classList.add('theme-transitioning')
        if (isDarkLikeTheme(themeMode)) {
            root.classList.add('dark')
        } else {
            root.classList.remove('dark')
        }
        const timer = setTimeout(() => root.classList.remove('theme-transitioning'), 450)
        return () => clearTimeout(timer)
    }, [themeMode])
    const toggleTheme = useCallback(() => {
        updatePreferences('themeMode', isDarkLikeTheme(themeMode) ? 'light' : 'dark')
    }, [themeMode, updatePreferences])
    return { themeMode, toggleTheme }
}
