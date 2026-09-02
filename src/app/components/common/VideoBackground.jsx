/* eslint-disable react/forbid-dom-props */
import React, { memo, useRef, useState } from 'react'

import { BACKGROUND_VIDEO_URLS } from '../../constants/assetUrls'
import { useAccentColor } from '../../hooks/useAccentColor'

/** Pool of background videos randomly selected on mount. */
const BACKGROUND_VIDEOS = BACKGROUND_VIDEO_URLS
const TRIM_END_SECONDS = 10

// The sign-in screen is written into the document at build time, so the clip
// behind it has to be named before the bundle runs or the browser has nothing
// to ask for until it does. The document makes that choice and fills in the
// source the prerender left empty; the choice is read back here so the element
// React renders names the file already in flight rather than a second one.
//
// It belongs to the visit rather than to the component, so it is taken once. A
// later mount - the password recovery screen, the locked overlay - selects for
// itself the way it always has.
let documentChoice = null
if (typeof window !== 'undefined') {
    const chosen = window.__smyrnaBackgroundVideo
    if (Number.isInteger(chosen) && chosen >= 0 && chosen < BACKGROUND_VIDEOS.length) documentChoice = chosen
}

function initialVideoIndex() {
    if (documentChoice !== null) {
        const chosen = documentChoice
        documentChoice = null
        return chosen
    }
    // Nothing but the render itself runs in the prerender, and the clip is not
    // its to pick: an empty source is what leaves the choice to the visit.
    if (typeof window === 'undefined') return null
    return Math.floor(Math.random() * BACKGROUND_VIDEOS.length)
}

/**
 * Ambient looping video background with a gradient underlay and dark overlay.
 * Randomly selects one video on mount.
 */
const VideoBackground = memo(function VideoBackground({ className = '' }) {
    const [currentVideoIndex, setCurrentVideoIndex] = useState(initialVideoIndex)
    const [showVideo, setShowVideo] = useState(false)
    const videoRef = useRef(null)
    const hasStartedRef = useRef(false)
    const skippingRef = useRef(false)
    const accentColor = useAccentColor()
    const handleCanPlay = () => {
        if (!videoRef.current || hasStartedRef.current) return
        hasStartedRef.current = true
        videoRef.current
            .play()
            .then(() => setShowVideo(true))
            .catch(() => setShowVideo(true))
    }
    const advanceVideo = () => {
        if (skippingRef.current) return
        skippingRef.current = true
        setShowVideo(false)
        setTimeout(() => {
            setCurrentVideoIndex((prev) => ((prev ?? 0) + 1) % BACKGROUND_VIDEOS.length)
            hasStartedRef.current = false
            skippingRef.current = false
        }, 1000)
    }
    const handleTimeUpdate = () => {
        const video = videoRef.current
        if (!video || !video.duration || skippingRef.current) return
        if (video.currentTime >= video.duration - TRIM_END_SECONDS) {
            advanceVideo()
        }
    }
    return (
        <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
            <div
                className="absolute inset-0 z-base"
                style={{ background: `linear-gradient(135deg, var(--video-scrim-start) 0%, ${accentColor} 100%)` }}
            />
            <video
                key={currentVideoIndex}
                ref={videoRef}
                autoPlay
                muted
                playsInline
                preload="auto"
                onCanPlay={handleCanPlay}
                onTimeUpdate={handleTimeUpdate}
                onEnded={advanceVideo}
                className={`absolute left-1/2 top-1/2 z-media min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 object-cover transition-opacity duration-1000 motion-reduce:transition-none ${showVideo ? 'opacity-100' : 'opacity-[0.02]'}`}
            >
                <source
                    data-ambient-clip
                    src={currentVideoIndex === null ? undefined : BACKGROUND_VIDEOS[currentVideoIndex]}
                    type="video/mp4"
                />
            </video>
            <div className="absolute inset-0 z-scrim bg-black/40" />
        </div>
    )
})
export default VideoBackground
