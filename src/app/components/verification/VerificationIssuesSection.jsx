/* eslint-disable react/forbid-dom-props */
import React from 'react'

import {
    FIELD_STYLE,
    formatVerificationDate,
    getSeverityPalette,
    PILL_BASE
} from '../../constants/verificationModalConstants'
import LoadingScreen from '../common/LoadingScreen'
import { Banner, IconButton, Pill, Section } from './VerificationAtoms'

function IssueCard({ canDelete, issue, onComplete, onDelete, userNames }) {
    const palette = getSeverityPalette(issue.severity)
    return (
        <div className="rounded p-2.5" style={FIELD_STYLE}>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className={PILL_BASE} style={{ background: palette.bg, color: palette.fg }}>
                    {issue.severity}
                </span>
                <span className="flex items-center gap-1 text-[10.5px] text-text-secondary">
                    <i className="fas fa-user text-[9px]" />
                    {userNames[issue.created_by] || 'Unknown'}
                </span>
                <span className="text-[10.5px] font-mono tabular-nums text-text-tertiary">
                    {formatVerificationDate(issue.time_created)}
                </span>
                <div className="ml-auto flex gap-1">
                    <IconButton
                        icon="fa-check"
                        bg="#dcfce7"
                        fg="#166534"
                        onClick={() => onComplete(issue.id)}
                        title="Mark as resolved"
                    />
                    {canDelete && (
                        <IconButton
                            icon="fa-trash"
                            bg="#fee2e2"
                            fg="#b91c1c"
                            onClick={() => onDelete(issue.id)}
                            title="Delete issue"
                        />
                    )}
                </div>
            </div>
            <div className="text-[12px] leading-snug text-text-primary">{issue.issue}</div>
        </div>
    )
}

/** "Maintenance Issues" section — lists open issues with severity, author, and actions. */
export default function VerificationIssuesSection({
    accentColor,
    canDelete,
    expanded,
    hasHighSeverityIssues,
    isLoadingIssues,
    onCompleteIssue,
    onDeleteIssue,
    onToggle,
    openIssues,
    userNames
}) {
    const pill =
        openIssues.length === 0 ? (
            <Pill bg="#dcfce7" fg="#166534">
                Complete
            </Pill>
        ) : (
            <Pill bg="#dbeafe" fg="#1e40af">
                {openIssues.length} Open
            </Pill>
        )

    return (
        <Section
            icon="fa-wrench"
            title="Maintenance Issues"
            accentColor={accentColor}
            expanded={expanded}
            onToggle={onToggle}
            pill={pill}
        >
            <Banner tone="warn" icon="fa-info-circle">
                Issues are shown for awareness only. Marking them resolved is optional.
            </Banner>
            {isLoadingIssues ? (
                <LoadingScreen message="Loading issues..." inline={true} />
            ) : openIssues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-green-600">
                    <i className="fas fa-check-circle text-2xl mb-1.5" />
                    <span className="text-[12px] font-semibold">No open maintenance issues</span>
                </div>
            ) : (
                <>
                    {hasHighSeverityIssues && (
                        <Banner tone="danger" icon="fa-exclamation-triangle">
                            High severity issues detected. Consider resolving before verification.
                        </Banner>
                    )}
                    <div className="flex flex-col gap-1.5">
                        {openIssues.map((issue) => (
                            <IssueCard
                                key={issue.id}
                                canDelete={canDelete}
                                issue={issue}
                                onComplete={onCompleteIssue}
                                onDelete={onDeleteIssue}
                                userNames={userNames}
                            />
                        ))}
                    </div>
                </>
            )}
        </Section>
    )
}
