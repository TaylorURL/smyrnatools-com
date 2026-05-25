import { useLayoutEffect, useState } from 'react'

/**
 * Compute viewport-anchored coordinates for a dropdown / popover that
 * should sit flush under its trigger button. Returns coords ready to
 * spread into a `position: fixed` style so the panel can be rendered
 * via `createPortal(node, document.body)` and escape any ancestor
 * `overflow` clipping context (the bug it solves: a header bar with
 * `overflow-x: auto` implicitly clips Y too, so an `absolute` popover
 * gets cut off by content below).
 *
 * Recomputes on `resize` and on any `scroll` event (capture phase) so
 * the menu tracks the trigger when a clipping ancestor is scrolled
 * horizontally / vertically while the menu is open.
 *
 * @param {React.RefObject<HTMLElement>} triggerRef - Ref on the
 *   trigger button. Its bounding rect anchors the menu.
 * @param {boolean} open - When false the hook short-circuits to avoid
 *   measuring an unmounted trigger.
 * @param {'left' | 'right'} [align='right'] - Which trigger edge the
 *   menu hangs from. `'right'` matches the rest of the site's right-
 *   aligned action menus; `'left'` is the natural fit for stepper-style
 *   popovers (date pickers, etc.).
 *
 * @returns {{ top: number, left?: number, right?: number } | null}
 */
export default function useFixedDropdownPosition(triggerRef, open, align = 'right') {
    const [pos, setPos] = useState(null)
    useLayoutEffect(() => {
        if (!open || !triggerRef.current) return undefined
        const recompute = () => {
            const el = triggerRef.current
            if (!el) return
            const rect = el.getBoundingClientRect()
            if (align === 'left') {
                setPos({ left: Math.max(8, rect.left), top: rect.bottom + 4 })
            } else {
                setPos({ right: Math.max(8, window.innerWidth - rect.right), top: rect.bottom + 4 })
            }
        }
        recompute()
        window.addEventListener('resize', recompute)
        window.addEventListener('scroll', recompute, true)
        return () => {
            window.removeEventListener('resize', recompute)
            window.removeEventListener('scroll', recompute, true)
        }
    }, [align, open, triggerRef])
    return pos
}
