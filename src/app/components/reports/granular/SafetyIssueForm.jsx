/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { TAG_OPTIONS } from '../../../constants/safetyManagerReportConstants'
import { FIELD_INPUT_CLASS, FIELD_STYLE } from '../../../constants/weeklyReportConstants'
import PlantDropdownModal from '../../common/PlantDropdownModal'
import { FieldLabel, IssueCardHeader, TagsDisplay } from './SafetyAtoms'
import { TagPicker } from './SafetyTagPicker'

/** Plant + Date inputs row inside an editable issue card. */
function IssueLocationFields({ issue, onOpenPlantPicker, readOnly, updateIssue }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-2">
            <div className="flex flex-col gap-1">
                <FieldLabel icon="fa-industry" required>
                    Plant Location
                </FieldLabel>
                <button type="button"
                    type="button"
                    disabled={readOnly}
                    onClick={onOpenPlantPicker}
                    className={`${FIELD_INPUT_CLASS} flex items-center justify-between text-left cursor-pointer disabled:cursor-not-allowed`}
                    style={FIELD_STYLE}
                >
                    <span>
                        {issue.plant
                            ? issue.plant === 'All'
                                ? 'All Plants'
                                : `Plant ${issue.plant}`
                            : 'Select Plant…'}
                    </span>
                    <i className="fas fa-chevron-down text-[9px] text-text-tertiary" />
                </button>
            </div>
            <div className="flex flex-col gap-1">
                <FieldLabel icon="fa-calendar-alt">Date of Incident</FieldLabel>
                <input
                    type="date"
                    disabled={readOnly}
                    value={issue.date || ''}
                    onChange={(e) => updateIssue(issue.id, { date: e.target.value })}
                    className={`${FIELD_INPUT_CLASS} tabular-nums`}
                    style={FIELD_STYLE}
                />
            </div>
        </div>
    )
}

/** Tags row — picker + visible chip list. */
function IssueTagsField({ issue, onUpdateTags, removeIssueTag, readOnly, tags }) {
    return (
        <div className="flex flex-col gap-1">
            <FieldLabel icon="fa-tags" required>
                Issue Categories
            </FieldLabel>
            <TagPicker
                value={tags}
                options={TAG_OPTIONS}
                disabled={readOnly}
                placeholder="Select categories"
                onChange={onUpdateTags}
            />
            {tags.length > 0 && (
                <div className="mt-1">
                    <TagsDisplay tags={tags} onRemoveTag={(t) => removeIssueTag(issue.id, t)} readOnly={readOnly} />
                </div>
            )}
        </div>
    )
}

function IssueDescriptionField({ issue, readOnly, updateIssue }) {
    return (
        <div className="flex flex-col gap-1">
            <FieldLabel icon="fa-align-left" required>
                Issue Description
            </FieldLabel>
            <textarea
                disabled={readOnly}
                value={issue.description}
                onChange={(e) => updateIssue(issue.id, { description: e.target.value })}
                rows={4}
                className={`${FIELD_INPUT_CLASS} resize-y min-h-[88px]`}
                style={FIELD_STYLE}
                placeholder="Describe the incident in detail — what happened, who was involved, and any actions taken…"
            />
        </div>
    )
}

/** Toggle switch — "Should affect plant's efficiency". Disabled when
 *  no specific plant has been chosen. */
function AffectsEfficiencyToggle({ disabled, issue, updateIssue }) {
    return (
        <label
            className={`flex items-center gap-2 select-none ${
                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            }`}
        >
            <input
                type="checkbox"
                className="hidden"
                checked={!!issue.affectsEfficiency}
                disabled={disabled}
                onChange={(e) => updateIssue(issue.id, { affectsEfficiency: e.target.checked })}
            />
            <span
                className="relative rounded-full transition-colors shrink-0 w-[30px] h-4"
                style={{
                    background: issue.affectsEfficiency ? 'var(--accent, #1e3a5f)' : 'var(--border-medium)'
                }}
            >
                <span
                    className="absolute rounded-full bg-bg-primary transition-all w-3 h-3"
                    style={{
                        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                        left: issue.affectsEfficiency ? 16 : 2,
                        top: 2
                    }}
                />
            </span>
            <span className="text-[12px] text-text-secondary">
                Should affect plant&apos;s efficiency
                {(!issue.plant || issue.plant === 'All') && (
                    <span className="ml-1 text-[10.5px] text-text-tertiary">(select a specific plant first)</span>
                )}
            </span>
        </label>
    )
}

/** Editable issue card — header, location fields, tags, description,
 *  efficiency toggle. */
export function IssueCard({
    idx,
    issue,
    onOpenPlantPicker,
    onUpdateTags,
    readOnly,
    removeIssue,
    removeIssueTag,
    tags,
    updateIssue
}) {
    const efficiencyDisabled = readOnly || !issue.plant || issue.plant === 'All'
    return (
        <div className="rounded overflow-hidden bg-bg-secondary border border-border-light">
            <IssueCardHeader issue={issue} idx={idx} onRemove={() => removeIssue(issue.id)} readOnly={readOnly} />
            <div className="flex flex-col gap-2.5 p-2.5">
                <IssueLocationFields
                    issue={issue}
                    onOpenPlantPicker={onOpenPlantPicker}
                    readOnly={readOnly}
                    updateIssue={updateIssue}
                />
                <IssueTagsField
                    issue={issue}
                    onUpdateTags={onUpdateTags}
                    removeIssueTag={removeIssueTag}
                    readOnly={readOnly}
                    tags={tags}
                />
                <IssueDescriptionField issue={issue} readOnly={readOnly} updateIssue={updateIssue} />
                <AffectsEfficiencyToggle disabled={efficiencyDisabled} issue={issue} updateIssue={updateIssue} />
            </div>
        </div>
    )
}

/** Helper component re-exported so the orchestrator owns modal state. */
export { PlantDropdownModal }
