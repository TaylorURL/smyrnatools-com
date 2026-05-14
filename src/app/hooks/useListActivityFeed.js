import { useEffect, useState } from 'react'

import { ListService } from '../../services/ListService'

/**
 * Lazily loads the recent task-activity feed only when the activity view mode
 * is selected. Cancels in-flight requests on cleanup so quick mode-switching
 * doesn't clobber state with stale data.
 */
export function useListActivityFeed(viewMode) {
    const [activityFeed, setActivityFeed] = useState([])
    const [activityProfiles, setActivityProfiles] = useState({})
    const [activityLoading, setActivityLoading] = useState(false)

    useEffect(() => {
        if (viewMode !== 'activity') return undefined
        let cancelled = false
        const loadActivity = async () => {
            setActivityLoading(true)
            try {
                const { entries, profiles } = await ListService.fetchActivityFeed({ limit: 100 })
                if (cancelled) return
                setActivityFeed(entries)
                setActivityProfiles(profiles)
            } catch {
                if (!cancelled) setActivityFeed([])
            } finally {
                if (!cancelled) setActivityLoading(false)
            }
        }
        loadActivity()
        return () => {
            cancelled = true
        }
    }, [viewMode])

    return { activityFeed, activityLoading, activityProfiles }
}
