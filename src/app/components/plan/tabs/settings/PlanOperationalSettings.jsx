/* eslint-disable react/forbid-dom-props */
import React, { useMemo, useState } from 'react'

import {
    PLAN_SETTINGS_DEFAULTS,
    PLAN_SETTINGS_FIELDS,
    validatePlanSettings
} from '../../../../constants/planSettingsSchema'
import { usePlanOperationalSettings } from '../../../../hooks/usePlanOperationalSettings'
import Badge from '../../../common/Badge'

/**
 * Operational-settings form for the Plan → Settings tab. Renders one
 * sectioned form per group in `PLAN_SETTINGS_FIELDS`, with inline
 * validation mirroring every per-column + cross-column CHECK constraint
 * in the `plan_settings` migration so dispatchers see misconfigurations
 * before the DB rejects them. Saves a diff-only patch through
 * `PlanSettingsService`; on success the freshly returned row is fanned
 * out to every constant module via ESM live bindings so the running
 * session reflects the change without a reload.
 */
export default function PlanOperationalSettings({ accentColor, regionCode, regionName }) {
    const { discard, error, form, isDirty, loading, save, savedAt, saving, updateField } =
        usePlanOperationalSettings(regionCode)
    const [searchQuery, setSearchQuery] = useState('')
    const validationErrors = useMemo(() => validatePlanSettings(form), [form])
    const filteredSections = useMemo(() => filterSections(PLAN_SETTINGS_FIELDS, searchQuery), [searchQuery])
    const hasValidationErrors = Object.keys(validationErrors).length > 0
    const dirtyCount = useMemo(() => countDirty(form, PLAN_SETTINGS_DEFAULTS), [form])
    const canSave = isDirty && !saving && !hasValidationErrors
    const justSavedRecently = savedAt && Date.now() - savedAt < 4000

    if (!regionCode) {
        return (
            <div className="rounded-lg border border-border-light bg-bg-primary px-5 py-6 text-sm text-text-secondary">
                Select a region to configure operational settings.
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-3">
            <Toolbar
                dirtyCount={dirtyCount}
                loading={loading}
                onResetAll={() => resetAllToDefaults(form, updateField)}
                onSearch={setSearchQuery}
                regionName={regionName}
                searchQuery={searchQuery}
            />

            <div className="rounded-lg border border-border-light bg-bg-primary overflow-hidden">
                {filteredSections.length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm text-text-tertiary">
                        No settings match &ldquo;{searchQuery}&rdquo;.
                    </div>
                ) : (
                    filteredSections.map((section, sectionIndex) => (
                        <SettingsSection
                            key={section.key}
                            errors={validationErrors}
                            form={form}
                            isFirst={sectionIndex === 0}
                            onChange={updateField}
                            section={section}
                        />
                    ))
                )}
            </div>

            <ActionBar
                accentColor={accentColor}
                canSave={canSave}
                dirtyCount={dirtyCount}
                error={error}
                hasValidationErrors={hasValidationErrors}
                isDirty={isDirty}
                onDiscard={discard}
                onSave={save}
                saving={saving}
                showSavedFlash={Boolean(justSavedRecently)}
            />
        </div>
    )
}

