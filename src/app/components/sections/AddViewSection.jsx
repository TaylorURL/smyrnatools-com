import React, { useEffect, useState } from 'react'

import { getSessionUserId } from '../../../services/SessionService'
import { UserService } from '../../../services/UserService'
import ErrorMessage from '../common/ErrorMessage'
import useDialogClose from '../common/useDialogClose'
import Dialog from '../ui/Dialog'

/** Id of the form-level error banner. Fields marked invalid name it in
 *  aria-describedby, so the message reaches a screen reader from the field. */
export const ADD_VIEW_ERROR_ID = 'add-view-error'

/**
 * Every add form ends with its actions row (`AddViewActions`). That row is
 * pinned to the bottom of the scrolling body and drawn as the dialog's footer
 * band, so the actions stay in reach on a long form and sit where every
 * other dialog keeps them. (Written out in full so Tailwind finds every class.)
 */
const FORM_FOOTER = [
    '[&_form>div:last-child]:sticky',
    '[&_form>div:last-child]:bottom-0',
    '[&_form>div:last-child]:z-raised',
    '[&_form>div:last-child]:-mx-6',
    '[&_form>div:last-child]:mt-0',
    '[&_form>div:last-child]:flex',
    '[&_form>div:last-child]:items-center',
    '[&_form>div:last-child]:justify-end',
    '[&_form>div:last-child]:gap-2',
    '[&_form>div:last-child]:border-t',
    '[&_form>div:last-child]:border-border-light',
    '[&_form>div:last-child]:bg-bg-secondary',
    '[&_form>div:last-child]:px-6',
    '[&_form>div:last-child]:py-3.5'
].join(' ')

/**
 * The row every add form ends with: Cancel, which closes the form just as the
 * header's X does, then the submit button, in the order ConfirmDialog and the
 * other dialogs put them. It must be the form's last child; AddViewSection
 * turns that child into the footer band.
 */
export function AddViewActions({ isSaving = false, label, onCancel }) {
    return (
        <div>
            <button type="button" className="btn-secondary" onClick={onCancel}>
                Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSaving}>
                {isSaving ? 'Adding…' : label}
            </button>
        </div>
    )
}

/**
 * The form inside the dialog. `.add-view-form` styles every field the add
 * forms render; its own padding and overflow are switched off here because
 * the dialog body sets the padding and the footer row has to reach its
 * edges.
 *
 * Its effect runs before Dialog's. React's `autoFocus` focuses a form's first
 * field during commit without leaving an attribute behind, and Dialog would
 * then move focus to its panel. Marking the field lets Dialog land on it
 * instead, and handing focus back to `opener` first keeps Dialog's focus
 * restore pointed at the button that opened the form.
 */
function AddViewBody({ anchorRef, children, error, onDismissError, opener }) {
    useEffect(() => {
        const field = document.activeElement
        if (!field || !anchorRef.current?.contains(field)) return
        field.setAttribute('data-autofocus', '')
        field.blur()
        if (opener && opener !== document.body && typeof opener.focus === 'function') {
            opener.focus({ preventScroll: true })
        }
    }, [anchorRef, opener])

    return (
        <div ref={anchorRef} className="px-6 pt-5">
            <div className={`add-view-form gap-5 overflow-visible !p-0 ${FORM_FOOTER}`}>
                <ErrorMessage id={ADD_VIEW_ERROR_ID} message={error} onDismiss={onDismissError} />
                {children}
            </div>
        </div>
    )
}

/**
 * The dialog every "Add …" form opens in. It checks the user may add before
 * showing the form, and turns a duplicate-key error from the server into a
 * sentence about the number that is already taken.
 *
 * @param {Object} props
 * @param {string} props.title - Dialog title.
 * @param {Function} props.onClose - Closes the dialog.
 * @param {React.ReactNode} props.children - Form content.
 * @param {string} [props.error] - External error message to display.
 * @param {boolean} [props.isListItem=false] - When true, also checks list.add permission.
 */
function AddViewSection({ title, onClose, children, error, isListItem = false }) {
    const [hasPermission, setHasPermission] = useState(null)
    const [internalError, setInternalError] = useState(null)
    // Whatever had focus when the form was asked for: the Add button, as a rule.
    const [opener] = useState(() => (typeof document === 'undefined' ? null : document.activeElement))
    const { anchorRef, handleClose } = useDialogClose(onClose)
    useEffect(() => {
        async function checkPermission() {
            const userId = getSessionUserId()
            if (userId) {
                if (isListItem) {
                    const hasListAdd = await UserService.hasPermission(userId, 'list.add')
                    const hasAssetsAdd = await UserService.hasPermission(userId, 'assets.add')
                    setHasPermission(hasListAdd || hasAssetsAdd)
                } else {
                    const hasAssetsAdd = await UserService.hasPermission(userId, 'assets.add')
                    setHasPermission(hasAssetsAdd)
                }
            } else {
                setHasPermission(false)
            }
        }
        checkPermission()
    }, [isListItem])
    useEffect(() => {
        if (error) {
            let cleanError = error
            if (typeof error === 'string') {
                if (error.includes('duplicate key value violates unique constraint')) {
                    if (error.includes('mixers_truck_number_key')) {
                        cleanError = 'This truck number already exists. Please use a different truck number.'
                    } else if (error.includes('tractors_truck_number_key')) {
                        cleanError = 'This truck number already exists. Please use a different truck number.'
                    } else if (error.includes('trailers_trailer_number_key')) {
                        cleanError = 'This trailer number already exists. Please use a different trailer number.'
                    } else if (error.includes('pickup_trucks_truck_number_key')) {
                        cleanError = 'This truck number already exists. Please use a different truck number.'
                    } else if (error.includes('equipment_equipment_number_key')) {
                        cleanError = 'This equipment number already exists. Please use a different equipment number.'
                    } else {
                        cleanError = 'This item already exists. Please use a different identifier.'
                    }
                }
            }
            setInternalError(cleanError)
        } else {
            setInternalError(null)
        }
    }, [error])
    if (typeof document === 'undefined' || !document.body) {
        return null
    }
    if (hasPermission === null) {
        return null
    }
    if (!hasPermission) {
        return (
            <Dialog open onClose={handleClose} size="md" title={title} zClassName="z-panel">
                <div
                    ref={anchorRef}
                    className="flex min-h-[160px] flex-col items-center justify-center gap-1 text-center"
                >
                    <p className="m-0 text-[15px] font-medium text-text-primary">You can’t add assets or items</p>
                    <p className="m-0 text-[13px] text-text-secondary">Ask your RMI or District Manager for access.</p>
                </div>
            </Dialog>
        )
    }
    return (
        <Dialog open onClose={handleClose} size="lg" title={title} zClassName="z-panel" bodyClassName="p-0">
            <AddViewBody
                anchorRef={anchorRef}
                error={internalError}
                onDismissError={() => setInternalError(null)}
                opener={opener}
            >
                {children}
            </AddViewBody>
        </Dialog>
    )
}
export default AddViewSection
