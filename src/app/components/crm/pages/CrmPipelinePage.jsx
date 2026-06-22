/* eslint-disable react/forbid-dom-props */
import React, { useMemo, useState } from 'react'

import { useCrmViewMode } from '../../../hooks/useCrmViewMode'
import { useOpportunities } from '../../../hooks/useOpportunities'
import Badge from '../../common/Badge'
import { CrmTable } from '../CrmTable'
import { CrmViewToggle } from '../CrmViewToggle'
import { AccountDetailDrawer } from '../customer-card/AccountDetailDrawer'
import { formatRelativeShort } from './activity/activityShared'

/** Ordered pipeline stages used for column rendering. */
const PIPELINE_STAGES = [
    { id: 'new', label: 'New' },
    { id: 'contacted', label: 'Contacted' },
    { id: 'quoted', label: 'Quoted' },
    { id: 'won', label: 'Won' },
    { id: 'lost', label: 'Lost' }
]

/** Tone map for stage badges. */
const STAGE_TONE = { contacted: 'info', lost: 'danger', new: 'neutral', quoted: 'warning', won: 'success' }

/** Horizontal pipeline board — one column per stage, no drag-and-drop.
 *  Real cards render solid; virtual/suggested cards render dashed with a
 *  "Suggested" chip. Move chips materialize virtual cards at the target stage. */
