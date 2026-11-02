import React from 'react'

import { Card, CardHeader, PrimaryButton, Toggle } from '../MyAccountAtoms'

/** Notifications tab body — inbox summary (unread + total + open button) and
 *  per-channel email notification toggles. */
export default function NotificationsTab({
    accentColor,
    conversations = [],
    onOpenMessages,
    preferences,
    unreadMessageCount = 0,
    updatePreferences
}) {
    const conversationCount = conversations?.length || 0
    return (
        <>
            {onOpenMessages && (
                <section id="messages" className="scroll-mt-4">
                    <Card>
                        <CardHeader title="Messages" description="Direct messages with teammates and managers" />
                        <div className="px-5 py-5 flex flex-col gap-4">
                            <div className="flex items-center gap-6 flex-wrap">
                                <div className="flex flex-col">
                                    <span className="text-[12px] text-text-secondary">Unread</span>
                                    <span
                                        className="font-heading tabular-nums text-[24px] font-semibold leading-tight"
                                        style={{
                                            color:
                                                unreadMessageCount > 0 ? 'var(--status-danger)' : 'var(--text-primary)'
                                        }}
                                    >
                                        {unreadMessageCount}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[12px] text-text-secondary">Conversations</span>
                                    <span className="font-heading tabular-nums text-[24px] font-semibold leading-tight text-text-primary">
                                        {conversationCount}
                                    </span>
                                </div>
                                <div className="flex-1" />
                                <PrimaryButton icon="fa-inbox" onClick={() => onOpenMessages()}>
                                    Open inbox
                                </PrimaryButton>
                            </div>
                            {conversationCount === 0 && (
                                <p className="m-0 text-[12.5px] text-text-tertiary">
                                    Nothing here yet. New messages from teammates will land in your inbox.
                                </p>
                            )}
                        </div>
                    </Card>
                </section>
            )}

            <section id="notifications" className="scroll-mt-4">
                <Card>
                    <CardHeader
                        title="Email notifications"
                        description="Control which email notifications you receive"
                    />
                    <div className="px-5 py-5">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <span className="text-[14px] font-medium text-text-primary">Asset comment emails</span>
                                <p className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">
                                    Receive an email when someone comments on an asset assigned to your plant. Applies
                                    to Plant Managers and District Managers only.
                                </p>
                            </div>
                            <Toggle
                                accentColor={accentColor}
                                ariaLabel="Toggle asset comment email notifications"
                                checked={!!preferences.acceptCommentEmails}
                                onChange={() =>
                                    updatePreferences('acceptCommentEmails', !preferences.acceptCommentEmails)
                                }
                            />
                        </div>
                    </div>
                </Card>
            </section>
        </>
    )
}
