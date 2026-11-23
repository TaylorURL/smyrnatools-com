import React from 'react'

import DetailViewSection from '../../../../app/components/sections/DetailViewSection'
import { PASSWORD_REQUIREMENT } from '../../../../utils/ValidationUtility'

const PASSWORD_ERROR_ID = 'manager-password-error'

/**
 * Sets a new password for the manager, in place rather than through a modal.
 * There is no permission check here: ManagerDetailView decides whether to
 * mount it at all.
 *
 * The requirement is stated beside the field rather than left to be learned
 * from a refusal, and `passwordError` carries the field-level message for a
 * password the rule turns down.
 */
export default function ManagerSecuritySection({
    showPasswordField,
    onShowPasswordField,
    password,
    onPasswordChange,
    onCancelPasswordChange,
    passwordError
}) {
    return (
        <DetailViewSection.Section id="security" title="Security" icon="fas fa-shield-alt">
            <DetailViewSection.Card title="Password Management" icon="fas fa-key">
                {!showPasswordField ? (
                    <div className="flex flex-col gap-1.5">
                        <label>Password</label>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="text-text-secondary text-sm">••••••••</span>
                            <button
                                type="button"
                                className="flex items-center gap-2 rounded-card border border-border-light bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-hover"
                                onClick={onShowPasswordField}
                            >
                                <i className="fas fa-key"></i> Change Password
                            </button>
                        </div>
                        <p className="text-text-secondary text-[13px] mt-2 mb-0">
                            Click &quot;Change Password&quot; to set a new password for this manager.
                        </p>
                    </div>
                ) : (
                    <div className="form-group">
                        <label htmlFor="manager-new-password">New Password</label>
                        <input
                            id="manager-new-password"
                            type="password"
                            value={password}
                            onChange={(e) => onPasswordChange(e.target.value)}
                            placeholder="Enter new password"
                            className="form-control"
                            autoFocus
                            {...(passwordError ? { 'aria-describedby': PASSWORD_ERROR_ID, 'aria-invalid': true } : {})}
                        />
                        {passwordError && (
                            <p id={PASSWORD_ERROR_ID} role="alert" className="text-status-danger text-[13px] mt-2 mb-0">
                                {passwordError}
                            </p>
                        )}
                        <p className="text-text-secondary text-[13px] mt-2 mb-3">{PASSWORD_REQUIREMENT}</p>
                        <button
                            type="button"
                            className="flex items-center gap-2 rounded-card border border-border-light bg-bg-primary px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-bg-hover"
                            onClick={onCancelPasswordChange}
                        >
                            <i className="fas fa-times"></i> Cancel
                        </button>
                    </div>
                )}
            </DetailViewSection.Card>
        </DetailViewSection.Section>
    )
}
