/* eslint-disable react/forbid-dom-props */
import React from 'react'

import Badge from '../../common/Badge'
import { CrmPanel as Panel } from '../CrmSection'
import { InteractionTimeline } from './InteractionTimeline'
import { LogInteractionComposer } from './LogInteractionComposer'

const LIFECYCLE_TONE = { customer: 'success', lost: 'neutral', prospect: 'accent' }

/**
 * Account "CRM record" body, built on the same flat, panel-framed, mono-numeral
 * language as DashboardView / CrmMyDeskPage so it reads as part of the site.
 *
 * Layout: a top bar (back button top-left for the inline detail, or a top-right
 * close for the drawer) + identity + tap-to-call, then a full-width activity
 * snapshot strip, then a two-column body — left rail (profile / contacts) and a
 * main column of `Panel` sections (log composer, history, opportunities, plus
 * any caller-supplied `mainExtraSlot`).
 *
 * Two consumers share this shell: `CrmCustomerDetail` (inline, page-scroll) and
 * `AccountDetailDrawer` (slide-over, self-scroll via `fillHeight`).
 *
 * @param {object}   [account]             - Raw account object (name/stage/phone fallback for the drawer).
 * @param {string}   accentColor           - Accent CSS color for the log composer.
 * @param {string}   [closeIcon]           - 'back' | 'xmark' — dismiss affordance style + position.
 * @param {string}   [closeLabel]          - Accessible label for the dismiss control.
 * @param {object}   [contactsSlot]        - React node for the left-rail Contacts panel.
 * @param {string}   [customerName]        - Display name (inline detail path).
 * @param {boolean}  [fillHeight]          - When true, owns its own height + scroll (drawer). Otherwise flows in the page.
 * @param {Array}    interactions          - Interaction records for the timeline.
 * @param {boolean}  [isSavingInteraction] - Passed to LogInteractionComposer.
 * @param {string}   [lifecycleStage]      - Lifecycle stage for the identity badge.
 * @param {object}   [mainExtraSlot]       - Extra main-column React node (e.g. service history + team call log).
 * @param {() => void} onClose             - Dismiss / back handler.
 * @param {(payload) => void} onLogInteraction - Submits a new CRM interaction.
 * @param {object}   [opportunitiesSlot]   - React node for the Opportunities panel.
 * @param {object}   [presenceBannerSlot]  - CustomerPresenceBanner node.
 * @param {string}   [primaryPhone]        - Formatted phone for the tap-to-call link.
 * @param {string}   [primaryPhoneHref]    - Digits-only href for the tel: link.
 * @param {object}   [quickStatsSlot]      - Full-width activity-snapshot StatGroup (inline detail only).
 */
