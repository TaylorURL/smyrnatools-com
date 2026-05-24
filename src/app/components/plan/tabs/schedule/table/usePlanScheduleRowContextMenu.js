import { useCallback, useEffect, useState } from 'react'

/** Right-click context menu hook for order rows + the "View tickets" /
 *  "View order" modals it launches. Lives at the table level (not inside the
 *  row map) because the menu needs to render once at fixed screen coords
 *  and dismiss on outside click. */
export function usePlanScheduleRowContextMenu() {
    const [rowMenu, setRowMenu] = useState(null)
    const [ticketsOrder, setTicketsOrder] = useState(null)
    const [infoOrder, setInfoOrder] = useState(null)
    useEffect(() => {
        if (!rowMenu) return undefined
        const dismiss = () => setRowMenu(null)
        window.addEventListener('click', dismiss)
        window.addEventListener('scroll', dismiss, true)
        window.addEventListener('resize', dismiss)
        const onKey = (e) => {
            if (e.key === 'Escape') dismiss()
        }
        window.addEventListener('keydown', onKey)
        return () => {
            window.removeEventListener('click', dismiss)
            window.removeEventListener('scroll', dismiss, true)
            window.removeEventListener('resize', dismiss)
            window.removeEventListener('keydown', onKey)
        }
    }, [rowMenu])
    const openRowMenu = useCallback((event, order) => {
        event.preventDefault()
        setRowMenu({ order, x: event.clientX, y: event.clientY })
    }, [])
    return { infoOrder, openRowMenu, rowMenu, setInfoOrder, setRowMenu, setTicketsOrder, ticketsOrder }
}
