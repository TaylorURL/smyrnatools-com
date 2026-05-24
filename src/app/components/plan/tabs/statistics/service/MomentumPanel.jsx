import React from 'react'

import { fmtInt } from '../../../../../../utils/PlanStatisticsFormatUtility'
import { Panel, Stat, StatGroup } from '../../../../ui/Panel'
import { EmptySection } from '../PlanStatisticsPages'
import ScorePercent from '../ScorePercent'

/** 7-day momentum panel — recent week's good-service rate vs the prior
 *  week's. Lifted from the old Customer Satisfaction page so the Service
 *  surface owns the "is service trending?" answer. */
export default function MomentumPanel({ loading, momentum }) {
    if (loading && !momentum) {
        return (
            <Panel title="7-day momentum" innerClassName="p-0">
                <EmptySection loading message="Computing trailing 7-day windows…" />
            </Panel>
        )
    }
    if (!momentum) {
        return (
            <Panel title="7-day momentum" innerClassName="p-0">
                <EmptySection
                    icon="fa-circle-info"
                    message="Need at least 14 days of ticket data to compute momentum."
                />
            </Panel>
        )
    }
    const trajLabel =
        momentum.trajectory === 'improving' ? 'Improving' : momentum.trajectory === 'declining' ? 'Declining' : 'Stable'
    // momentum.recent.score / prior.score arrive as 0–100 percentages;
    // divide by 100 to plug into the 0–1 star-rating helper.
    const recentPct = momentum.recent.score == null ? null : momentum.recent.score / 100
    const priorPct = momentum.prior.score == null ? null : momentum.prior.score / 100
    return (
        <Panel title="7-day momentum" innerClassName="p-0">
            <StatGroup columns={3}>
                <Stat
                    label="Last 7 days"
                    value={<ScorePercent value={recentPct} />}
                    hint={`${fmtInt(momentum.recent.samples)} order${momentum.recent.samples === 1 ? '' : 's'}`}
                />
                <Stat
                    label="Previous 7 days"
                    value={<ScorePercent value={priorPct} />}
                    hint={`${fmtInt(momentum.prior.samples)} order${momentum.prior.samples === 1 ? '' : 's'}`}
                />
                <Stat
                    label="Trajectory"
                    value={trajLabel}
                    hint={
                        momentum.delta == null
                            ? 'Need both windows scored'
                            : `${momentum.delta >= 0 ? '+' : ''}${momentum.delta}pp delta`
                    }
                />
            </StatGroup>
        </Panel>
    )
}
