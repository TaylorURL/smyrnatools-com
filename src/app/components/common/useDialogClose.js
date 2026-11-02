import { useCallback, useEffect, useRef } from 'react'

/**
 * The `onClose` to hand `ui/Dialog` from a popup that can have another one
 * stacked over it. It fixes two things the bare prop gets wrong:
 *
 *   - Dialog re-runs its focus handling whenever `onClose` changes, and the
 *     callers of these popups pass inline arrows, so every render of the
 *     parent would pull focus back to the panel, out of the field being typed
 *     in. This returns one function for the dialog's whole life that calls
 *     the latest prop.
 *   - Dialog closes on Escape pressed anywhere on the page, so with a picker
 *     or a confirmation open over this dialog one keypress would close both.
 *     This ignores the call while focus sits in a different modal, which is
 *     only the case when that modal is the one on top.
 *
 * Put `anchorRef` on any element inside the dialog's body.
 */
export default function useDialogClose(onClose) {
    const anchorRef = useRef(null)
    const onCloseRef = useRef(onClose)
    useEffect(() => {
        onCloseRef.current = onClose
    })
    const handleClose = useCallback(() => {
        const panel = anchorRef.current?.closest('[aria-modal="true"]')
        const focusedModal = document.activeElement?.closest?.('[aria-modal="true"]')
        if (panel && focusedModal && focusedModal !== panel) return
        onCloseRef.current?.()
    }, [])
    return { anchorRef, handleClose }
}
