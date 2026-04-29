import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

import { DateUtility } from '../../../utils/DateUtility'
import { HistoryUtility } from '../../../utils/HistoryUtility'
import {
    ASSET_TYPES_WITH_CLEANLINESS,
    ASSET_TYPES_WITH_OPERATORS,
    ASSET_TYPES_WITH_OVERVIEW,
    ASSET_TYPES_WITH_PLANT,
    ASSET_TYPES_WITH_SERVICE,
    RATING_LABELS,
    RESOLVED_ISSUE_COLOR,
    SEVERITY_COLORS
} from '../../constants/historyConstants'
import useHistoryData from '../../hooks/useHistoryData'
import ErrorMessage from '../common/ErrorMessage'
import LoadingScreen from '../common/LoadingScreen'
import UserLabel from '../common/UserLabel'
import HistoryEmptyState from '../ui/HistoryEmptyState'
import RatingChart from '../ui/RatingChart'
import StatCard from '../ui/StatCard'
import StatCardGrid from '../ui/StatCardGrid'
import TabButton from '../ui/TabButton'
import TimelineItem, {
    TimelineDate,
    TimelineDuration,
    TimelineHeader,
    TimelineMeta,
    TimelineSectionTitle
} from '../ui/TimelineItem'

/**
 * Full-screen history view for an asset showing AI summary, status timeline,
 * operator history, service/maintenance records, issues, and cleanliness ratings.
 * Uses the useHistoryData hook for data fetching and consolidation.
 */
