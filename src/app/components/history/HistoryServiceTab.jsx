/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { DateUtility } from '../../../utils/DateUtility'
import { HistoryUtility } from '../../../utils/HistoryUtility'
import { RESOLVED_ISSUE_COLOR, SEVERITY_COLORS } from '../../constants/historyConstants'
import { SEVERITY_TO_TONE } from '../../constants/issueModalConstants'
import Badge from '../common/Badge'
import ErrorMessage from '../common/ErrorMessage'
import HistoryEmptyState from '../ui/HistoryEmptyState'
import StatCard from '../ui/StatCard'
import StatCardGrid from '../ui/StatCardGrid'
import TimelineItem, { TimelineDate, TimelineHeader, TimelineMeta, TimelineSectionTitle } from '../ui/TimelineItem'

/** Combines service entries and issues into one chronological timeline. */
function buildCombinedTimeline(serviceData, issues) {
    return [
        ...serviceData.map((s) => ({
            changedBy: s.changedBy,
            date: s.serviceDate,
            serviceType: s.serviceType,
            timestamp: s.timestamp,
            type: 'service'
        })),
        ...issues.map((issue) => ({
            completedDate: issue.time_completed,
            date: issue.time_created,
            isCompleted: !!issue.time_completed,
            issue,
            timestamp: issue.time_created,
            type: 'issue'
        }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date))
}

/** A service-history row in the combined timeline. */
function ServiceRow({ entry, isLast }) {
    return (
        <TimelineItem dotClassName="bg-status-active" isLast={isLast}>
            <TimelineHeader
                label={
                    <>
                        <i className="fas fa-wrench mr-1" /> {entry.serviceType}
                    </>
                }
            />
            <TimelineMeta>
                <TimelineDate date={DateUtility.formatDate(entry.date)} />
            </TimelineMeta>
        </TimelineItem>
    )
}

/** Header line for an issue card: severity and, once closed, resolved. */
function IssueCardHeader({ isCompleted, severity }) {
    return (
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={SEVERITY_TO_TONE[severity] ?? 'warning'} size="sm">
                {severity}
            </Badge>
            {isCompleted && (
                <Badge tone="success" size="sm">
                    Resolved
                </Badge>
            )}
        </div>
    )
}

/** Footer row for an issue card: creator/date, mark-resolved action or completion date. */
function IssueCardFooter({ entry, getCreatorName, issue, onCompleteIssue }) {
    return (
        <div className="flex items-center justify-between mt-1.5 pt-1.5 flex-wrap gap-2 border-t border-border-light">
            <div className="flex items-center gap-2.5 text-[11px] text-text-tertiary">
                <span>
                    <i className="fas fa-user mr-1 text-[9px]" />
                    {getCreatorName(issue)}
                </span>
                <span className="tabular-nums">
                    <i className="fas fa-calendar-plus mr-1 text-[9px]" />
                    {HistoryUtility.formatHistoryDate(issue.time_created)}
                </span>
            </div>
            {entry.isCompleted && entry.completedDate && (
                <span className="text-[11px] font-semibold tabular-nums text-text-primary">
                    <i className="fas fa-check mr-1 text-[9px]" />
                    {HistoryUtility.formatHistoryDate(issue.time_completed)}
                </span>
            )}
            {!entry.isCompleted && (
                <button
                    type="button"
                    onClick={() => onCompleteIssue(issue.id)}
                    title="Mark as resolved"
                    aria-label="Mark issue as resolved"
                    className="btn-secondary"
                >
                    <i className="fas fa-check text-[12px]" aria-hidden="true" />
                    Mark resolved
                </button>
            )}
        </div>
    )
}

/** An issue row in the combined timeline, its dot coloured by severity. */
function IssueRow({ entry, getCreatorName, isLast, onCompleteIssue, onDeleteIssue }) {
    const issue = entry.issue
    const severityColor = entry.isCompleted
        ? RESOLVED_ISSUE_COLOR
        : (SEVERITY_COLORS[issue.severity] ?? 'var(--status-shop)')
    return (
        <TimelineItem dotColor={severityColor} isLast={isLast}>
            <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                    <IssueCardHeader isCompleted={entry.isCompleted} severity={issue.severity} />
                    <div className="text-[13px] leading-snug text-text-primary">{issue.issue}</div>
                </div>
                <button
                    type="button"
                    onClick={() => onDeleteIssue(issue.id)}
                    title="Delete issue"
                    aria-label="Delete issue"
                    className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-none bg-transparent text-text-tertiary transition-colors duration-150 hover:bg-bg-tertiary hover:text-status-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
                >
                    <i className="fas fa-trash text-[12px]" aria-hidden="true" />
                </button>
            </div>
            <IssueCardFooter
                entry={entry}
                getCreatorName={getCreatorName}
                issue={issue}
                onCompleteIssue={onCompleteIssue}
            />
        </TimelineItem>
    )
}

/**
 * Service-history tab: combines service entries and issues into one chronological
 * timeline. Each row is either a service marker or an issue with delete and
 * mark-resolved actions.
 */
export default function HistoryServiceTab({
    error,
    getCreatorName,
    issues,
    onCompleteIssue,
    onDeleteIssue,
    serviceData,
    setError
}) {
    const sortedIssues = [...issues].sort((a, b) => new Date(b.time_created) - new Date(a.time_created))
    const openIssues = sortedIssues.filter((issue) => !issue.time_completed)
    const resolvedIssues = sortedIssues.filter((issue) => issue.time_completed)
    if (serviceData.length === 0 && issues.length === 0) {
        return (
            <HistoryEmptyState
                title="No service history or issues available"
                subtitle="Service records and issues will appear here once they are logged."
            />
        )
    }
    const actualServices = serviceData.filter((s) => s.serviceType === 'Service')
    const lastService = actualServices[actualServices.length - 1] ?? null
    const daysSinceLastService = lastService
        ? HistoryUtility.daysBetween(new Date(lastService.serviceDate), new Date())
        : null
    const combinedTimeline = buildCombinedTimeline(serviceData, issues)
    return (
        <div className="flex flex-col gap-3">
            <StatCardGrid>
                {lastService && (
                    <StatCard
                        label="Last Service"
                        value={DateUtility.formatDate(lastService.serviceDate)}
                        sublabel={`${daysSinceLastService} days ago`}
                    />
                )}
                <StatCard label="Open Issues" value={openIssues.length} />
                <StatCard label="Resolved" value={resolvedIssues.length} />
            </StatCardGrid>
            <TimelineSectionTitle title="Timeline" />
            <ErrorMessage message={error} onDismiss={() => setError(null)} />
            <div className="flex flex-col gap-0">
                {combinedTimeline.map((entry, index) => {
                    const isLast = index >= combinedTimeline.length - 1
                    if (entry.type === 'service') {
                        return <ServiceRow key={`service-${index}`} entry={entry} isLast={isLast} />
                    }
                    return (
                        <IssueRow
                            key={`issue-${entry.issue.id}`}
                            entry={entry}
                            getCreatorName={getCreatorName}
                            isLast={isLast}
                            onCompleteIssue={onCompleteIssue}
                            onDeleteIssue={onDeleteIssue}
                        />
                    )
                })}
            </div>
        </div>
    )
}