/* ── Toolbar ─────────────────────────────────────────────────────── */
function Toolbar({ dirtyCount, loading, onResetAll, onSearch, regionName, searchQuery }) {
    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <div className="text-[15px] font-semibold text-text-primary">Operational settings</div>
                <div className="text-[11.5px] text-text-tertiary">
                    {regionName ? (
                        <>
                            Tuning <strong className="text-text-secondary">{regionName}</strong>
                        </>
                    ) : (
                        'Per-region tuning'
                    )}
                    {' · '}values take effect immediately
                    {loading ? ' · loading…' : ''}
                </div>
            </div>
            <div className="flex items-center gap-2">
                <div className="relative">
                    <i className="fas fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-text-tertiary pointer-events-none" />
                    <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => onSearch(e.target.value)}
                        placeholder="Search settings"
                        aria-label="Search settings"
                        className="rounded-md border border-border-medium bg-bg-secondary pl-7 pr-7 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary outline-none w-44 sm:w-56 transition-colors duration-150 hover:border-text-tertiary focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 [&::-webkit-search-cancel-button]:hidden"
                    />
                    {searchQuery && (
                        <button type="button"
                            onClick={() => onSearch('')}
                            aria-label="Clear search"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 border-none bg-transparent cursor-pointer text-text-tertiary hover:text-text-primary p-0.5 transition-colors duration-150"
                        >
                            <i className="fas fa-times text-[10px]" />
                        </button>
                    )}
                </div>
                <button type="button"
                    onClick={onResetAll}
                    disabled={dirtyCount > 0}
                    title={
                        dirtyCount > 0
                            ? 'Discard your edits first to reset everything to defaults'
                            : 'Restore every setting to its built-in default'
                    }
                    className="rounded-md border border-border-medium bg-bg-secondary px-2.5 py-1.5 text-xs font-semibold text-text-secondary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none disabled:active:scale-100"
                >
                    Reset to defaults
                </button>
            </div>
        </div>
    )
}

/* ── Section ─────────────────────────────────────────────────────── */
function SettingsSection({ errors, form, isFirst, onChange, section }) {
    return (
        <section>
            <header
                className={`flex items-baseline justify-between px-5 py-3 bg-bg-secondary border-border-light ${
                    isFirst ? 'border-b' : 'border-y'
                }`}
            >
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-secondary">
                    {section.title}
                </div>
                <div className="hidden sm:block text-[11px] text-text-tertiary">{section.description}</div>
            </header>
            <ul className="divide-y divide-border-light">
                {section.fields.map((field) => (
                    <SettingRow
                        key={field.column}
                        error={errors[field.column]}
                        field={field}
                        onChange={onChange}
                        value={form[field.column]}
                    />
                ))}
            </ul>
        </section>
    )
}

/* ── Row ─────────────────────────────────────────────────────────── */
function SettingRow({ error, field, onChange, value }) {
    const inputId = `plan-setting-${field.column}`
    const isOverridden = value !== '' && Number(value) !== Number(field.default)
    return (
        <li className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2 sm:gap-6 items-start px-5 py-3">
            <div className="min-w-0">
                <label
                    htmlFor={inputId}
                    className="flex items-center gap-2 text-[13px] font-semibold text-text-primary leading-snug"
                >
                    {field.label}
                    {isOverridden && (
                        <Badge tone="neutral" size="xs" shape="square" weight="bold">
                            Custom
                        </Badge>
                    )}
                </label>
                <p className="text-[11.5px] text-text-tertiary leading-snug mt-0.5">{field.helper}</p>
                {error && (
                    <p className="mt-1 text-[11.5px] font-semibold text-status-danger" role="alert">
                        {error}
                    </p>
                )}
            </div>
            <div className="flex items-start gap-2 sm:justify-end">
                <div className="flex items-center gap-1.5">
                    <input
                        id={inputId}
                        type="number"
                        inputMode="decimal"
                        step={field.step}
                        min={field.min}
                        max={field.max}
                        value={value === '' ? '' : value}
                        onChange={(e) => onChange(field.column, e.target.value)}
                        className={`w-20 sm:w-24 rounded-md border bg-bg-secondary px-2 py-1 text-sm text-right tabular-nums text-text-primary outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent/25 ${
                            error
                                ? 'border-status-danger focus-visible:border-status-danger'
                                : 'border-border-medium hover:border-text-tertiary focus-visible:border-accent'
                        }`}
                        aria-invalid={Boolean(error)}
                    />
                    <span className="text-[11.5px] text-text-tertiary whitespace-nowrap min-w-[3.5rem]">
                        {field.unit}
                    </span>
                </div>
                <button type="button"
                    onClick={() => onChange(field.column, field.default)}
                    disabled={!isOverridden}
                    title={`Reset to default (${field.default})`}
                    className="rounded-md bg-transparent border-none text-text-tertiary cursor-pointer p-1 disabled:opacity-30 disabled:cursor-not-allowed hover:text-text-primary active:scale-[0.92] transition-transform duration-150 ease-out motion-reduce:transition-none disabled:active:scale-100"
                >
                    <i className="fas fa-rotate-left text-[11px]" />
                </button>
            </div>
        </li>
    )
}

