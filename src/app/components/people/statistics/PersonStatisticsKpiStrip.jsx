import React from 'react'

import { fmtFloat, fmtInt } from '../../../../utils/PlanStatisticsFormatUtility'
import { Stat, StatGroup } from '../../ui/Panel'

/** Compact KPI strip — five tiles tailored to whether we're rendering
 *  operators or managers. Avg rating + trainer count surface for operators;
 *  manager strip swaps to login recency + missing data signals. */
export function PersonStatisticsKpiStrip({ kind, summary }) {
    const isOperators = kind === 'operators'

    const tiles = [
        {
            hint: `${fmtInt(summary.activeCount)} active`,
            label: isOperators ? 'Operators' : 'Managers',
            value: fmtInt(summary.total)
        },
        {
            hint: 'have at least one person',
            label: 'Plants Represented',
            value: fmtInt(summary.plantsRepresented)
        },
        {
            hint: 'plant field blank',
            label: 'Missing Plant',
            value: fmtInt(summary.missingPlant)
        }
    ]

    if (isOperators) {
        tiles.push({
            hint: summary.ratingSamples > 0 ? `${fmtInt(summary.ratingSamples)} rated` : 'no ratings',
            label: 'Avg Rating',
            value: summary.avgRating != null ? `${fmtFloat(summary.avgRating)} Stars` : '—'
        })
        tiles.push({
            hint: summary.trainerCount > 0 ? 'flagged as trainer' : 'no trainers',
            label: 'Trainers',
            value: fmtInt(summary.trainerCount)
        })
    } else {
        tiles.push({
            hint: summary.avgLastLoginDays != null ? `${fmtInt(summary.avgLastLoginDays)} d avg` : 'no recent logins',
            label: 'Login Recency',
            value: summary.avgLastLoginDays != null ? `${fmtInt(summary.avgLastLoginDays)} d` : '—'
        })
        tiles.push({
            hint: 'have never logged in',
            label: 'Never Logged In',
            value: fmtInt(summary.neverLoggedIn)
        })
    }

    return (
        <StatGroup columns={5}>
            {tiles.slice(0, 5).map((tile) => (
                <Stat key={tile.label} hint={tile.hint} label={tile.label} value={tile.value} />
            ))}
        </StatGroup>
    )
}

export default PersonStatisticsKpiStrip