function HistoryViewSection({ item, type, onClose }) {
    const [activeTab, setActiveTab] = useState('timeline')
    const {
        aiSummary,
        aiSummaryError,
        aiSummaryLoading,
        allStatusPeriodsData,
        assignmentsData,
        cleanlinessData,
        conditionData,
        error,
        fetchHistory,
        generateAISummary,
        getOperatorName,
        getUserName,
        handleCompleteIssue,
        handleDeleteIssue,
        handleRegenerateAISummary,
        history,
        isLoading,
        issues,
        mileageData,
        operatorData,
        plantData,
        positionData,
        ratingsData,
        serviceData,
        setError,
        sortedHistory,
        statusData,
        userNames
    } = useHistoryData(item, type)
    const [aiDisplayText, setAiDisplayText] = useState('')
    const [isTypingComplete, setIsTypingComplete] = useState(false)
    const prevAiSummaryRef = useRef(null)
    const scrollContainerRef = useRef(null)
    const [analysisVisible, setAnalysisVisible] = useState(true)
    const analysisHeightRef = useRef(0)
    useEffect(() => {
        if (activeTab !== 'timeline') return
        const container = scrollContainerRef.current
        if (!container) return
        // Capture the visible height of the scroll container as the threshold —
        // once the user has scrolled more than one full viewport, collapse analysis.
        const threshold = container.clientHeight
        analysisHeightRef.current = threshold
        const onScroll = () => {
            setAnalysisVisible(container.scrollTop < threshold)
        }
        container.addEventListener('scroll', onScroll, { passive: true })
        onScroll()
        return () => container.removeEventListener('scroll', onScroll)
    }, [activeTab])
    useEffect(() => {
        if (!isLoading && activeTab === 'timeline' && !aiSummary && !aiSummaryLoading) {
            generateAISummary()
        }
    }, [isLoading, activeTab, aiSummary, aiSummaryLoading, generateAISummary])
    useEffect(() => {
        if (!aiSummary) {
            prevAiSummaryRef.current = null
            setAiDisplayText('')
            setIsTypingComplete(false)
            return
        }
        if (aiSummary === prevAiSummaryRef.current) return
        prevAiSummaryRef.current = aiSummary
        setAiDisplayText('')
        setIsTypingComplete(false)
        let currentIndex = 0
        const charsPerTick = 4
        const interval = setInterval(() => {
            if (currentIndex < aiSummary.length) {
                currentIndex = Math.min(currentIndex + charsPerTick, aiSummary.length)
                setAiDisplayText(aiSummary.slice(0, currentIndex))
            } else {
                clearInterval(interval)
                setIsTypingComplete(true)
            }
        }, 10)
        return () => clearInterval(interval)
    }, [aiSummary])
    const itemName = HistoryUtility.resolveItemName(type, item)
    const formatValue = (fieldName, value) => {
        const key = fieldName?.includes('_')
            ? fieldName
            : String(fieldName ?? '')
                  .replace(/([A-Z])/g, '_$1')
                  .toLowerCase()
        if (key === 'created') return value ?? ''
        if (value === null || value === undefined || value === '') return 'Not Assigned'
        if (key === 'assigned_operator') return getOperatorName(value)
        if (key === 'cleanliness_rating') {
            const n = parseInt(value, 10)
            return Number.isFinite(n) && n > 0 ? '\u2605'.repeat(n) : String(value)
        }
        if (key === 'last_service_date' || key === 'last_chip_date')
            return value ? DateUtility.formatDate(value) : 'Not Assigned'
        if (type === 'tractor' && key === 'has_blower') return value ? 'Yes' : 'No'
        if (key.includes('date') && value) return DateUtility.formatDate(value)
        if (key === 'assigned_trainer') return getUserName(value)
        return value
    }
    const getCreatorName = (issue) =>
        issue.created_by && userNames[issue.created_by] ? userNames[issue.created_by] : 'Unknown'
    const onDeleteIssue = async (issueId) => {
        if (!window.confirm('Are you sure you want to delete this issue?')) return
        try {
            await handleDeleteIssue(issueId)
        } catch {
            setError('Failed to delete issue. Please try again.')
        }
    }
    const onCompleteIssue = async (issueId) => {
        try {
            await handleCompleteIssue(issueId)
        } catch {
            setError('Failed to complete issue. Please try again.')
        }
    }
    const renderAISummary = () => {
        if (aiSummaryLoading) {
            return (
                <div
                    className="flex flex-col items-center justify-center gap-1.5 py-10 px-4"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    <i className="fas fa-robot text-[20px] animate-pulse" style={{ color: 'var(--text-secondary)' }} />
                    <p className="m-0 text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Analyzing history…
                    </p>
                    <p className="m-0 text-[11px]">This may take a moment.</p>
                </div>
            )
        }
        if (aiSummaryError) {
            return (
                <div
                    className="flex flex-col items-center justify-center gap-1.5 py-10 px-4"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    <i className="fas fa-exclamation-triangle text-[20px]" style={{ color: '#dc2626' }} />
                    <p className="m-0 text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Failed to generate analysis.
                    </p>
                    <button
                        onClick={handleRegenerateAISummary}
                        className="mt-1 inline-flex items-center gap-1.5 rounded text-[10.5px] font-bold uppercase tracking-wider text-white px-2.5 py-1.5 cursor-pointer border-none"
                        style={{ background: 'var(--accent, #1e3a5f)' }}
                    >
                        <i className="fas fa-sync-alt text-[10px]" />
                        Try Again
                    </button>
                </div>
            )
        }
        if (!aiSummary) {
            return (
                <div
                    className="flex flex-col items-center justify-center gap-1.5 py-10 px-4"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    <i className="fas fa-robot text-[20px]" />
                    <p className="m-0 text-[12px]">No analysis available.</p>
                </div>
            )
        }
        const StatCell = ({ value, label }) => (
            <div className="px-3 py-2.5 flex flex-col gap-0.5" style={{ borderRight: '1px solid var(--border-light)' }}>
                <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    {label}
                </span>
                <span
                    className="text-[18px] font-semibold leading-tight font-mono tabular-nums"
                    style={{ color: 'var(--text-primary)' }}
                >
                    {value}
                </span>
            </div>
        )
        return (
            <div className="flex flex-col gap-3">
                <div
                    className="rounded p-3"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <div
                            className="w-7 h-7 rounded flex items-center justify-center"
                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                        >
                            <i className="fas fa-robot text-[12px]" />
                        </div>
                        <div>
                            <div
                                className="text-[10px] font-semibold uppercase tracking-wider"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                Analysis · {history.length} entries
                            </div>
                        </div>
                    </div>
                    <div
                        className="text-[12px] leading-relaxed whitespace-pre-wrap"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        {aiDisplayText}
                        {!isTypingComplete && (
                            <span
                                className="inline-block w-0.5 h-3 ml-0.5 animate-pulse align-text-bottom"
                                style={{ background: 'var(--text-tertiary)' }}
                            />
                        )}
                    </div>
                </div>
                {isTypingComplete && (
                    <div
                        className="grid rounded overflow-hidden"
                        style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-light)',
                            gridTemplateColumns: ASSET_TYPES_WITH_OPERATORS.includes(type)
                                ? 'repeat(4, minmax(0, 1fr))'
                                : 'repeat(3, minmax(0, 1fr))'
                        }}
                    >
                        <StatCell value={history.length} label="Total Changes" />
                        <StatCell value={statusData.length} label="Status Changes" />
                        {ASSET_TYPES_WITH_OPERATORS.includes(type) && (
                            <StatCell value={operatorData.length} label="Operator Changes" />
                        )}
                        <StatCell value={issues.length} label="Total Issues" />
                    </div>
                )}
                {isTypingComplete && (
                    <button
                        onClick={handleRegenerateAISummary}
                        className="w-full py-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 transition-colors"
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-primary)'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                    >
                        <i className="fas fa-sync-alt text-[10px]" />
                        Regenerate Analysis
                    </button>
                )}
            </div>
        )
    }
    const renderOperatorChart = () => {
        if (operatorData.length === 0) {
            return (
                <HistoryEmptyState
                    title="No operator assignment history available"
                    subtitle="Operator assignments will be charted here once they are recorded."
                />
            )
        }
        const operatorCounts = HistoryUtility.countByKey(operatorData, (e) => e.operator)
        const calculateDuration = (startIndex, operatorName) => {
            let endIndex = startIndex + 1
            while (endIndex < operatorData.length && operatorData[endIndex].operator === operatorName) endIndex++
            return {
                days: HistoryUtility.daysBetween(
                    operatorData[startIndex].date,
                    endIndex < operatorData.length ? operatorData[endIndex].date : new Date()
                ),
                endIndex
            }
        }
        const operatorDurations = {}
        let i = 0
        while (i < operatorData.length) {
            const { days, endIndex } = calculateDuration(i, operatorData[i].operator)
            operatorDurations[operatorData[i].operator] = (operatorDurations[operatorData[i].operator] ?? 0) + days
            i = endIndex
        }
        const uniqueOperators = Object.keys(operatorCounts).filter((op) => op !== 'Empty').length
        const lastEntry = operatorData[operatorData.length - 1]
        const currentOperator = lastEntry ? (lastEntry.isEmpty ? 'Empty' : lastEntry.operator) : null
        const mostFrequentOperator =
            HistoryUtility.findMostFrequent(
                Object.fromEntries(Object.entries(operatorDurations).filter(([op]) => op !== 'Empty'))
            ) ?? 'Not Assigned'
        const consolidatedTimeline = []
        let j = 0
        while (j < operatorData.length) {
            const entry = operatorData[j]
            const { days, endIndex } = calculateDuration(j, entry.operator)
            let statusPeriods = []
            if (entry.isEmpty) {
                const periodStart = new Date(entry.timestamp)
                const periodEnd =
                    endIndex < operatorData.length ? new Date(operatorData[endIndex].timestamp) : new Date()
                const statusChangesInPeriod = statusData.filter((s) => {
                    const d = new Date(s.timestamp)
                    return d >= periodStart && d < periodEnd
                })
                if (statusChangesInPeriod.length > 0) {
                    const statusDaysMap = {}
                    let currentStatus = statusChangesInPeriod[0]
                    let statusStart = periodStart
                    for (let k = 1; k < statusChangesInPeriod.length; k++) {
                        const nextStatus = statusChangesInPeriod[k]
                        const statusEnd = new Date(nextStatus.timestamp)
                        statusDaysMap[currentStatus.status] =
                            (statusDaysMap[currentStatus.status] ?? 0) +
                            HistoryUtility.daysBetween(statusStart, statusEnd)
                        currentStatus = nextStatus
                        statusStart = statusEnd
                    }
                    statusDaysMap[currentStatus.status] =
                        (statusDaysMap[currentStatus.status] ?? 0) + HistoryUtility.daysBetween(statusStart, periodEnd)
                    statusPeriods = Object.entries(statusDaysMap).map(([status, totalDays]) => ({
                        days: totalDays,
                        status
                    }))
                } else {
                    statusPeriods.push({ days, status: item.status ?? 'Unknown' })
                }
            }
            consolidatedTimeline.push({
                days,
                isCurrent: endIndex >= operatorData.length,
                isEmpty: entry.isEmpty,
                operator: entry.operator,
                startDate: entry.timestamp,
                statusPeriods
            })
            j = endIndex
        }
        return (
            <div className="flex flex-col gap-2.5">
                <StatCardGrid>
                    <StatCard label="Current Operator" value={currentOperator ?? 'Not Assigned'} />
                    <StatCard label="Unique Operators" value={uniqueOperators} />
                    <StatCard label="Most Frequent" value={mostFrequentOperator} />
                </StatCardGrid>
                <TimelineSectionTitle title="Assignment Timeline" />
                <div className="flex flex-col gap-0">
                    {consolidatedTimeline
                        .slice()
                        .reverse()
                        .map((entry, index) => (
                            <TimelineItem
                                key={index}
                                dotClassName="bg-accent"
                                isLast={index >= consolidatedTimeline.length - 1}
                            >
                                <TimelineHeader
                                    label={entry.operator}
                                    isCurrent={entry.isCurrent}
                                    badge={
                                        entry.isEmpty && !entry.isCurrent ? (
                                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded uppercase">
                                                No Operator
                                            </span>
                                        ) : null
                                    }
                                />
                                <TimelineMeta>
                                    <TimelineDate date={DateUtility.formatDate(entry.startDate)} />
                                    <TimelineDuration text={HistoryUtility.pluralizeDays(entry.days)} />
                                </TimelineMeta>
                                {entry.isEmpty && entry.statusPeriods?.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-border-light">
                                        <div className="text-[10px] text-slate-500 font-semibold mb-1">
                                            Status during period:
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {entry.statusPeriods.map((sp, spIdx) => (
                                                <div
                                                    key={spIdx}
                                                    className="text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded"
                                                >
                                                    <span className="font-medium">{sp.status}</span>
                                                    <span className="text-slate-400 ml-1">
                                                        ({HistoryUtility.pluralizeDays(sp.days)})
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </TimelineItem>
                        ))}
                </div>
            </div>
        )
    }
    const renderOverviewChart = () => {
        const currentStatus = item.status ?? 'Unknown'
        const oldestEntry =
            history.length > 0
                ? new Date(Math.min(...history.map((h) => new Date(h.changedAt ?? h.changed_at))))
                : new Date()
        const totalDaysSinceCreation = HistoryUtility.daysBetween(oldestEntry, new Date())
        let statusDaysMap = {}
        let statusPercentages
        let totalShopDays = 0
        if (allStatusPeriodsData.length === 0) {
            statusDaysMap[currentStatus] = totalDaysSinceCreation > 0 ? totalDaysSinceCreation : 1
            statusPercentages = [{ days: statusDaysMap[currentStatus], percentage: '100.0', status: currentStatus }]
        } else {
            totalShopDays = allStatusPeriodsData
                .filter((p) => p.status === 'In Shop')
                .reduce((sum, p) => sum + p.days, 0)
            allStatusPeriodsData.forEach((period) => {
                statusDaysMap[period.status] = (statusDaysMap[period.status] ?? 0) + period.days
            })
            statusPercentages = Object.entries(statusDaysMap)
                .map(([status, days]) => ({
                    days,
                    percentage: totalDaysSinceCreation > 0 ? ((days / totalDaysSinceCreation) * 100).toFixed(1) : 0,
                    status
                }))
                .sort((a, b) => b.days - a.days)
        }
        return (
            <div className="flex flex-col gap-2.5">
                <div
                    className="rounded p-3"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                >
                    <div
                        className="text-[9.5px] font-bold uppercase tracking-wider mb-2"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        Asset Status Distribution
                    </div>
                    <div
                        className="flex h-2 rounded-full overflow-hidden mb-2"
                        style={{ background: 'var(--bg-tertiary)' }}
                    >
                        {statusPercentages.map(
                            (sp, idx) =>
                                parseFloat(sp.percentage) > 0 && (
                                    <div
                                        key={idx}
                                        style={{
                                            background: HistoryUtility.getStatusColor(sp.status),
                                            width: `${sp.percentage}%`
                                        }}
                                        title={`${sp.status}: ${sp.percentage}%`}
                                    />
                                )
                        )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
                        {statusPercentages.map((sp, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1.5">
                                <span
                                    className="inline-block rounded-sm shrink-0"
                                    style={{
                                        background: HistoryUtility.getStatusColor(sp.status),
                                        height: 8,
                                        width: 8
                                    }}
                                />
                                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    {sp.status}
                                </span>
                                <span className="font-mono tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                                    {sp.days}d · {sp.percentage}%
                                </span>
                            </span>
                        ))}
                    </div>
                </div>
                <StatCardGrid>
                    <StatCard label="Current Status" value={currentStatus} />
                    <StatCard label="Total Status Changes" value={allStatusPeriodsData.length} />
                    <StatCard label="Total Shop Days" value={totalShopDays} />
                    <StatCard label="Days Since Creation" value={totalDaysSinceCreation} />
                </StatCardGrid>
                <TimelineSectionTitle title="Status Timeline" />
                <div className="flex flex-col gap-0">
                    {allStatusPeriodsData.length === 0 ? (
                        <TimelineItem dotColor={HistoryUtility.getStatusColor(currentStatus)} isLast>
                            <TimelineHeader label={currentStatus} isCurrent />
                            <TimelineMeta>
                                <TimelineDate date="Since Creation" />
                                <TimelineDuration text={HistoryUtility.pluralizeDays(statusDaysMap[currentStatus])} />
                            </TimelineMeta>
                            <TimelineMeta>
                                <span className="text-xs text-slate-500 italic">No status changes recorded</span>
                            </TimelineMeta>
                        </TimelineItem>
                    ) : (
                        allStatusPeriodsData
                            .slice()
                            .reverse()
                            .map((period, index) => (
                                <TimelineItem
                                    key={index}
                                    dotColor={HistoryUtility.getStatusColor(period.status)}
                                    isLast={index >= allStatusPeriodsData.length - 1}
                                >
                                    <TimelineHeader label={period.status} isCurrent={period.isCurrent} />
                                    <TimelineMeta>
                                        <TimelineDate
                                            date={`${DateUtility.formatDate(period.startTimestamp)}${
                                                period.endTimestamp
                                                    ? ` - ${DateUtility.formatDate(period.endTimestamp)}`
                                                    : ' - Present'
                                            }`}
                                        />
                                        <TimelineDuration text={HistoryUtility.pluralizeDays(period.days)} />
                                    </TimelineMeta>
                                    <div className="flex items-center gap-3 flex-wrap mt-1">
                                        <span className="text-xs text-slate-500">
                                            Started by: <UserLabel userId={period.changedBy} showIcon={false} />
                                        </span>
                                        {period.endChangedBy && (
                                            <span className="text-xs text-slate-500">
                                                Ended by: <UserLabel userId={period.endChangedBy} showIcon={false} />
                                            </span>
                                        )}
                                    </div>
                                </TimelineItem>
                            ))
                    )}
                </div>
            </div>
        )
    }
    const renderServiceHistory = () => {
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
        const combinedTimeline = [
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
        return (
            <div className="flex flex-col gap-2.5">
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
                        if (entry.type === 'service') {
                            return (
                                <TimelineItem
                                    key={`service-${index}`}
                                    dotClassName="bg-green-600"
                                    isLast={index >= combinedTimeline.length - 1}
                                >
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
                        const issue = entry.issue
                        const severityColor = entry.isCompleted
                            ? RESOLVED_ISSUE_COLOR
                            : (SEVERITY_COLORS[issue.severity] ?? '#3b82f6')
                        const sevPalette =
                            issue.severity === 'High'
                                ? { bg: 'rgba(220, 38, 38, 0.12)', color: '#b91c1c' }
                                : issue.severity === 'Medium'
                                  ? { bg: 'rgba(217, 119, 6, 0.12)', color: '#b45309' }
                                  : { bg: 'rgba(14, 165, 233, 0.12)', color: '#0369a1' }
                        return (
                            <div key={`issue-${issue.id}`} className="flex gap-2.5 py-1.5">
                                <div className="flex flex-col items-center w-5 flex-shrink-0">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full z-[1]"
                                        style={{
                                            background: severityColor,
                                            boxShadow: '0 0 0 2px var(--bg-primary), 0 0 0 3px var(--border-light)'
                                        }}
                                    />
                                    {index < combinedTimeline.length - 1 && (
                                        <div
                                            className="w-px flex-1 -mt-0.5"
                                            style={{ background: 'var(--border-light)' }}
                                        />
                                    )}
                                </div>
                                <div
                                    className="flex-1 rounded p-2.5"
                                    style={{
                                        background: entry.isCompleted
                                            ? 'rgba(22, 163, 74, 0.06)'
                                            : 'var(--bg-secondary)',
                                        border: `1px solid ${
                                            entry.isCompleted ? 'rgba(22, 163, 74, 0.35)' : 'var(--border-light)'
                                        }`
                                    }}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                                <i
                                                    className={
                                                        entry.isCompleted
                                                            ? 'fas fa-check-circle text-[11px]'
                                                            : 'fas fa-exclamation-circle text-[11px]'
                                                    }
                                                    style={{
                                                        color: entry.isCompleted ? '#16a34a' : '#d97706'
                                                    }}
                                                />
                                                <span
                                                    className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                                    style={{
                                                        background: sevPalette.bg,
                                                        color: sevPalette.color
                                                    }}
                                                >
                                                    {issue.severity}
                                                </span>
                                                {entry.isCompleted && (
                                                    <span
                                                        className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                                        style={{
                                                            background: 'rgba(22, 163, 74, 0.15)',
                                                            color: '#15803d'
                                                        }}
                                                    >
                                                        Resolved
                                                    </span>
                                                )}
                                            </div>
                                            <div
                                                className="text-[12.5px] leading-snug"
                                                style={{ color: 'var(--text-primary)' }}
                                            >
                                                {issue.issue}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onDeleteIssue(issue.id)}
                                            title="Delete issue"
                                            className="rounded border-none cursor-pointer flex items-center justify-center"
                                            style={{
                                                background: 'rgba(220, 38, 38, 0.12)',
                                                color: '#b91c1c',
                                                height: 22,
                                                width: 22
                                            }}
                                        >
                                            <i className="fas fa-trash text-[10px]" />
                                        </button>
                                    </div>
                                    <div
                                        className="flex items-center justify-between mt-1.5 pt-1.5 flex-wrap gap-2"
                                        style={{ borderTop: '1px solid var(--border-light)' }}
                                    >
                                        <div
                                            className="flex items-center gap-2.5 text-[11px]"
                                            style={{ color: 'var(--text-tertiary)' }}
                                        >
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
                                            <span
                                                className="text-[11px] font-semibold tabular-nums"
                                                style={{ color: '#15803d' }}
                                            >
                                                <i className="fas fa-check mr-1 text-[9px]" />
                                                {HistoryUtility.formatHistoryDate(issue.time_completed)}
                                            </span>
                                        )}
                                        {!entry.isCompleted && (
                                            <button
                                                onClick={() => onCompleteIssue(issue.id)}
                                                title="Mark as resolved"
                                                className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider rounded px-2 py-0.5 cursor-pointer border-none"
                                                style={{
                                                    background: 'rgba(22, 163, 74, 0.12)',
                                                    color: '#15803d'
                                                }}
                                            >
                                                <i className="fas fa-check text-[9px]" />
                                                Mark Resolved
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }
    const renderSimpleTimeline = (data, valueKey, title, emptyTitle, emptySubtitle, statsConfig) => {
        if (data.length === 0) {
            return <HistoryEmptyState title={emptyTitle} subtitle={emptySubtitle} />
        }
        const counts = HistoryUtility.countByKey(data, (e) => e[valueKey])
        const timeline = HistoryUtility.buildConsolidatedTimeline(data, valueKey, (e) => e[valueKey])
        const currentValue = data[data.length - 1][valueKey]
        return (
            <div className="flex flex-col gap-2.5">
                <StatCardGrid>
                    {statsConfig.map((stat, idx) => (
                        <StatCard
                            key={idx}
                            label={stat.label}
                            value={stat.value({ counts, currentValue, data, timeline })}
                        />
                    ))}
                </StatCardGrid>
                <TimelineSectionTitle title={title} />
                <div className="flex flex-col gap-0">
                    {timeline
                        .slice()
                        .reverse()
                        .map((entry, index) => (
                            <TimelineItem key={index} dotClassName="bg-accent" isLast={index >= timeline.length - 1}>
                                <TimelineHeader label={entry[valueKey]} isCurrent={entry.isCurrent} />
                                <TimelineMeta>
                                    <TimelineDate date={DateUtility.formatDate(entry.startDate)} />
                                    <TimelineDuration text={HistoryUtility.pluralizeDays(entry.days)} />
                                </TimelineMeta>
                            </TimelineItem>
                        ))}
                </div>
            </div>
        )
    }
    const renderPlantAssignments = () =>
        renderSimpleTimeline(
            plantData,
            'plant',
            'Assignment Timeline',
            'No plant assignment history available',
            'Plant assignments will appear here once they are recorded.',
            [
                { label: 'Current Plant', value: ({ currentValue }) => currentValue },
                { label: 'Total Transfers', value: ({ data }) => data.length },
                { label: 'Unique Plants', value: ({ counts }) => Object.keys(counts).length },
                { label: 'Most Frequent', value: ({ counts }) => HistoryUtility.findMostFrequent(counts) }
            ]
        )
    const renderStatusHistory = () =>
        renderSimpleTimeline(
            statusData,
            'status',
            'Status Timeline',
            'No status history available',
            'Status changes will appear here once they are recorded.',
            [
                { label: 'Current Status', value: ({ currentValue }) => currentValue },
                { label: 'Total Changes', value: ({ data }) => data.length },
                { label: 'Unique Statuses', value: ({ counts }) => Object.keys(counts).length },
                { label: 'Most Frequent', value: ({ counts }) => HistoryUtility.findMostFrequent(counts) }
            ]
        )
    const renderPositionHistory = () => {
        if (positionData.length === 0) {
            return (
                <HistoryEmptyState
                    title="No position history available"
                    subtitle="Position changes will appear here once they are recorded."
                />
            )
        }
        const positionCounts = HistoryUtility.countByKey(positionData, (e) => e.position)
        const totalChanges = positionData.length
        const currentPosition = positionData[positionData.length - 1].position
        const chartData = Object.entries(positionCounts)
            .map(([position, count]) => ({ count, percentage: ((count / totalChanges) * 100).toFixed(1), position }))
            .sort((a, b) => b.count - a.count)
        const timeline = HistoryUtility.buildConsolidatedTimeline(positionData, 'position', (e) => e.position)
        return (
            <div className="flex flex-col gap-3">
                <StatCardGrid>
                    <StatCard label="Current Position" value={currentPosition} />
                    <StatCard label="Total Changes" value={totalChanges} />
                    <StatCard label="Unique Positions" value={Object.keys(positionCounts).length} />
                    <StatCard label="Most Frequent" value={HistoryUtility.findMostFrequent(positionCounts)} />
                </StatCardGrid>
                <TimelineSectionTitle title="Position Timeline" />
                <div className="flex flex-col gap-0">
                    {timeline
                        .slice()
                        .reverse()
                        .map((entry, index) => (
                            <TimelineItem
                                key={index}
                                dotColor={entry.isCurrent ? '#16a34a' : 'var(--accent, #1e3a5f)'}
                                isLast={index >= timeline.length - 1}
                            >
                                <TimelineHeader label={entry.position} isCurrent={entry.isCurrent} />
                                <TimelineMeta>
                                    <TimelineDate
                                        date={`${DateUtility.formatDate(entry.startDate)}${
                                            entry.endDate ? ` - ${DateUtility.formatDate(entry.endDate)}` : ' - Present'
                                        }`}
                                    />
                                    <TimelineDuration text={HistoryUtility.formatDuration(entry.duration)} />
                                </TimelineMeta>
                            </TimelineItem>
                        ))}
                </div>
                <TimelineSectionTitle title="Position Distribution" />
                <div className="flex flex-col gap-1.5">
                    {chartData.map((data, index) => (
                        <div
                            key={index}
                            className="rounded p-2"
                            style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-light)'
                            }}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    {data.position}
                                </span>
                                <span
                                    className="text-[11px] font-mono tabular-nums"
                                    style={{ color: 'var(--text-tertiary)' }}
                                >
                                    {data.count} {data.count === 1 ? 'time' : 'times'} ·{' '}
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                        {data.percentage}%
                                    </span>
                                </span>
                            </div>
                            <div
                                className="h-1.5 rounded-full overflow-hidden"
                                style={{ background: 'var(--bg-tertiary)' }}
                            >
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        background: index === 0 ? 'var(--accent, #1e3a5f)' : 'var(--border-medium)',
                                        width: `${data.percentage}%`
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }
    const renderRatingsHistory = () => {
        if (ratingsData.length === 0) {
            return (
                <HistoryEmptyState
                    title="No rating history available"
                    subtitle="Rating changes will be charted here once they are recorded."
                />
            )
        }
        const avgRating = ratingsData.reduce((sum, d) => sum + d.rating, 0) / ratingsData.length
        const currentRating = ratingsData[ratingsData.length - 1].rating
        const highestRating = Math.max(...ratingsData.map((d) => d.rating))
        return (
            <div className="flex flex-col gap-4">
                <StatCardGrid>
                    <StatCard
                        label="Current Rating"
                        value={currentRating > 0 ? `${currentRating}\u2605` : 'None'}
                        sublabel={currentRating > 0 ? RATING_LABELS[currentRating] : undefined}
                    />
                    <StatCard label="Average Rating" value={`${avgRating.toFixed(1)}\u2605`} />
                    <StatCard label="Highest Rating" value={`${highestRating}\u2605`} />
                    <StatCard label="Total Changes" value={ratingsData.length} />
                </StatCardGrid>
                <TimelineSectionTitle title="Rating Timeline" />
                <div className="flex flex-col gap-0">
                    {ratingsData
                        .slice()
                        .reverse()
                        .map((entry, index) => (
                            <TimelineItem key={index} dotClassName="bg-accent" isLast={index >= ratingsData.length - 1}>
                                <TimelineHeader
                                    label={`${entry.rating}\u2605 - ${RATING_LABELS[entry.rating]}`}
                                    isCurrent={index === 0}
                                />
                                <TimelineMeta>
                                    <TimelineDate date={DateUtility.formatDate(entry.timestamp)} />
                                    <UserLabel userId={entry.changedBy} showIcon />
                                </TimelineMeta>
                            </TimelineItem>
                        ))}
                </div>
            </div>
        )
    }
    const renderMileageTracking = () => {
        if (mileageData.length === 0) {
            return (
                <HistoryEmptyState
                    title="No mileage history available"
                    subtitle="Mileage updates will be tracked here once they are recorded."
                />
            )
        }
        const currentMileage = mileageData[mileageData.length - 1].mileage
        const totalMileageChange = currentMileage - mileageData[0].mileage
        const avgMileage = mileageData.reduce((sum, d) => sum + d.mileage, 0) / mileageData.length
        const milestone = HistoryUtility.getMaintenanceMilestone(currentMileage)
        return (
            <div className="flex flex-col gap-4">
                <StatCardGrid>
                    <StatCard
                        label="Current Mileage"
                        value={currentMileage.toLocaleString()}
                        sublabel={milestone.label}
                    />
                    <StatCard
                        label="Total Change"
                        value={`${totalMileageChange > 0 ? '+' : ''}${totalMileageChange.toLocaleString()}`}
                        sublabel="miles tracked"
                    />
                    <StatCard label="Average" value={Math.round(avgMileage).toLocaleString()} sublabel="miles" />
                    <StatCard label="Updates" value={mileageData.length} sublabel="recorded" />
                </StatCardGrid>
                <TimelineSectionTitle title="Mileage Timeline" />
                <div className="flex flex-col gap-0">
                    {mileageData
                        .slice()
                        .reverse()
                        .map((entry, index) => {
                            const reversedIndex = mileageData.length - 1 - index
                            const milesDriven =
                                reversedIndex > 0 ? entry.mileage - mileageData[reversedIndex - 1].mileage : 0
                            const daysSince =
                                reversedIndex > 0
                                    ? HistoryUtility.daysBetween(mileageData[reversedIndex - 1].date, entry.date)
                                    : 0
                            return (
                                <TimelineItem
                                    key={index}
                                    dotClassName="bg-accent"
                                    isLast={index >= mileageData.length - 1}
                                >
                                    <TimelineHeader
                                        label={`${entry.mileage.toLocaleString()} miles`}
                                        isCurrent={index === 0}
                                    />
                                    <TimelineMeta>
                                        <TimelineDate date={DateUtility.formatDate(entry.timestamp)} />
                                        {milesDriven > 0 && daysSince > 0 && (
                                            <TimelineDuration
                                                text={`+${milesDriven.toLocaleString()} miles in ${HistoryUtility.pluralizeDays(daysSince)}`}
                                            />
                                        )}
                                    </TimelineMeta>
                                </TimelineItem>
                            )
                        })}
                </div>
            </div>
        )
    }
    const renderAssignmentsHistory = () => {
        if (assignmentsData.length === 0) {
            return (
                <HistoryEmptyState
                    title="No assignment history available"
                    subtitle="Vehicle assignments will be tracked here once they are recorded."
                />
            )
        }
        const mixerAssignments = assignmentsData.filter((a) => a.assignmentType === 'Mixer')
        const tractorAssignments = assignmentsData.filter((a) => a.assignmentType === 'Tractor')
        const totalAssignments = assignmentsData.filter((a) => a.isAssignment).length
        const currentMixer = mixerAssignments[mixerAssignments.length - 1]?.vehicleNumber ?? null
        const currentTractor = tractorAssignments[tractorAssignments.length - 1]?.vehicleNumber ?? null
        const buildAssignmentTimeline = () => {
            const timeline = []
            let currentMixerEntry = null
            let currentTractorEntry = null
            const calcDuration = (startDate, endDate) =>
                HistoryUtility.daysBetween(new Date(startDate), endDate ? new Date(endDate) : new Date())
            const finalizeEntry = (current, newTimestamp) => {
                if (!current?.vehicleNumber) return null
                current.endDate = newTimestamp
                current.duration = calcDuration(current.startDate, current.endDate)
                return { ...current }
            }
            assignmentsData.forEach((entry, idx) => {
                const isMixer = entry.assignmentType === 'Mixer'
                const currentEntry = isMixer ? currentMixerEntry : currentTractorEntry
                const finalized = finalizeEntry(currentEntry, entry.timestamp)
                if (finalized) timeline.push(finalized)
                if (entry.vehicleNumber) {
                    const newEntry = {
                        assignmentType: entry.assignmentType,
                        changedBy: entry.changedBy,
                        endDate: null,
                        isCurrent:
                            idx === assignmentsData.length - 1 ||
                            !assignmentsData.slice(idx + 1).some((e) => e.assignmentType === entry.assignmentType),
                        startDate: entry.timestamp,
                        vehicleNumber: entry.vehicleNumber
                    }
                    if (isMixer) currentMixerEntry = newEntry
                    else currentTractorEntry = newEntry
                } else {
                    if (isMixer) currentMixerEntry = null
                    else currentTractorEntry = null
                }
            })
            ;[currentMixerEntry, currentTractorEntry].forEach((e) => {
                if (e?.vehicleNumber) {
                    e.duration = calcDuration(e.startDate, new Date())
                    e.isCurrent = true
                    timeline.push(e)
                }
            })
            return timeline.sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
        }
        const consolidatedTimeline = buildAssignmentTimeline()
        return (
            <div className="flex flex-col gap-3">
                <StatCardGrid>
                    <StatCard label="Current Mixer" value={currentMixer ? `#${currentMixer}` : 'Not Assigned'} />
                    <StatCard label="Current Tractor" value={currentTractor ? `#${currentTractor}` : 'Not Assigned'} />
                    <StatCard label="Total Assignments" value={totalAssignments} />
                    <StatCard label="Assignment Changes" value={assignmentsData.length} />
                </StatCardGrid>
                <TimelineSectionTitle title="Assignment Timeline" />
                <div className="flex flex-col gap-0">
                    {consolidatedTimeline.map((entry, index) => (
                        <TimelineItem
                            key={index}
                            dotColor={entry.isCurrent ? '#16a34a' : 'var(--accent, #1e3a5f)'}
                            isLast={index >= consolidatedTimeline.length - 1}
                        >
                            <TimelineHeader
                                label={`${entry.assignmentType} #${entry.vehicleNumber}`}
                                isCurrent={entry.isCurrent}
                            />
                            <TimelineMeta>
                                <TimelineDate
                                    date={`${DateUtility.formatDate(entry.startDate)}${
                                        entry.endDate ? ` - ${DateUtility.formatDate(entry.endDate)}` : ' - Present'
                                    }`}
                                />
                                <TimelineDuration text={HistoryUtility.formatDuration(entry.duration)} />
                            </TimelineMeta>
                            <div className="mt-1">
                                <UserLabel userId={entry.changedBy} showIcon />
                            </div>
                        </TimelineItem>
                    ))}
                </div>
            </div>
        )
    }
    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-slate-500">
                    <LoadingScreen message="Loading history..." inline />
                </div>
            )
        }
        if (error) {
            return (
                <div className="text-center py-8 text-red-600">
                    <p>{error}</p>
                    <button
                        className="bg-red-600 text-white border-none rounded-lg px-5 py-2.5 mt-4 text-sm font-semibold cursor-pointer hover:bg-red-700"
                        onClick={fetchHistory}
                    >
                        Retry
                    </button>
                </div>
            )
        }
        if (history.length === 0 && activeTab !== 'timeline') {
            return (
                <HistoryEmptyState
                    title={`No history records found for this ${type}.`}
                    subtitle={`History entries will appear here when changes are made to this ${type}.`}
                />
            )
        }
        switch (activeTab) {
            case 'timeline':
                return (
                    <div className="flex gap-5">
                        <div
                            className="flex flex-col gap-3 min-w-0 pr-1 transition-all duration-500 ease-in-out"
                            style={{ flex: analysisVisible ? '3' : '1' }}
                        >
                            {sortedHistory.length === 0 ? (
                                <HistoryEmptyState
                                    title={`No history records found for this ${type}.`}
                                    subtitle={`History entries will appear here when changes are made to this ${type}.`}
                                />
                            ) : (
                                sortedHistory.map((entry, index) => {
                                    const fieldName = entry.fieldName ?? entry.field_name
                                    const isCreatedEntry = fieldName === 'created'
                                    return (
                                        <div
                                            key={entry.id ?? index}
                                            className="rounded p-2.5"
                                            style={{
                                                background: 'var(--bg-secondary)',
                                                border: '1px solid var(--border-light)'
                                            }}
                                        >
                                            <div className="flex justify-between items-center mb-1.5">
                                                <div
                                                    className="text-[12.5px] font-semibold capitalize"
                                                    style={{ color: 'var(--text-primary)' }}
                                                >
                                                    {HistoryUtility.formatFieldName(fieldName, type)}
                                                </div>
                                                <div
                                                    className="text-[11px] tabular-nums"
                                                    style={{ color: 'var(--text-tertiary)' }}
                                                >
                                                    {HistoryUtility.formatHistoryTimestamp(
                                                        entry.changedAt ?? entry.changed_at
                                                    )}
                                                </div>
                                            </div>
                                            {isCreatedEntry ? (
                                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                    <span
                                                        className="text-[12px] font-semibold"
                                                        style={{ color: '#15803d' }}
                                                    >
                                                        {formatValue(fieldName, entry.newValue ?? entry.new_value)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
                                                    <span
                                                        className="text-[12px]"
                                                        style={{ color: 'var(--text-tertiary)' }}
                                                    >
                                                        <span className="text-[9.5px] font-bold uppercase tracking-wider mr-1">
                                                            From
                                                        </span>
                                                        {formatValue(fieldName, entry.oldValue ?? entry.old_value)}
                                                    </span>
                                                    <i
                                                        className="fas fa-arrow-right text-[10px]"
                                                        style={{ color: 'var(--accent, #1e3a5f)' }}
                                                    />
                                                    <span
                                                        className="text-[12px] font-semibold"
                                                        style={{ color: 'var(--text-primary)' }}
                                                    >
                                                        <span className="text-[9.5px] font-bold uppercase tracking-wider mr-1">
                                                            To
                                                        </span>
                                                        {formatValue(fieldName, entry.newValue ?? entry.new_value)}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                                <UserLabel userId={entry.changedBy ?? entry.changed_by} showIcon />
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                        <div
                            className="min-w-0 transition-all duration-500 ease-in-out"
                            style={{
                                borderColor: 'var(--border-light)',
                                borderLeftWidth: analysisVisible ? '1px' : '0px',
                                flex: analysisVisible ? '2' : '0',
                                opacity: analysisVisible ? 1 : 0,
                                overflow: 'hidden',
                                paddingLeft: analysisVisible ? '1.25rem' : '0px'
                            }}
                        >
                            {renderAISummary()}
                        </div>
                    </div>
                )
            case 'cleanliness':
                return (
                    <RatingChart
                        data={cleanlinessData}
                        title="Cleanliness Rating Over Time"
                        emptyTitle="No cleanliness rating history available"
                        emptySubtitle="Cleanliness ratings will be charted here once they are recorded."
                    />
                )
            case 'condition':
                return (
                    <RatingChart
                        data={conditionData}
                        title="Condition Rating Over Time"
                        emptyTitle="No condition rating history available"
                        emptySubtitle="Condition ratings will be charted here once they are recorded."
                    />
                )
            case 'overview':
                return renderOverviewChart()
            case 'operators':
                return renderOperatorChart()
            case 'service':
                return renderServiceHistory()
            case 'plant':
                return renderPlantAssignments()
            case 'status':
                return renderStatusHistory()
            case 'position':
                return renderPositionHistory()
            case 'ratings':
                return renderRatingsHistory()
            case 'mileage':
                return renderMileageTracking()
            case 'assignments':
                return renderAssignmentsHistory()
            default:
                return null
        }
    }
    const tabs = [
        { id: 'timeline', label: 'Timeline', show: true },
        { id: 'overview', label: 'Overview', show: ASSET_TYPES_WITH_OVERVIEW.includes(type) },
        { id: 'operators', label: 'Operators', show: ASSET_TYPES_WITH_OPERATORS.includes(type) },
        { id: 'service', label: 'Service History', show: ASSET_TYPES_WITH_SERVICE.includes(type) },
        { id: 'plant', label: 'Plant Assignments', show: ASSET_TYPES_WITH_PLANT.includes(type) },
        { id: 'status', label: 'Status History', show: type === 'operator' || type === 'pickup-truck' },
        { id: 'position', label: 'Position History', show: type === 'operator' },
        { id: 'ratings', label: 'Ratings History', show: type === 'operator' },
        { id: 'assignments', label: 'Assignments', show: type === 'operator' },
        { id: 'mileage', label: 'Mileage Tracking', show: type === 'pickup-truck' },
        { id: 'condition', label: 'Condition', show: type === 'equipment' },
        { id: 'cleanliness', label: 'Cleanliness', show: ASSET_TYPES_WITH_CLEANLINESS.includes(type) }
    ]
    if (typeof document === 'undefined' || !document.body) return null
    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 flex items-center justify-center z-[2000] p-4"
            style={{ background: 'rgba(15, 23, 42, 0.65)' }}
        >
            <div
                className="flex flex-col max-w-[900px] w-full max-h-[85vh] rounded overflow-hidden"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
            >
                <div
                    className="flex justify-between items-center px-4 py-3"
                    style={{ borderBottom: '1px solid var(--border-light)' }}
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div
                            className="w-7 h-7 rounded flex items-center justify-center shrink-0"
                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                        >
                            <i className="fas fa-history text-[12px]" />
                        </div>
                        <div className="min-w-0">
                            <div
                                className="text-[10px] font-semibold uppercase tracking-wider"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                Change History
                            </div>
                            <h2
                                className="text-[14px] font-semibold m-0 truncate"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                {itemName}
                            </h2>
                        </div>
                    </div>
                    <button
                        className="w-7 h-7 flex items-center justify-center rounded transition-colors"
                        style={{ background: 'transparent', color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={onClose}
                    >
                        <i className="fas fa-times text-[12px]" />
                    </button>
                </div>
                <div
                    className="flex gap-1.5 px-4 py-2 overflow-x-auto shrink-0"
                    style={{
                        background: 'var(--bg-secondary)',
                        borderBottom: '1px solid var(--border-light)'
                    }}
                >
                    {tabs
                        .filter((t) => t.show)
                        .map((tab) => (
                            <TabButton
                                key={tab.id}
                                label={tab.label}
                                isActive={activeTab === tab.id}
                                onClick={() => setActiveTab(tab.id)}
                            />
                        ))}
                </div>
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto px-4 py-3 min-h-0"
                    style={{ background: 'var(--bg-primary)' }}
                >
                    {renderContent()}
                </div>
                <div
                    className="px-4 py-2.5 flex justify-end"
                    style={{
                        background: 'var(--bg-secondary)',
                        borderTop: '1px solid var(--border-light)'
                    }}
                >
                    <button
                        className="rounded px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider transition-colors"
                        style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-light)',
                            color: 'var(--text-primary)'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-primary)')}
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
export default HistoryViewSection
