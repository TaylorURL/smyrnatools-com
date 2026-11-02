import React, { useCallback, useEffect, useId, useRef } from 'react'

import Dialog, { DIALOG_INPUT, DialogField } from '../ui/Dialog'

/** Modal that captures the current password + new password + confirm and
 *  submits them to the orchestrator's `onSubmit`. Validation lives in the
 *  parent so the modal can stay presentational. */
export default function PasswordModal({
    confirmPassword,
    currentPassword,
    loading,
    newPassword,
    onClose,
    onSubmit,
    passwordError,
    setConfirmPassword,
    setCurrentPassword,
    setNewPassword
}) {
    const formId = useId()
    const currentId = useId()
    const newId = useId()
    const confirmId = useId()

    // The fields are controlled from the parent, so every keystroke hands
    // this a fresh `onClose`. The dialog re-runs its focus handling whenever
    // that identity changes, so it gets one stable close that always calls
    // the latest prop.
    const onCloseRef = useRef(onClose)
    useEffect(() => {
        onCloseRef.current = onClose
    })
    const handleClose = useCallback(() => onCloseRef.current?.(), [])

    const canSubmit =
        !loading && currentPassword && newPassword && newPassword === confirmPassword && newPassword.length >= 8
    return (
        <Dialog
            open
            onClose={handleClose}
            size="sm"
            title="Change password"
            description="You'll be signed out and asked to sign in again with the new password."
            footer={
                <>
                    <button type="button" onClick={handleClose} className="btn-secondary">
                        Cancel
                    </button>
                    <button type="submit" form={formId} disabled={!canSubmit} className="btn-primary">
                        {loading && <i className="fas fa-spinner fa-spin text-[12px]" aria-hidden="true" />}
                        {loading ? 'Updating…' : 'Update password'}
                    </button>
                </>
            }
        >
            <form id={formId} onSubmit={onSubmit} className="flex flex-col gap-4">
                {passwordError && (
                    <div
                        role="alert"
                        aria-live="assertive"
                        className="rounded-[4px] border border-[color:var(--notice-danger-border)] bg-[color:var(--notice-danger-bg)] px-3 py-2 text-[13px] text-[color:var(--notice-danger-strong)]"
                    >
                        {passwordError}
                    </div>
                )}
                <DialogField label="Current password" htmlFor={currentId}>
                    <input
                        id={currentId}
                        type="password"
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        data-autofocus
                        className={DIALOG_INPUT}
                    />
                </DialogField>
                <DialogField label="New password" htmlFor={newId} hint="At least 8 characters.">
                    <input
                        id={newId}
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        className={DIALOG_INPUT}
                    />
                </DialogField>
                <DialogField label="Confirm new password" htmlFor={confirmId}>
                    <input
                        id={confirmId}
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className={DIALOG_INPUT}
                    />
                </DialogField>
            </form>
        </Dialog>
    )
}
