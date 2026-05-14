import { useEffect } from 'react'

/**
 * Binds the list view's Cmd+K (focus search) and Cmd+N (open add sheet)
 * shortcuts. Refs / setters are read fresh on each keydown via the
 * callbacks passed in, so subscriber identity stays stable.
 */
export function useListKeyboardShortcuts({ openAddSheet, searchInputRef }) {
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.metaKey && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                searchInputRef.current?.focus()
            }
            if (e.metaKey && e.key.toLowerCase() === 'n') {
                e.preventDefault()
                openAddSheet()
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [openAddSheet, searchInputRef])
}
