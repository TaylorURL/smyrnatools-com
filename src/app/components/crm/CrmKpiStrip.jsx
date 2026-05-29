/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { Stat } from '../ui/Panel'
import { CrmStatGroup as StatGroup } from './CrmSection'

/** Inline shimmer block for a KPI label/value while metrics load — matches
 *  DashboardSkeleton (animate-pulse rounded-md bg-bg-tertiary). */
function KpiShimmer({ h = '14px', w = '40px' }) {
    return (
        <span
            className="inline-block rounded-md bg-bg-tertiary animate-pulse motion-reduce:animate-none align-middle"
            style={{ height: h, width: w }}
            aria-hidden="true"
        />
    )
}

/**
 * Full-width region/team KPI strip — the persistent CRM metrics bar that sits
 * above the section nav + content, mirroring the Plan Statistics page's top
 * KPI strip. While loading, BOTH the label and value render as shimmer so
 * neither titles nor figures appear until data lands.
 *
 * @param {{ label: string, value: React.ReactNode }[]} kpis
 * @param {boolean} isLoading
 */
export function CrmKpiStrip({ isLoading, kpis }) {
    return (
        <StatGroup columns={7}>
            {kpis.map((kpi) => (
                <Stat
                    key={kpi.label}
                    label={isLoading ? <KpiShimmer h="9px" w="58px" /> : kpi.label}
                    value={isLoading ? <KpiShimmer h="16px" w="34px" /> : kpi.value}
                />
            ))}
        </StatGroup>
    )
}

export default CrmKpiStrip