/* ── Action bar ──────────────────────────────────────────────────── */
function ActionBar({
    accentColor,
    canSave,
    dirtyCount,
    error,
    hasValidationErrors,
    isDirty,
    onDiscard,
    onSave,
    saving,
    showSavedFlash
}) {
    return (
        <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-lg border border-border-light bg-bg-primary px-4 py-2.5 shadow-sm">
            <StatusMessage
                dirtyCount={dirtyCount}
                error={error}
                hasValidationErrors={hasValidationErrors}
                isDirty={isDirty}
                showSavedFlash={showSavedFlash}
            />
            <div className="flex items-center gap-2 shrink-0">
                <button type="button"
                    onClick={onDiscard}
                    disabled={!isDirty || saving}
                    className="rounded-md border border-border-medium bg-bg-secondary px-3 py-1.5 text-xs font-semibold text-text-secondary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none disabled:active:scale-100"
                >
                    Discard
                </button>
                <button type="button"
                    onClick={onSave}
                    disabled={!canSave}
                    className="rounded-md border-none px-3 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none disabled:active:scale-100"
                    style={{ background: accentColor }}
                >
                    {saving ? (
                        <>
                            <i className="fas fa-spinner fa-spin mr-1.5" />
                            Saving…
                        </>
                    ) : (
                        'Save changes'
                    )}
                </button>
            </div>
        </div>
    )
}

function StatusMessage({ dirtyCount, error, hasValidationErrors, isDirty, showSavedFlash }) {
    if (error) {
        return <div className="text-[12px] font-semibold text-text-primary">{error}</div>
    }
    if (hasValidationErrors) {
        return (
            <div className="text-[12px] font-semibold text-text-primary">Fix the highlighted fields before saving.</div>
        )
    }
    if (isDirty) {
        return (
            <div className="text-[12px] text-text-secondary">
                <strong className="text-text-primary">{dirtyCount}</strong> unsaved{' '}
                {dirtyCount === 1 ? 'change' : 'changes'}
            </div>
        )
    }
    if (showSavedFlash) {
        return (
            <div className="text-[12px] font-semibold text-text-primary">
                <i className="fas fa-check mr-1.5" />
                Settings saved.
            </div>
        )
    }
    return <div className="text-[12px] text-text-tertiary">All settings up to date.</div>
}

/* ── Helpers ─────────────────────────────────────────────────────── */

/** Restrict the section list to whichever fields match the search
 *  query. Matches against label + helper text so dispatchers can find
 *  a setting by its purpose, not just its name. Empty / blank queries
 *  pass everything through. Sections with no surviving fields drop. */
function filterSections(sections, query) {
    const q = query.trim().toLowerCase()
    if (!q) return sections
    return sections
        .map((section) => ({
            ...section,
            fields: section.fields.filter((field) => `${field.label} ${field.helper}`.toLowerCase().includes(q))
        }))
        .filter((section) => section.fields.length > 0)
}

/** Count of fields whose current value differs from the built-in
 *  default. Used in the action-bar status pill to show how many edits
 *  are pending. */
function countDirty(form, defaults) {
    let count = 0
    for (const [column, value] of Object.entries(form)) {
        if (value === '' || !Number.isFinite(Number(value))) continue
        if (Number(value) !== Number(defaults[column])) count += 1
    }
    return count
}

/** Push every field back to its built-in default. Implemented as a
 *  series of `updateField` calls so the form's existing diff / dirty /
 *  validation pipeline keeps working unchanged. */
function resetAllToDefaults(form, updateField) {
    for (const column of Object.keys(form)) {
        updateField(column, PLAN_SETTINGS_DEFAULTS[column])
    }
}
