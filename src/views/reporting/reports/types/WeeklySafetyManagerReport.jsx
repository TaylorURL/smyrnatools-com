/* eslint-disable react/forbid-dom-props */
import React, { useState } from 'react'

import PlantDropdownModal from '../../../../app/components/common/PlantDropdownModal'
import {
    IssueCardHeader,
    SafetyCardHeader,
    SafetyEmptyState,
    TagsDisplay
} from '../../../../app/components/reports/granular/SafetyAtoms'
import { IssueCard } from '../../../../app/components/reports/granular/SafetyIssueForm'
import { getIssueTags, normalizeIssues } from '../../../../app/constants/safetyManagerReportConstants'
import { CARD_STYLE, SECTION_LABEL_CLASS } from '../../../../app/constants/weeklyReportConstants'
import { useSafetyIssues } from '../../../../app/hooks/useSafetyIssues'

/** Submit-mode plugin — editable safety issues list with plant picker
 *  and tag/efficiency controls. */
export function SafetyManagerSubmitPlugin({ form, plants, readOnly, setForm }) {
    const [showPlantModal, setShowPlantModal] = useState(false)
    const [selectedIssueIdForPlant, setSelectedIssueIdForPlant] = useState(null)
    const { addIssue, issues, removeIssue, removeIssueTag, updateIssue, updateIssueTagsArray } = useSafetyIssues(
        form,
        setForm
    )

    const openPlantPicker = (issueId) => {
        setSelectedIssueIdForPlant(issueId)
        setShowPlantModal(true)
    }
    const handlePlantSelect = (plantCode) => {
        if (selectedIssueIdForPlant !== null) {
            updateIssue(selectedIssueIdForPlant, { plant: plantCode })
        }
        setShowPlantModal(false)
        setSelectedIssueIdForPlant(null)
    }

    return (
        <div className="rounded p-3 mt-2.5" style={CARD_STYLE}>
            <SafetyCardHeader
                icon="fa-exclamation-circle"
                iconBg="rgba(220, 38, 38, 0.12)"
                label="Safety"
                title="Issues & Incidents"
                sub="Document any safety-related issues that occurred during this reporting period."
                right={
                    !readOnly ? (
                        <button
                            type="button"
                            onClick={addIssue}
                            className="inline-flex items-center gap-1.5 rounded text-[11.5px] font-bold uppercase tracking-wider text-white px-2.5 py-1.5 cursor-pointer border-none bg-[var(--accent,_#1e3a5f)]"
                        >
                            <i className="fas fa-plus text-[10px]" />
                            Add Issue
                        </button>
                    ) : null
                }
            />
            {issues.length === 0 ? (
                <SafetyEmptyState />
            ) : (
                <div className="flex flex-col gap-2">
                    {issues.map((issue, idx) => (
                        <IssueCard
                            key={issue.id}
                            idx={idx}
                            issue={issue}
                            onOpenPlantPicker={() => openPlantPicker(issue.id)}
                            onUpdateTags={(vals) => updateIssueTagsArray(issue.id, vals)}
                            readOnly={readOnly}
                            removeIssue={removeIssue}
                            removeIssueTag={removeIssueTag}
                            tags={Array.isArray(issue.tags) ? issue.tags : []}
                            updateIssue={updateIssue}
                        />
                    ))}
                </div>
            )}
            <PlantDropdownModal
                isOpen={showPlantModal}
                onClose={() => {
                    setShowPlantModal(false)
                    setSelectedIssueIdForPlant(null)
                }}
                plants={plants}
                showAllPlants={true}
                onSelect={handlePlantSelect}
            />
        </div>
    )
}

/** Read-only review of a submitted Safety report — green "all clear"
 *  treatment when there are no incidents. */
export function SafetyManagerReviewPlugin({ form }) {
    const issues = normalizeIssues(form.issues)
    if (issues.length === 0) {
        return (
            <div className="rounded p-3 mt-2.5" style={CARD_STYLE}>
                <SafetyCardHeader
                    icon="fa-shield-alt"
                    iconBg="rgba(22, 163, 74, 0.12)"
                    label="Safety"
                    title="Issues & Incidents"
                    sub="No safety incidents reported for this period."
                />
                <SafetyEmptyState success />
            </div>
        )
    }
    return (
        <div className="rounded p-3 mt-2.5" style={CARD_STYLE}>
            <SafetyCardHeader
                icon="fa-exclamation-circle"
                iconBg="rgba(220, 38, 38, 0.12)"
                label="Safety"
                title="Issues & Incidents"
                sub={`${issues.length} issue${issues.length > 1 ? 's' : ''} reported for this period.`}
                right={
                    <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold tabular-nums bg-[rgba(220,_38,_38,_0.12)] text-text-primary">
                        <i className="fas fa-clipboard-list text-[9px]" />
                        {issues.length} Incident{issues.length > 1 ? 's' : ''}
                    </span>
                }
            />
            <div className="flex flex-col gap-2">
                {issues.map((issue, idx) => (
                    <ReviewIssueRow key={issue.id || idx} idx={idx} issue={issue} />
                ))}
            </div>
        </div>
    )
}

/** Read-only collapsed view of one issue — header chips + description. */
function ReviewIssueRow({ idx, issue }) {
    const tags = getIssueTags(issue)
    return (
        <div className="rounded overflow-hidden bg-bg-secondary border border-border-light">
            <IssueCardHeader issue={issue} idx={idx} readOnly />
            <div className="flex flex-col gap-2 p-2.5">
                {tags.length > 0 && <TagsDisplay tags={tags} readOnly />}
                <div className="rounded p-2.5 bg-bg-primary border border-border-light">
                    <div className={`${SECTION_LABEL_CLASS} mb-1 flex items-center gap-1.5 text-text-tertiary`}>
                        <i className="fas fa-file-alt text-[10px]" />
                        Description
                    </div>
                    <div className="text-[12.5px] leading-relaxed text-text-primary">
                        {issue.description || (
                            <span className="italic text-text-tertiary">No description provided.</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
