/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { formatYphValue, GRADE_COLORS, YPH_GRADES } from '../../../constants/plantManagerReportConstants'
import { CARD_STYLE, SECTION_LABEL_CLASS } from '../../../constants/weeklyReportConstants'
import { CardHeader } from './RmiAtoms'

/** Compact text+icon pill used for Plant Manager toolbar actions. */
export function IconChip({ accent = 'var(--text-secondary)', icon, label, onClick, title, type = 'button' }) {
    return (
        <button
            type={type}
            onClick={onClick}
            title={title}
            className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-semibold border-none cursor-pointer disabled:opacity-50 bg-bg-secondary"
            style={{ border: `1px solid var(--border-light)`, color: accent }}
        >
            {icon && <i className={`fas ${icon} text-[10px]`} />}
            {label}
        </button>
    )
}

/** Grade scale — four pills (excellent/good/average/poor) with the active
 *  grade tinted by `GRADE_COLORS`. */
export function GradeScale({ grade }) {
    return (
        <div className="flex gap-1 flex-wrap">
            {YPH_GRADES.map((gradeOption) => {
                const isActive = grade === gradeOption
                return (
                    <span
                        key={gradeOption}
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{
                            background: isActive ? GRADE_COLORS[gradeOption] : 'var(--bg-tertiary)',
                            border: `1px solid ${isActive ? GRADE_COLORS[gradeOption] : 'var(--border-light)'}`,
                            color: isActive ? '#fff' : 'var(--text-tertiary)'
                        }}
                    >
                        {gradeOption.charAt(0).toUpperCase() + gradeOption.slice(1)}
                    </span>
                )
            })}
        </div>
    )
}

/** YPH metric card — raw / adjusted values with grade pill and scale. */
export function YphMetricCard({ grade, label, yph }) {
    const adjustedGrade = grade?.adjusted ?? grade
    const labelText = label?.adjusted ?? label
    const gradeColor = GRADE_COLORS[adjustedGrade] || 'var(--text-secondary)'
    return (
        <div className="rounded p-3 flex flex-col gap-2 bg-bg-secondary border border-border-light">
            <div className="flex items-center gap-1.5">
                <i className="fas fa-tachometer-alt text-[10px] text-text-tertiary" />
                <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                    Yards per man-hour
                </span>
            </div>
            <div
                className="flex items-baseline gap-1.5 font-mono tabular-nums text-text-primary"
                title="Raw / Adjusted (for help sent)"
            >
                <span className="text-[22px] font-bold leading-none">{formatYphValue(yph?.raw ?? yph)}</span>
                <span className="text-[16px] text-text-tertiary">/</span>
                <span className="text-[22px] font-bold leading-none">{formatYphValue(yph?.adjusted ?? yph)}</span>
            </div>
            <div className="flex gap-4 text-[10px] text-text-tertiary">
                <span>Raw</span>
                <span>Adjusted</span>
            </div>
            {labelText && (
                <div className="text-[12px] font-semibold" style={{ color: gradeColor }}>
                    {labelText}
                </div>
            )}
            <GradeScale grade={adjustedGrade} />
        </div>
    )
}

/** Sidebar metrics card — wraps `YphMetricCard` with a section header. */
export function MetricsSection({ yph, yphGrade, yphLabel }) {
    return (
        <div className="rounded p-3" style={CARD_STYLE}>
            <CardHeader
                icon="fa-chart-bar"
                label="Performance"
                title="Weekly Performance Metrics"
                sub="Key indicators for this reporting period."
            />
            <YphMetricCard yph={yph} grade={yphGrade} label={yphLabel} />
        </div>
    )
}
