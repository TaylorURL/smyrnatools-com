import React from 'react'

import { fmtInt } from '../../../../../utils/PlanStatisticsFormatUtility'
import { Panel } from '../../../ui/Panel'

/**
 * Roster tables sitting under the hiring pipeline: operators who joined in
 * the last 90 days, plants carrying an active roster with no trainer on it,
 * and applicants who never converted.
 */
export function PersonHiringRosterPanels({ noHireList, plantsMissingTrainers, recentHires }) {
    return (
        <>
            <Panel
                title="Recent Hires (Last 90 Days)"
                innerClassName="p-0"
                right={<span className="text-[11px] text-text-tertiary">{`${recentHires.length} new`}</span>}
            >
                {recentHires.length === 0 ? (
                    <div className="text-[12px] py-4 text-center text-text-tertiary">
                        No new hires within the last 90 days.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[12px] border-collapse">
                            <thead>
                                <tr className="text-text-tertiary">
                                    <th
                                        scope="col"
                                        className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2"
                                    >
                                        Name
                                    </th>
                                    <th
                                        scope="col"
                                        className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                                    >
                                        Plant
                                    </th>
                                    <th
                                        scope="col"
                                        className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                                    >
                                        Position
                                    </th>
                                    <th
                                        scope="col"
                                        className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                                    >
                                        Status
                                    </th>
                                    <th
                                        scope="col"
                                        className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2"
                                    >
                                        Days on Roster
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentHires.map((row) => (
                                    <tr key={row.id} className="border-t border-border-light">
                                        <td className="px-3 py-2 font-semibold text-text-primary">{row.name}</td>
                                        <td className="px-2 py-2 font-mono tabular-nums text-text-secondary">
                                            {row.plant}
                                        </td>
                                        <td className="px-2 py-2 text-text-secondary">{row.position}</td>
                                        <td className="px-2 py-2 text-text-secondary">{row.status}</td>
                                        <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-text-primary">
                                            {fmtInt(row.tenureDays)} d
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>

            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                <Panel
                    title="Plants Missing Trainer Coverage"
                    innerClassName="p-0"
                    right={
                        <span className="text-[11px] text-text-tertiary">
                            {plantsMissingTrainers.length > 0
                                ? `${plantsMissingTrainers.length} plant${plantsMissingTrainers.length === 1 ? '' : 's'}`
                                : 'Coverage complete'}
                        </span>
                    }
                >
                    {plantsMissingTrainers.length === 0 ? (
                        <div className="text-[12px] py-4 text-center text-text-tertiary">
                            Every plant with roster has a trainer.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-[12px] border-collapse">
                                <thead>
                                    <tr className="text-text-tertiary">
                                        <th
                                            scope="col"
                                            className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2"
                                        >
                                            Plant
                                        </th>
                                        <th
                                            scope="col"
                                            className="text-right font-semibold uppercase tracking-wider text-[10px] px-3 py-2"
                                        >
                                            Active Roster
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plantsMissingTrainers.map((row) => (
                                        <tr key={row.code} className="border-t border-border-light">
                                            <td className="px-3 py-2">
                                                <span className="font-mono tabular-nums font-semibold text-text-primary">
                                                    {row.code}
                                                </span>
                                                {row.name !== row.code && (
                                                    <span className="ml-2 text-text-secondary">{row.name}</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold">
                                                {fmtInt(row.active)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>
                <Panel
                    title="Declined / No-Hire"
                    innerClassName="p-0"
                    right={<span className="text-[11px] text-text-tertiary">{`${noHireList.length} on file`}</span>}
                >
                    {noHireList.length === 0 ? (
                        <div className="text-[12px] py-4 text-center text-text-tertiary">
                            No declined applicants on file.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-[12px] border-collapse">
                                <thead>
                                    <tr className="text-text-tertiary">
                                        <th
                                            scope="col"
                                            className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2"
                                        >
                                            Name
                                        </th>
                                        <th
                                            scope="col"
                                            className="text-left font-semibold uppercase tracking-wider text-[10px] px-2 py-2"
                                        >
                                            Plant
                                        </th>
                                        <th
                                            scope="col"
                                            className="text-left font-semibold uppercase tracking-wider text-[10px] px-3 py-2"
                                        >
                                            Position
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {noHireList.map((row) => (
                                        <tr key={row.id} className="border-t border-border-light">
                                            <td className="px-3 py-2 font-semibold text-text-primary">{row.name}</td>
                                            <td className="px-2 py-2 font-mono tabular-nums text-text-secondary">
                                                {row.plant}
                                            </td>
                                            <td className="px-3 py-2 text-text-secondary">{row.position}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>
            </div>
        </>
    )
}
