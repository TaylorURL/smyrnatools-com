import { useEffect, useRef, useState } from 'react'

import { AI_TYPEWRITER_CHARS_PER_TICK, AI_TYPEWRITER_TICK_MS } from '../constants/historyConstants'

/**
 * Reveals an AI summary a few characters at a time, returning the visible
 * prefix and a flag for when the reveal has finished. A new `aiSummary`
 * restarts the reveal from empty; the same value re-supplied leaves the
 * in-progress reveal alone, so a re-render mid-animation does not rewind it.
 */
export default function useHistoryAiTypewriter(aiSummary) {
    const [displayText, setDisplayText] = useState('')
    const [isTypingComplete, setIsTypingComplete] = useState(false)
    const previousSummaryRef = useRef(null)

    useEffect(() => {
        if (!aiSummary) {
            previousSummaryRef.current = null
            setDisplayText('')
            setIsTypingComplete(false)
            return
        }
        if (aiSummary === previousSummaryRef.current) return
        previousSummaryRef.current = aiSummary
        setDisplayText('')
        setIsTypingComplete(false)
        let currentIndex = 0
        const interval = setInterval(() => {
            if (currentIndex < aiSummary.length) {
                currentIndex = Math.min(currentIndex + AI_TYPEWRITER_CHARS_PER_TICK, aiSummary.length)
                setDisplayText(aiSummary.slice(0, currentIndex))
            } else {
                clearInterval(interval)
                setIsTypingComplete(true)
            }
        }, AI_TYPEWRITER_TICK_MS)
        return () => clearInterval(interval)
    }, [aiSummary])

    return { displayText, isTypingComplete }
}