export function CrmPipelinePage({ accentColor }) {
    const { error, isLoading, materialize, move, opportunities } = useOpportunities({ boardMode: true })
    const [openAccountId, setOpenAccountId] = useState(null)
    const [viewMode, setViewMode] = useCrmViewMode('pipeline', 'list')

    const opportunitiesByStage = useMemo(() => {
        const map = Object.fromEntries(PIPELINE_STAGES.map(({ id }) => [id, []]))
        for (const opp of opportunities) {
            if (map[opp.stage]) map[opp.stage].push(opp)
        }
        return map
    }, [opportunities])

    const pipelineColumns = useMemo(
        () => [
            {
                key: 'title',
                label: 'Opportunity',
                render: (row) => (
                    <span className="flex items-center gap-1.5 font-semibold text-text-primary">
                        {row.title}
                        {row.virtual && (
                            <Badge tone="warning" size="xs">
                                Suggested
                            </Badge>
                        )}
                    </span>
                )
            },
            {
                key: 'account_name',
                label: 'Account',
                render: (row) => row.account_name || <span className="text-text-tertiary">—</span>
            },
            {
                key: 'stage',
                label: 'Stage',
                render: (row) => {
                    const stageLabel = PIPELINE_STAGES.find((s) => s.id === row.stage)?.label || row.stage
                    return (
                        <Badge tone={STAGE_TONE[row.stage] ?? 'neutral'} size="xs">
                            {stageLabel}
                        </Badge>
                    )
                }
            },
            {
                key: 'owner_user_id',
                label: 'Owner',
                render: (row) =>
                    row.owner_user_id ? (
                        <Badge tone="neutral" size="xs">
                            {row.owner_user_id.slice(0, 8)}
                        </Badge>
                    ) : (
                        <span className="text-text-tertiary">—</span>
                    )
            },
            {
                align: 'right',
                key: 'updated_at',
                label: 'Updated',
                mono: true,
                render: (row) =>
                    row.updated_at ? formatRelativeShort(row.updated_at) : <span className="text-text-tertiary">—</span>
            }
        ],
        []
    )

    if (error) {
        return (
            <div className="rounded-md p-6 text-center text-[12.5px] bg-bg-primary border border-border-light text-text-secondary">
                Failed to load pipeline: {error}
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-3 min-w-0">
            <div className="flex justify-end">
                <CrmViewToggle accentColor={accentColor} onChange={setViewMode} value={viewMode} />
            </div>

            {viewMode === 'list' ? (
                <CrmTable
                    columns={pipelineColumns}
                    emptyMessage="No pipeline opportunities yet."
                    onRowClick={(row) => {
                        if (row.account_id) setOpenAccountId(row.account_id)
                    }}
                    rowKey={(row) => row.id}
                    rows={opportunities}
                />
            ) : (
                <div className="flex gap-3 overflow-x-auto pb-1">
                    {PIPELINE_STAGES.map((stage) => (
                        <StageColumn
                            key={stage.id}
                            accentColor={accentColor}
                            isLoading={isLoading}
                            materialize={materialize}
                            onMove={move}
                            onOpenAccount={setOpenAccountId}
                            opportunities={opportunitiesByStage[stage.id]}
                            stage={stage}
                        />
                    ))}
                </div>
            )}

            {openAccountId && (
                <AccountDetailDrawer
                    accountId={openAccountId}
                    accentColor={accentColor}
                    onClose={() => setOpenAccountId(null)}
                />
            )}
        </div>
    )
}

function StageColumn({ accentColor, isLoading, materialize, onMove, onOpenAccount, opportunities, stage }) {
    return (
        <div className="flex flex-col gap-2 min-w-[200px] flex-1">
            <div className="flex items-center gap-2 px-0.5">
                <span className="text-[11px] font-bold uppercase tracking-[.08em] text-text-tertiary">
                    {stage.label}
                </span>
                <span className="text-[11px] tabular-nums text-text-tertiary">({opportunities.length})</span>
            </div>

            {isLoading ? (
                <PipelineColumnSkeleton />
            ) : opportunities.length === 0 ? (
                <div className="rounded-md border border-border-light bg-bg-primary px-3 py-4 text-center text-[12px] text-text-tertiary">
                    —
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {opportunities.map((opp) => (
                        <OpportunityCard
                            key={opp.id}
                            accentColor={accentColor}
                            currentStage={stage.id}
                            materialize={materialize}
                            onMove={onMove}
                            onOpenAccount={onOpenAccount}
                            opportunity={opp}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function OpportunityCard({ currentStage, materialize, onMove, onOpenAccount, opportunity }) {
    const isVirtual = Boolean(opportunity.virtual)
    const isWonVirtual = isVirtual && currentStage === 'won'
    const otherStages = PIPELINE_STAGES.filter((s) => s.id !== currentStage)

    const handleCardOpen = () => {
        if (opportunity.account_id) onOpenAccount(opportunity.account_id)
    }

    const handleCardKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handleCardOpen()
        }
    }

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={`Open ${opportunity.title}`}
            onClick={handleCardOpen}
            onKeyDown={handleCardKeyDown}
            className={[
                'rounded-md px-3 py-2.5 flex flex-col gap-2 cursor-pointer',
                'transition-[border-color,box-shadow] duration-150 ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                'hover:border-border-medium hover:shadow-sm',
                isVirtual
                    ? 'border border-dashed border-border-light bg-bg-primary'
                    : 'border border-border-light bg-bg-primary'
            ].join(' ')}
        >
            <div>
                {isVirtual && (
                    <div className="mb-1">
                        <Badge tone="warning" size="xs">
                            Suggested
                        </Badge>
                    </div>
                )}
                <div className="text-[12.5px] font-semibold text-text-primary leading-snug">{opportunity.title}</div>
                {opportunity.account_name && (
                    <div className="text-[11px] text-text-secondary mt-0.5 truncate">{opportunity.account_name}</div>
                )}
            </div>

            <div className="flex flex-wrap gap-1">
                {isWonVirtual ? (
                    <button type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            materialize(opportunity)
                        }}
                        className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold border border-border-light bg-bg-secondary text-text-secondary cursor-pointer active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:text-text-primary hover:border-border-medium"
                        aria-label="Confirm won"
                    >
                        Confirm won
                    </button>
                ) : (
                    otherStages.map((targetStage) => (
                        <button type="button"
                            key={targetStage.id}
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onMove(opportunity, targetStage.id)
                            }}
                            className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold border border-border-light bg-bg-secondary text-text-secondary cursor-pointer active:scale-[0.97] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none hover:text-text-primary hover:border-border-medium"
                            aria-label={`Move to ${targetStage.label}`}
                        >
                            → {targetStage.label}
                        </button>
                    ))
                )}
            </div>
        </div>
    )
}

function PipelineColumnSkeleton() {
    const SkelBar = ({ className = '' }) => <div className={`rounded animate-pulse bg-bg-tertiary ${className}`} />
    return (
        <div className="flex flex-col gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-md border border-border-light bg-bg-primary p-3 flex flex-col gap-2">
                    <SkelBar className="h-3.5 w-3/4" />
                    <SkelBar className="h-2.5 w-1/2" />
                    <div className="flex gap-1">
                        <SkelBar className="h-5 w-16" />
                        <SkelBar className="h-5 w-16" />
                    </div>
                </div>
            ))}
        </div>
    )
}
