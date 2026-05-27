/* eslint-disable react/forbid-dom-props */
import React from 'react'

import Badge from '../../../../app/components/common/Badge'
import { FORM_FIELD_STYLE, FORM_SECTION_LABEL_CLASS } from './formStyles'

/** Compact-mode input class — smaller padding + font than the shared
 *  FORM_FIELD_BASE_CLASS so a dense card can fit 5 cells per row at lg
 *  without scrolling. Local to this cell on purpose; the rest of the
 *  report submit surface still uses the standard FORM_FIELD_BASE_CLASS.
 *
 *  Intentionally NO disabled-state opacity: auto-filled values still need
 *  to be fully legible — the user identifies them by the badge, not by a
 *  greyed-out input. */
const COMPACT_INPUT_CLASS = 'w-full rounded px-1.5 py-1 text-[11px] outline-none box-border tabular-nums'

/** Browsers apply a user-agent grey to `<input disabled>` text via
 *  `-webkit-text-fill-color` (Chrome/Safari) and a reduced opacity on
 *  Firefox/Edge. Both shortcuts ignore our `color: var(--text-primary)`,
 *  so disabled fields render in dark grey on light backgrounds and washed
 *  grey on dark. Force the theme colour through and pin opacity to 1 so
 *  the auto-filled value reads as crisply as a manual entry. */
const INPUT_STYLE_OVERRIDES = {
    ...FORM_FIELD_STYLE,
    WebkitTextFillColor: 'var(--text-primary)',
    opacity: 1
}

/**
 * Per-field cell for the Plant Efficiency Report operator card. Renders
 * one timing or load value with three possible states:
 *
 *   1. AUTO          — auto-fillable from Dayforce or dispatch tickets,
 *                      auto value present, no user override. Input is
 *                      disabled; badge shows the source.
 *   2. OVERRIDE      — auto-fillable but user clicked "Edit" to type a
 *                      manual value. Input is editable; badge shows
 *                      "Manual override"; "Reset" link snaps back to AUTO.
 *   3. MANUAL        — either not auto-fillable (eod_in_yard) OR auto
 *                      source returned nothing for this operator. Input
 *                      is editable; badge shows "Manual entry".
 *
 * The override toggle only appears when an auto source EXISTS for the
 * field (Dayforce for start_time/punch_out, tickets for first_load/loads).
 * Read-only mode hides every toggle and forces every field disabled.
 */
const SOURCE_LABELS = {
    dayforce: 'Dayforce',
    tickets: 'Tickets'
}

/** Maps cell state -> Badge tone. `missing` flags that an auto source
 *  exists but returned no value, so the user must type one. */
const STATE_TO_BADGE_TONE = {
    auto: 'info',
    manual: 'neutral',
    missing: 'danger',
    override: 'warning'
}

const STATE_TO_BADGE_ICON = {
    auto: 'check',
    manual: null,
    missing: 'triangle-exclamation',
    override: 'pen'
}

const PlantProductionFieldCell = ({
    autoSource,
    autoValue,
    field,
    hasAutoValue,
    inputType = 'time',
    isOverridden,
    label,
    onChange,
    onResetToAuto,
    onSetOverride,
    readOnly,
    value
}) => {
    const isAutoActive = !!autoSource && hasAutoValue && !isOverridden
    const editable = !readOnly && !isAutoActive
    const showToggle = !readOnly && !!autoSource && hasAutoValue
    const cellState = isAutoActive
        ? 'auto'
        : isOverridden
          ? 'override'
          : autoSource && !hasAutoValue
            ? 'missing'
            : 'manual'
    const badgeText = isOverridden
        ? 'Manual override'
        : isAutoActive
          ? `Auto · ${SOURCE_LABELS[autoSource] || autoSource}`
          : autoSource
            ? `Manual · no ${SOURCE_LABELS[autoSource] || autoSource} data`
            : 'Manual entry'

    return (
        <div className="flex flex-col gap-1 rounded-md p-1.5 bg-bg-secondary border border-border-light">
            <div className="flex items-center justify-between gap-1">
                <label className={FORM_SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                    {label}
                </label>
                {showToggle &&
                    (isOverridden ? (
                        <button
                            type="button"
                            onClick={onResetToAuto}
                            className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider cursor-pointer border border-border-light bg-bg-primary text-text-secondary hover:text-text-primary"
                            title={`Reset to ${SOURCE_LABELS[autoSource] || autoSource} value`}
                        >
                            <i className="fas fa-rotate-left text-[7px]" />
                            Reset
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onSetOverride}
                            className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider cursor-pointer border border-border-light bg-bg-primary text-text-secondary hover:text-text-primary"
                            title="Edit this value manually"
                        >
                            <i className="fas fa-pen text-[7px]" />
                            Edit
                        </button>
                    ))}
            </div>
            <input
                type={inputType}
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                disabled={!editable}
                inputMode={inputType === 'number' ? 'numeric' : undefined}
                min={inputType === 'number' ? '0' : undefined}
                aria-label={label}
                data-field={field}
                className={COMPACT_INPUT_CLASS}
                style={INPUT_STYLE_OVERRIDES}
            />
            <Badge
                tone={STATE_TO_BADGE_TONE[cellState]}
                variant="outline"
                size="xs"
                shape="pill"
                weight="semibold"
                uppercase={false}
                icon={STATE_TO_BADGE_ICON[cellState]}
                className="self-start"
            >
                {badgeText}
            </Badge>
        </div>
    )
}

export default PlantProductionFieldCell
