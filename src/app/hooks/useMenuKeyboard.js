import { useCallback, useEffect } from 'react'

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled]), [role="option"]:not([aria-disabled="true"])'

/**
 * Keyboard handling for an open popup menu or listbox: Escape closes it and
 * hands focus back to the trigger, the arrow keys and Home/End move focus
 * between the items, and Tab closes it so focus never strands inside a menu
 * that is about to unmount.
 *
 * `containerRef` wraps both the trigger and the menu. The trigger is the
 * element carrying `aria-haspopup`; the items are found by role, so the hook
 * works for the nav dropdowns (`menuitem`) and the region picker (`option`).
 *
 * Returns `focusFirst`, which a trigger calls when the menu was opened from
 * the keyboard so the first item (or the selected option) takes focus.
 */
export function useMenuKeyboard(containerRef, isOpen, close) {
    const items = useCallback(
        () => Array.from(containerRef.current?.querySelectorAll(ITEM_SELECTOR) ?? []),
        [containerRef]
    )

    const focusFirst = useCallback(() => {
        // The menu renders on the same commit that flips `isOpen`, so its items
        // exist by the next frame.
        requestAnimationFrame(() => {
            const list = items()
            const selected = list.find((el) => el.getAttribute('aria-selected') === 'true')
            ;(selected || list[0])?.focus()
        })
    }, [items])

    useEffect(() => {
        if (!isOpen) return undefined
        const handleKey = (e) => {
            const container = containerRef.current
            if (!container) return
            if (e.key === 'Escape') {
                e.preventDefault()
                close()
                container.querySelector('[aria-haspopup]')?.focus()
                return
            }
            if (e.key === 'Tab') {
                close()
                return
            }
            if (!container.contains(document.activeElement)) return
            const list = items()
            if (list.length === 0) return
            const index = list.indexOf(document.activeElement)
            let next = null
            if (e.key === 'ArrowDown') next = list[(index + 1) % list.length]
            else if (e.key === 'ArrowUp') next = list[(index - 1 + list.length) % list.length]
            else if (e.key === 'Home') next = list[0]
            else if (e.key === 'End') next = list[list.length - 1]
            if (next) {
                e.preventDefault()
                next.focus()
            }
        }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [isOpen, close, containerRef, items])

    return focusFirst
}
