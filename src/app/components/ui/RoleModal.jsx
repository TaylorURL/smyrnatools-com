import React, { createContext, useCallback, useContext, useEffect, useId, useRef } from 'react'

import Dialog, { DIALOG_INPUT, DialogField } from './Dialog'

/** Older callers sized the panel with a Tailwind max width; map those onto
 *  the dialog's sizes. */
const SIZE_FOR_MAX_WIDTH = {
    'max-w-2xl': 'lg',
    'max-w-3xl': 'lg',
    'max-w-4xl': 'xl',
    'max-w-lg': 'md',
    'max-w-md': 'md',
    'max-w-sm': 'sm',
    'max-w-xl': 'lg'
}

/** Lets a `RoleFormField` label point at the `RoleTextInput` inside it. */
const FieldIdContext = createContext(undefined)

/**
 * Shell for the role admin popups, on the shared `Dialog`. Callers compose it
 * from `RoleModalBody` and `RoleModalFooter` as before; the footer is lifted
 * out of the children into the dialog's footer bar so it stays put while
 * the body scrolls. `toolbar` and `bodyClassName` pass through for a popup
 * whose body is a ruled list.
 */
function RoleModal({
    bodyClassName,
    children,
    eyebrow,
    isOpen,
    maxWidth = 'max-w-md',
    onClose,
    size,
    subtitle,
    title,
    toolbar
}) {
    // Callers pass an inline close; keep the dialog's `onClose` identity
    // stable so a re-render doesn't re-run its focus handling.
    const onCloseRef = useRef(onClose)
    useEffect(() => {
        onCloseRef.current = onClose
    })
    const handleClose = useCallback(() => onCloseRef.current?.(), [])

    const parts = React.Children.toArray(children)
    const footer = parts.filter((child) => child?.type === RoleModalFooter)
    const body = parts.filter((child) => child?.type !== RoleModalFooter)

    return (
        <Dialog
            open={Boolean(isOpen)}
            onClose={handleClose}
            size={size || SIZE_FOR_MAX_WIDTH[maxWidth] || 'md'}
            eyebrow={eyebrow}
            title={title}
            description={subtitle}
            toolbar={toolbar}
            bodyClassName={bodyClassName}
            footer={footer.length > 0 ? footer : undefined}
            zClassName="z-app-state"
        >
            {body}
        </Dialog>
    )
}

export function RoleModalBody({ children }) {
    return <div className="flex flex-col gap-4">{children}</div>
}

/** Cancel, then the one primary action. Rendered into the dialog's footer
 *  bar by `RoleModal`. */
export function RoleModalFooter({ disabled, isLoading, loadingText, onCancel, onSubmit, submitIcon, submitText }) {
    return (
        <>
            <button className="btn-secondary" disabled={isLoading} onClick={onCancel} type="button">
                Cancel
            </button>
            <button className="btn-primary" disabled={disabled || isLoading} onClick={onSubmit} type="button">
                {isLoading ? (
                    <>
                        <i className="fas fa-spinner fa-spin text-[12px]" aria-hidden="true" />
                        {loadingText}
                    </>
                ) : (
                    <>
                        {submitIcon && <i className={`${submitIcon} text-[12px]`} aria-hidden="true" />}
                        {submitText}
                    </>
                )}
            </button>
        </>
    )
}

export function RoleFormField({ children, hint, label, sublabel }) {
    const id = useId()
    return (
        <FieldIdContext.Provider value={id}>
            <DialogField
                htmlFor={id}
                hint={hint}
                label={
                    <>
                        {label}
                        {sublabel && <span className="ml-1 font-normal text-text-tertiary">{sublabel}</span>}
                    </>
                }
            >
                {children}
            </DialogField>
        </FieldIdContext.Provider>
    )
}

/** The one text field every role modal uses. `autoFocus` marks it as the
 *  field the dialog puts the caret in when it opens. */
export function RoleTextInput({ autoFocus = false, disabled, onChange, placeholder, type = 'text', value }) {
    const id = useContext(FieldIdContext)
    return (
        <input
            id={id}
            data-autofocus={autoFocus || undefined}
            className={DIALOG_INPUT}
            disabled={disabled}
            onChange={(event) =>
                !disabled && onChange(type === 'number' ? parseInt(event.target.value, 10) || 0 : event.target.value)
            }
            placeholder={placeholder}
            type={type}
            value={value}
        />
    )
}

export default RoleModal
