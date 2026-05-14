import React from 'react'

import { FIELD_LABEL_CLASS, FieldStyle } from '../../constants/myAccountConstants'
import { SubtleButton } from './MyAccountAtoms'

/** Modal that captures the current password + new password + confirm and
 *  submits them to the orchestrator's `onSubmit`. Validation lives in the
 *  parent so the modal can stay presentational. */
export default function PasswordModal({
    accentColor,
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
    const canSubmit =
        !loading && currentPassword && newPassword && newPassword === confirmPassword && newPassword.length >= 8
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(15,_23,_42,_0.65)]"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg rounded-lg overflow-hidden bg-bg-primary border border-border-light"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-light">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-tertiary"
                            style={{ color: accentColor }}
                        >
                            <i className="fas fa-key text-[16px]" />
                        </div>
                        <span className="text-[16px] font-semibold text-text-primary">Change Password</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-bg-tertiary text-text-secondary"
                        aria-label="Close"
                    >
                        <i className="fas fa-times text-[14px]" />
                    </button>
                </div>
                <form onSubmit={onSubmit} className="px-5 py-5 flex flex-col gap-4">
                    {passwordError && (
                        <div className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium bg-[rgba(220,_38,_38,_0.12)] border border-[rgba(220,_38,_38,_0.35)] text-red-600">
                            <i className="fas fa-exclamation-circle text-[13px]" />
                            <span>{passwordError}</span>
                        </div>
                    )}
                    <div>
                        <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            Current Password
                        </label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                            required
                            className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none"
                            style={FieldStyle}
                        />
                    </div>
                    <div>
                        <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            New Password
                        </label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                            required
                            className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none"
                            style={FieldStyle}
                        />
                        <p className="mt-1.5 text-[11.5px] text-text-tertiary">Must be at least 8 characters</p>
                    </div>
                    <div>
                        <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            required
                            className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none"
                            style={FieldStyle}
                        />
                    </div>
                    <div className="flex gap-3 mt-1">
                        <SubtleButton onClick={onClose}>Cancel</SubtleButton>
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="flex-1 rounded-lg py-2.5 text-[12px] font-semibold uppercase tracking-wider text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: accentColor }}
                        >
                            Update Password
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
