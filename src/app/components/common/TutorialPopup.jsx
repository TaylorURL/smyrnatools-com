/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useId, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

import { useTutorial } from '../../context/TutorialContext'
import { useAccentColor } from '../../hooks/useAccentColor'

/**
 * Registry of all available tutorial definitions.
 * Each key maps to positioning, target selector, and content for the popup.
 */
const TUTORIALS = {
    'account-nav-hint': {
        arrowPosition: 'top-right',
        message: 'Click on your profile to access account settings and customize your preferences.',
        position: 'bottom-left',
        targetSelector: '[data-tutorial-target="account-nav"]',
        title: 'Customize your experience'
    },
    'preferences-tab-hint': {
        arrowPosition: 'left',
        message: 'Check out the Preferences tab to customize your accent color and other settings.',
        position: 'right',
        targetSelector: '[data-tutorial-target="preferences-tab"]',
        title: 'Preferences tab'
    }
}
/**
 * The pointer on the bubble's edge, aimed at the target: a small square turned
 * 45 degrees, half of it outside the bubble. Only the two sides that face out
 * carry the border, so the inner half disappears into the bubble's own fill.
 */
const ARROWS = {
    bottom: {
        // Sits over the footer, so it takes the footer's fill.
        className: 'border-b border-r bg-bg-secondary',
        style: { bottom: -6, left: '50%', transform: 'translateX(-50%) rotate(45deg)' }
    },
    left: {
        className: 'border-b border-l bg-bg-primary',
        style: { left: -6, top: '50%', transform: 'translateY(-50%) rotate(45deg)' }
    },
    right: {
        className: 'border-r border-t bg-bg-primary',
        style: { right: -6, top: '50%', transform: 'translateY(-50%) rotate(45deg)' }
    },
    top: {
        className: 'border-l border-t bg-bg-primary',
        style: { left: '50%', top: -6, transform: 'translateX(-50%) rotate(45deg)' }
    },
    'top-left': {
        className: 'border-l border-t bg-bg-primary',
        style: { left: 16, top: -6, transform: 'rotate(45deg)' }
    },
    'top-right': {
        className: 'border-l border-t bg-bg-primary',
        style: { right: 16, top: -6, transform: 'rotate(45deg)' }
    }
}

/**
 * @param {Object} props
 * @param {string} props.tutorialId - Key into the TUTORIALS registry.
 * @param {Function} props.onDismiss - Callback invoked when the user clicks "Got it".
 */
