import { useEffect, useRef, useState } from 'react'

/**
 * Hides the analysis panel once the user has scrolled the attached container
 * past one of its own heights, and brings it back on the way up. Attach
 * `scrollContainerRef` to the scrolling element; the listener only runs while
 * the timeline tab is active, so `analysisVisible` holds its last value on
 * the other tabs.
 */
export default function useHistoryAnalysisScrollCollapse(activeTab) {
    const scrollContainerRef = useRef(null)
    const [analysisVisible, setAnalysisVisible] = useState(true)

    useEffect(() => {
        if (activeTab !== 'timeline') return
        const container = scrollContainerRef.current
        if (!container) return
        const threshold = container.clientHeight
        const onScroll = () => {
            setAnalysisVisible(container.scrollTop < threshold)
        }
        container.addEventListener('scroll', onScroll, { passive: true })
        onScroll()
        return () => container.removeEventListener('scroll', onScroll)
    }, [activeTab])

    return { analysisVisible, scrollContainerRef }
}
