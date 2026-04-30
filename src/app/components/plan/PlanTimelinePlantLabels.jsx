import React from 'react'

import { LABEL_WIDTH } from '../../../utils/PlanUtility'
import { PlanTimelineLaneBlock } from './PlanTimelineLaneBlock'

const { ROW_HEIGHT, RECV_COLOR, SENT_COLOR } = PlanTimelineLaneBlock

/**
 * Sticky-left column showing the plant code, mixer count badge, and
 * sent/received summary chips. Heights stay aligned with the day-column
 * lane areas because both use the same `laneCount * ROW_HEIGHT` value.
 */
export function PlanTimelinePlantLabels({ accentColor, mixerCountsByPlant, plantRows }) {
    return (
        <div className="shrink-0 sticky left-0 z-20" style={{ background: 'var(--bg-primary)', width: LABEL_WIDTH }}>
            <CornerCell />
            {plantRows.map((plantRow, prIdx) => (
                <PlantLabelRow
                    key={plantRow.plant}
                    accentColor={accentColor}
                    mixerCount={mixerCountsByPlant[plantRow.plant] || 0}
                    plantRow={plantRow}
                    prIdx={prIdx}
                />
            ))}
        </div>
    )
}

function CornerCell() {
    return (
        <div
            className="sticky top-0 z-30 flex items-center px-3 text-[10px] font-bold uppercase tracking-wider border-b border-r"
            style={{
                background: 'var(--bg-tertiary)',
                borderColor: 'var(--border-light)',
                color: 'var(--text-secondary)',
                height: 32
            }}
        >
            Plant
        </div>
    )
}

function PlantLabelRow({ accentColor, mixerCount, plantRow, prIdx }) {
    return (
        <div
            className="flex flex-col justify-center px-3 border-b border-r"
            style={{
                background: prIdx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                borderBottomWidth: 2,
                borderColor: 'var(--border-light)',
                height: ROW_HEIGHT * plantRow.laneCount
            }}
        >
            <div className="flex items-center gap-1.5">
                <i className="fas fa-industry text-[9px]" style={{ color: accentColor }} />
                <span className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color: accentColor }}>
                    {plantRow.plant}
                </span>
                {mixerCount > 0 && (
                    <span
                        className="text-[9px] font-semibold rounded-full px-1.5 py-px"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                    >
                        {mixerCount}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
                {plantRow.sentCount > 0 && (
                    <CountChip color={SENT_COLOR} count={plantRow.sentCount} icon="fa-arrow-right-from-bracket" />
                )}
                {plantRow.recvCount > 0 && (
                    <CountChip color={RECV_COLOR} count={plantRow.recvCount} icon="fa-arrow-right-to-bracket" />
                )}
            </div>
        </div>
    )
}

function CountChip({ color, count, icon }) {
    return (
        <span
            className="flex items-center gap-0.5 text-[9px] font-bold rounded px-1 py-px"
            style={{ background: `${color}15`, color }}
        >
            <i className={`fas ${icon} text-[7px]`} />
            {count}
        </span>
    )
}