function TutorialPopup({ tutorialId, onDismiss }) {
    const accentColor = useAccentColor()
    const [position, setPosition] = useState(null)
    const [targetRect, setTargetRect] = useState(null)
    const [isReady, setIsReady] = useState(false)
    const popupRef = useRef(null)
    const titleId = useId()
    const messageId = useId()
    const tutorial = TUTORIALS[tutorialId]
    useEffect(() => {
        if (!tutorial) return
        let attempts = 0
        const maxAttempts = 20
        // The target element may not be mounted or laid out when the popup
        // first renders, so measurement polls until the target exists and has
        // non-zero size before positioning and revealing the popup.
        const tryCalculatePosition = () => {
            const target = document.querySelector(tutorial.targetSelector)
            const popupEl = popupRef.current
            if (!target || !popupEl) {
                attempts++
                if (attempts < maxAttempts) {
                    setTimeout(tryCalculatePosition, 100)
                }
                return
            }
            const tRect = target.getBoundingClientRect()
            if (tRect.width === 0 || tRect.height === 0) {
                attempts++
                if (attempts < maxAttempts) {
                    setTimeout(tryCalculatePosition, 100)
                }
                return
            }
            const popupRect = popupEl.getBoundingClientRect()
            const padding = 12
            const newTargetRect = {
                bottom: tRect.bottom,
                height: tRect.height,
                left: tRect.left,
                right: tRect.right,
                top: tRect.top,
                width: tRect.width
            }
            let top, left
            switch (tutorial.position) {
                case 'bottom':
                    top = tRect.bottom + padding
                    left = tRect.left + tRect.width / 2 - popupRect.width / 2
                    break
                case 'bottom-left':
                    top = tRect.bottom + padding
                    left = tRect.right - popupRect.width
                    break
                case 'bottom-right':
                    top = tRect.bottom + padding
                    left = tRect.left
                    break
                case 'top':
                    top = tRect.top - popupRect.height - padding
                    left = tRect.left + tRect.width / 2 - popupRect.width / 2
                    break
                case 'left':
                    top = tRect.top + tRect.height / 2 - popupRect.height / 2
                    left = tRect.left - popupRect.width - padding
                    break
                case 'right':
                    top = tRect.top + tRect.height / 2 - popupRect.height / 2
                    left = tRect.right + padding
                    break
                default:
                    top = tRect.bottom + padding
                    left = tRect.left
            }
            left = Math.max(12, Math.min(left, window.innerWidth - popupRect.width - 12))
            top = Math.max(12, Math.min(top, window.innerHeight - popupRect.height - 12))
            setTargetRect(newTargetRect)
            setPosition({ left, top })
            setIsReady(true)
        }
        const timer = setTimeout(tryCalculatePosition, 200)
        const handleUpdate = () => {
            if (isReady) {
                const target = document.querySelector(tutorial.targetSelector)
                if (target) {
                    const tRect = target.getBoundingClientRect()
                    setTargetRect({
                        bottom: tRect.bottom,
                        height: tRect.height,
                        left: tRect.left,
                        right: tRect.right,
                        top: tRect.top,
                        width: tRect.width
                    })
                }
            }
        }
        window.addEventListener('resize', handleUpdate)
        window.addEventListener('scroll', handleUpdate, { capture: true, passive: true })
        return () => {
            clearTimeout(timer)
            window.removeEventListener('resize', handleUpdate)
            window.removeEventListener('scroll', handleUpdate, { capture: true })
        }
    }, [tutorial, tutorialId, isReady])
    if (!tutorial) return null
    const arrow = ARROWS[tutorial.arrowPosition]
    return ReactDOM.createPortal(
        <>
            {isReady && (
                <>
                    <svg aria-hidden="true" className="pointer-events-none fixed inset-0 z-tour-cutout h-full w-full">
                        <defs>
                            <mask id="tutorial-mask">
                                <rect fill="white" height="100%" width="100%" x="0" y="0" />
                                {targetRect && (
                                    <rect
                                        fill="black"
                                        height={targetRect.height + 16}
                                        rx="10"
                                        width={targetRect.width + 16}
                                        x={targetRect.left - 8}
                                        y={targetRect.top - 8}
                                    />
                                )}
                            </mask>
                        </defs>
                        <rect
                            height="100%"
                            mask="url(#tutorial-mask)"
                            style={{ fill: 'var(--scrim-cutout)' }}
                            width="100%"
                            x="0"
                            y="0"
                        />
                    </svg>
                    {targetRect && (
                        <div
                            className="pointer-events-none fixed z-tour-halo box-border rounded-card animate-tutorial-pulse motion-reduce:animate-none"
                            style={{
                                '--tutorial-accent': accentColor,
                                border: `2px solid ${accentColor}`,
                                height: targetRect.height + 16,
                                left: targetRect.left - 8,
                                top: targetRect.top - 8,
                                width: targetRect.width + 16
                            }}
                        />
                    )}
                </>
            )}
            <div
                ref={popupRef}
                role="dialog"
                aria-modal="false"
                aria-labelledby={titleId}
                aria-describedby={messageId}
                className={`fixed z-app-state w-[280px] rounded-modal border border-border-light bg-bg-primary shadow-modal transition-opacity duration-200 ease-out motion-reduce:transition-none ${isReady ? 'visible opacity-100' : 'invisible opacity-0'}`}
                style={{
                    left: position ? position.left : -9999,
                    top: position ? position.top : -9999
                }}
            >
                {arrow && (
                    <span
                        aria-hidden="true"
                        className={`absolute h-2.5 w-2.5 border-border-light ${arrow.className}`}
                        style={arrow.style}
                    />
                )}
                <div className="px-4 pb-4 pt-3.5">
                    <h2 id={titleId} className="m-0 text-[15px] font-medium leading-snug text-text-primary">
                        {tutorial.title}
                    </h2>
                    <p id={messageId} className="m-0 mt-1 text-[13px] leading-relaxed text-text-secondary">
                        {tutorial.message}
                    </p>
                </div>
                <div className="flex justify-end gap-2 rounded-b-modal border-t border-border-light bg-bg-secondary px-4 py-3">
                    <button type="button" onClick={onDismiss} className="btn-primary">
                        Got it
                    </button>
                </div>
            </div>
        </>,
        document.body
    )
}
/**
 * Context-driven manager that renders the currently active tutorial popup.
 * Consumes TutorialContext to determine which tutorial (if any) to display.
 */
function TutorialManager() {
    const { activeTutorial, dismissTutorial } = useTutorial()
    if (!activeTutorial) return null
    return <TutorialPopup tutorialId={activeTutorial} onDismiss={() => dismissTutorial(activeTutorial)} />
}
export { TutorialManager, TutorialPopup }
export default TutorialManager
