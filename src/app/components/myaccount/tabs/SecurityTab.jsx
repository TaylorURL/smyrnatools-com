import React from 'react'

import { formatSessionTime } from '../../../constants/myAccountConstants'
import { Card, CardHeader, PrimaryButton, SubtleButton } from '../MyAccountAtoms'

/** Security tab body — password change trigger card + active sessions list
 *  with per-row revoke (current session is non-revokable). */
export default function SecurityTab({ accentColor, onOpenPasswordModal, onRevokeSession, sessions }) {
    return (
        <>
            <section id="password" className="scroll-mt-4">
                <Card>
                    <CardHeader
                        accentColor={accentColor}
                        icon="fa-key"
                        title="Password"
                        description="Keep your account secure with a strong password"
                    />
                    <div className="px-5 py-5">
                        <PrimaryButton accentColor={accentColor} icon="fa-lock" onClick={onOpenPasswordModal}>
                            Change Password
                        </PrimaryButton>
                    </div>
                </Card>
            </section>

            <section id="sessions" className="scroll-mt-4">
                <Card>
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-border-light">
                        <div
                            className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0 bg-bg-tertiary"
                            style={{ color: accentColor }}
                        >
                            <i className="fas fa-laptop text-[16px]" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-semibold text-text-primary">Active Sessions</div>
                            <div className="text-[12px] mt-0.5 text-text-tertiary">Manage your login sessions</div>
                        </div>
                        <span className="font-mono tabular-nums rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider bg-bg-tertiary text-text-secondary">
                            {sessions.length}
                        </span>
                    </div>
                    <div>
                        {sessions.length > 0 ? (
                            sessions.map((session, idx) => (
                                <div
                                    key={session.id}
                                    className="flex items-center justify-between gap-3 px-5 py-3.5"
                                    style={{
                                        background: session.isCurrent ? 'rgba(22, 163, 74, 0.08)' : 'transparent',
                                        borderBottom:
                                            idx < sessions.length - 1 ? '1px solid var(--border-light)' : 'none'
                                    }}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div
                                            className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
                                            style={{
                                                background: session.isCurrent
                                                    ? 'rgba(22, 163, 74, 0.15)'
                                                    : 'var(--bg-tertiary)',
                                                color: 'var(--text-primary)'
                                            }}
                                        >
                                            <i
                                                className={`fas ${session.device === 'Mobile' ? 'fa-mobile-alt' : session.device === 'Tablet' ? 'fa-tablet-alt' : 'fa-desktop'} text-[14px]`}
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[14px] font-semibold truncate text-text-primary">
                                                    {session.browser}
                                                </span>
                                                {session.isCurrent && (
                                                    <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[rgba(22,_163,_74,_0.15)] text-text-primary">
                                                        Current
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[12px] mt-0.5 font-mono tabular-nums text-text-tertiary">
                                                {session.os} · {session.device} ·{' '}
                                                {formatSessionTime(session.lastActive)}
                                            </div>
                                        </div>
                                    </div>
                                    {!session.isCurrent && (
                                        <SubtleButton danger onClick={() => onRevokeSession(session.id)}>
                                            Revoke
                                        </SubtleButton>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
                                <i className="fas fa-laptop text-3xl mb-3" />
                                <span className="text-[14px]">No active sessions found</span>
                            </div>
                        )}
                    </div>
                </Card>
            </section>
        </>
    )
}
