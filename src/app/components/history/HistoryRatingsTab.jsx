import React from 'react'

import { DateUtility } from '../../../utils/DateUtility'
import { RATING_LABELS } from '../../constants/historyConstants'
import UserLabel from '../common/UserLabel'
import HistoryEmptyState from '../ui/HistoryEmptyState'
import StatCard from '../ui/StatCard'
import StatCardGrid from '../ui/StatCardGrid'
import TimelineItem, { TimelineDate, TimelineHeader, TimelineMeta, TimelineSectionTitle } from '../ui/TimelineItem'

/**
 * Operator ratings tab: shows current/average/highest stats plus a reverse-
 * chronological timeline of every rating change with the author.
 */
export default function HistoryRatingsTab({ ratingsData }) {
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
                    value={currentRating > 0 ? `${currentRating}★` : 'None'}
                    sublabel={currentRating > 0 ? RATING_LABELS[currentRating] : undefined}
                />
                <StatCard label="Average Rating" value={`${avgRating.toFixed(1)}★`} />
                <StatCard label="Highest Rating" value={`${highestRating}★`} />
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
                                label={`${entry.rating}★ - ${RATING_LABELS[entry.rating]}`}
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
