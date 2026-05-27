/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { DEFAULT_TAG_STYLE, TAG_COLORS } from '../../../constants/safetyManagerReportConstants'
import { SECTION_LABEL_CLASS } from '../../../constants/weeklyReportConstants'
import Badge from '../../common/Badge'

/** Compact card header — icon chip + label/title. Supports a tint on
 *  the icon chip via `iconBg` + `iconColor` so it can flip from red
 *  (incidents present) to green (all clear) without duplicating the
 *  whole header markup. */
export function SafetyCardHeader({ icon, iconBg, iconColor, label, right, sub, title }) {
    return (
        <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
                <div
                    className="flex h-6 w-6 items-center justify-center rounded shrink-0"
                    style={{
                        background: iconBg || 'var(--bg-tertiary)',
                        color: iconColor || 'var(--text-secondary)'
                    }}
                >
                    <i className={`fas ${icon} text-[11px]`} />
                </div>
                <div className="min-w-0 flex-1">
                    {label && (
                        <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                            {label}
                        </div>
                    )}
                    <div className="text-[12.5px] font-semibold leading-tight text-text-primary">{title}</div>
                    {sub && <div className="text-[10.5px] mt-0.5 text-text-tertiary">{sub}</div>}
                </div>
            </div>
            {right && <div className="shrink-0">{right}</div>}
        </div>
    )
}

/** Small chip rendered in the issue card header — single tag style.
 *  `icon` accepts a full Font Awesome class string (e.g. "fas fa-industry") to stay
 *  backward-compatible with existing callers — wrapped here so Badge renders it
 *  verbatim instead of treating it as a class suffix. */
export function IssueChip({ children, color = 'var(--text-secondary)', icon, tint = 'var(--bg-tertiary)' }) {
    const iconNode = icon ? <i className={`${icon} text-[9px]`} aria-hidden="true" /> : null
    return (
        <Badge variant="custom" bg={tint} fg={color} size="md" weight="semibold" uppercase={false} icon={iconNode}>
            {children}
        </Badge>
    )
}

/** Field label inside the issue card body — icon + text + optional *. */
export function FieldLabel({ children, icon, required }) {
    return (
        <label className={`${SECTION_LABEL_CLASS} flex items-center gap-1.5 text-text-tertiary`}>
            {icon && <i className={`fas ${icon} text-[10px]`} />}
            {children}
            {required && <span className="text-text-primary">*</span>}
        </label>
    )
}

/** Tags row beneath the tag picker — tinted chip per tag, with an
 *  inline remove ✕ when not read-only. */
export function TagsDisplay({ onRemoveTag, readOnly, tags }) {
    if (!tags?.length) return null
    const canRemove = !readOnly && Boolean(onRemoveTag)
    return (
        <div className="flex flex-wrap gap-1">
            {tags.map((t) => {
                const tagStyle = TAG_COLORS[t] || DEFAULT_TAG_STYLE
                const iconNode = <i className={`${tagStyle.icon} text-[9px]`} aria-hidden="true" />
                return (
                    <Badge
                        key={t}
                        variant="custom"
                        bg={tagStyle.bg}
                        fg={tagStyle.color}
                        size="md"
                        weight="semibold"
                        uppercase={false}
                        icon={iconNode}
                        removable={canRemove}
                        onRemove={() => onRemoveTag?.(t)}
                    >
                        {t}
                    </Badge>
                )
            })}
        </div>
    )
}

/** Banner shown when there are no issues yet — switches to a green
 *  "all clear" treatment in review mode via the `success` prop. */
export function SafetyEmptyState({ success }) {
    return (
        <div className="flex flex-col items-center justify-center gap-1.5 py-8 px-4 rounded bg-bg-secondary border border-border-medium">
            <i
                className={`fas ${success ? 'fa-circle-check' : 'fa-shield-alt'} text-[22px]`}
                style={{ color: 'var(--text-primary)' }}
            />
            <div className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                {success ? 'All Clear' : 'No Issues Reported'}
            </div>
            <div className="text-[11.5px] text-text-tertiary">
                {success
                    ? 'No safety issues were reported during this reporting period.'
                    : 'Click Add Issue to document any safety incidents.'}
            </div>
        </div>
    )
}

/** Issue card header — sequence number, plant/date/efficiency chips,
 *  and a delete button when editable. */
export function IssueCardHeader({ idx, issue, onRemove, readOnly }) {
    return (
        <div className="flex items-center justify-between gap-2 px-2.5 py-2 flex-wrap bg-bg-tertiary border-b border-border-light">
            <div className="flex items-center gap-2 flex-wrap">
                <Badge
                    tone="accent"
                    variant="solid"
                    size="md"
                    shape="pill"
                    weight="bold"
                    uppercase={false}
                    className="h-[22px] w-[22px] justify-center tabular-nums"
                >
                    {idx + 1}
                </Badge>
                {issue.plant && (
                    <IssueChip icon="fas fa-industry" tint="rgba(59, 130, 246, 0.12)">
                        {issue.plant === 'All' ? 'All Plants' : `Plant ${issue.plant}`}
                    </IssueChip>
                )}
                {issue.date && (
                    <IssueChip icon="fas fa-calendar" tint="rgba(22, 163, 74, 0.12)">
                        {new Date(issue.date + 'T00:00:00').toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short',
                            weekday: readOnly ? 'short' : undefined
                        })}
                    </IssueChip>
                )}
                {issue.affectsEfficiency && (
                    <IssueChip icon="fas fa-chart-line" tint="rgba(220, 38, 38, 0.12)">
                        Affects Efficiency
                    </IssueChip>
                )}
            </div>
            {!readOnly && onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    title="Remove issue"
                    aria-label="Remove issue"
                    className="flex items-center justify-center rounded border-none cursor-pointer bg-[rgba(220,_38,_38,_0.12)] text-text-primary h-6 w-6 hover:bg-[rgba(220,_38,_38,_0.2)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
                >
                    <i className="fas fa-trash-alt text-[10px]" />
                </button>
            )}
        </div>
    )
}