export function AccountDetailBody({
    account,
    accentColor,
    closeIcon = 'back',
    closeLabel = 'Back to list',
    contactsSlot,
    customerName,
    fillHeight = false,
    interactions = [],
    isSavingInteraction = false,
    lifecycleStage,
    mainExtraSlot,
    onArchive,
    onClose,
    onLogInteraction,
    opportunitiesSlot,
    presenceBannerSlot,
    primaryPhone,
    primaryPhoneHref,
    quickStatsSlot
}) {
    const displayName = customerName || account?.name || '—'
    const stage = lifecycleStage || account?.lifecycle_stage
    const phone = primaryPhone || account?.phone
    const phoneHref = primaryPhoneHref || (phone ? `tel:${phone}` : null)
    const isBack = closeIcon !== 'xmark'

    return (
        <div className={`flex flex-col bg-bg-secondary ${fillHeight ? 'min-h-0 flex-1' : ''}`}>
            {/* ── Top bar ──────────────────────────────────────────────────── */}
            <div className="flex shrink-0 flex-col gap-2.5 border-b border-border-light bg-bg-secondary px-4 pb-3 pt-3">
                {/* Back button — TOP LEFT (inline detail). The drawer variant
                    instead carries a top-right close on the identity row.
                    Archive (prospects only) sits opposite, top-right of this row. */}
                {(isBack || onArchive) && (
                    <div className="flex items-center justify-between gap-2">
                        {isBack ? (
                            <button type="button"
                                aria-label={closeLabel}
                                onClick={onClose}
                                className="-ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold text-text-secondary hover:bg-bg-hover hover:text-text-primary active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
                            >
                                <i className="fas fa-arrow-left text-[10px]" aria-hidden="true" />
                                {closeLabel}
                            </button>
                        ) : (
                            <span aria-hidden="true" />
                        )}
                        {onArchive && (
                            <button type="button"
                                onClick={onArchive}
                                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold border border-border-light bg-bg-primary text-text-secondary cursor-pointer hover:border-status-danger/40 hover:text-status-danger active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
                            >
                                <i className="fas fa-box-archive text-[10px]" aria-hidden="true" />
                                Archive
                            </button>
                        )}
                    </div>
                )}

                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <h2
                            className="truncate font-heading text-[17px] font-bold leading-tight text-text-primary"
                            title={displayName}
                        >
                            {displayName}
                        </h2>
                        {stage && (
                            <Badge tone={LIFECYCLE_TONE[stage] ?? 'neutral'} size="xs" className="self-start">
                                {stage}
                            </Badge>
                        )}
                    </div>

                    {/* Tap-to-call — primary phone surfaced as a quick action */}
                    {phoneHref && phone && (
                        <a
                            href={phoneHref}
                            aria-label={`Call ${phone}`}
                            className="shrink-0 inline-flex items-center gap-1.5 min-h-[40px] rounded-md border border-border-light bg-bg-primary px-3 text-[13px] font-mono font-semibold tabular-nums text-text-primary hover:border-border-medium hover:bg-bg-hover active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
                        >
                            <i className="fas fa-phone text-[11px] text-text-tertiary" aria-hidden="true" />
                            {phone}
                        </a>
                    )}

                    {!isBack && (
                        <button type="button"
                            aria-label={closeLabel}
                            onClick={onClose}
                            className="mt-0.5 shrink-0 min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-md text-text-tertiary hover:bg-bg-hover hover:text-text-primary active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
                        >
                            <i className="fas fa-xmark text-[15px]" aria-hidden="true" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Body ─────────────────────────────────────────────────────── */}
            <div className={fillHeight ? 'flex-1 overflow-y-auto' : ''}>
                <div className="flex flex-col gap-4 px-4 py-4">
                    {presenceBannerSlot && <div>{presenceBannerSlot}</div>}

                    {/* Activity snapshot — full-width KPI strip (inline detail) */}
                    {quickStatsSlot}

                    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                        {/* LEFT RAIL: profile */}
                        <aside className="flex flex-col gap-4 min-w-0">
                            <Panel title="Contacts">
                                {contactsSlot ?? (
                                    <p className="text-[12px] text-text-tertiary">No contacts on file yet.</p>
                                )}
                            </Panel>
                        </aside>

                        {/* MAIN COLUMN: activity */}
                        <main className="flex flex-col gap-4 min-w-0">
                            <Panel title="Log interaction">
                                <LogInteractionComposer
                                    accentColor={accentColor}
                                    defaultLens="general"
                                    isSaving={isSavingInteraction}
                                    onSubmit={(payload) => onLogInteraction?.(payload)}
                                />
                            </Panel>

                            <Panel title="History" innerClassName="p-0 overflow-hidden">
                                <InteractionTimeline interactions={interactions} />
                            </Panel>

                            <Panel title="Opportunities">
                                {opportunitiesSlot ?? (
                                    <p className="text-[12px] text-text-tertiary">No opportunities yet.</p>
                                )}
                            </Panel>

                            {mainExtraSlot}
                        </main>
                    </div>
                </div>
            </div>
        </div>
    )
}
