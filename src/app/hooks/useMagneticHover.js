import { useCallback, useEffect, useRef } from 'react'

import { useReducedMotion } from './useReducedMotion'

const MAGNETIC_RADIUS_PX = 80
const MAX_DISPLACEMENT_PX = 8
const LERP_SPEED = 0.08
const RESET_LERP_SPEED = 0.1
/**
 * Pulls registered elements toward the cursor while it is within
 * MAGNETIC_RADIUS_PX, easing them back to rest once it leaves.
 *
 * A single animation frame loop drives every registered element, so a
 * container wires `handleMouseMove` / `handleMouseLeave` once at its own
 * level and passes `registerElement` as a ref callback to each child rather
 * than each child running its own listeners. Displacement is written straight
 * to `style.transform`, bypassing React, and the current offset is parked on
 * the element itself so the loop holds no per-element state. Elements
 * detached from the document are dropped on the next frame, which is the only
 * unregister path.
 *
 * Under reduced motion no frame loop runs at all and registered elements keep
 * their resting position, so the hook still returns the same three callbacks
 * and a container needs no branch of its own.
 *
 * @returns {{
 *   registerElement: (el: HTMLElement | null) => void,
 *   handleMouseMove: (e: MouseEvent) => void,
 *   handleMouseLeave: () => void
 * }}
 */
export function useMagneticHover() {
    const elementsRef = useRef(new Set())
    const mouseRef = useRef({ x: -9999, y: -9999 })
    const animFrameRef = useRef(null)
    const activeRef = useRef(true)
    const reducedMotion = useReducedMotion()
    const registerElement = useCallback((el) => {
        if (!el) return
        elementsRef.current.add(el)
        el._magneticOffset = { x: 0, y: 0 }
    }, [])
    const handleMouseMove = useCallback((e) => {
        mouseRef.current = { x: e.clientX, y: e.clientY }
    }, [])
    const handleMouseLeave = useCallback(() => {
        mouseRef.current = { x: -9999, y: -9999 }
    }, [])
    useEffect(() => {
        if (reducedMotion) {
            activeRef.current = false
            elementsRef.current.forEach((el) => {
                el._magneticOffset = { x: 0, y: 0 }
                el.style.transform = ''
            })
            return undefined
        }
        activeRef.current = !document.hidden
        const animate = () => {
            if (!activeRef.current) return
            const { x: mx, y: my } = mouseRef.current
            elementsRef.current.forEach((el) => {
                if (!el.isConnected) {
                    elementsRef.current.delete(el)
                    return
                }
                const rect = el.getBoundingClientRect()
                const centerX = rect.left + rect.width / 2
                const centerY = rect.top + rect.height / 2
                const dx = mx - centerX
                const dy = my - centerY
                const distance = Math.sqrt(dx * dx + dy * dy)
                const offset = el._magneticOffset ?? { x: 0, y: 0 }
                let targetX = 0
                let targetY = 0
                let speed = RESET_LERP_SPEED
                // The off-screen sentinel that handleMouseLeave parks the
                // cursor at is negative, so the positive-x test keeps a
                // departed cursor from attracting elements near the origin.
                if (distance < MAGNETIC_RADIUS_PX && mx > 0) {
                    // Squaring the falloff makes the pull ramp up sharply near
                    // the element instead of tracking the cursor linearly.
                    const strength = 1 - distance / MAGNETIC_RADIUS_PX
                    const easedStrength = strength * strength
                    targetX = (dx / distance) * easedStrength * MAX_DISPLACEMENT_PX
                    targetY = (dy / distance) * easedStrength * MAX_DISPLACEMENT_PX
                    speed = LERP_SPEED
                }
                offset.x += (targetX - offset.x) * speed
                offset.y += (targetY - offset.y) * speed
                // The lerp only approaches zero asymptotically, so a resting
                // element would keep a sub-pixel transform forever. Snapping
                // clears the transform entirely once it is imperceptible.
                if (Math.abs(offset.x) < 0.1 && Math.abs(offset.y) < 0.1 && targetX === 0 && targetY === 0) {
                    offset.x = 0
                    offset.y = 0
                    el.style.transform = ''
                } else {
                    el.style.transform = `translate(${offset.x}px, ${offset.y}px)`
                }
                el._magneticOffset = offset
            })
            animFrameRef.current = requestAnimationFrame(animate)
        }
        // A hidden tab has no cursor to follow, so the loop is torn down
        // rather than left to run behind whatever the reader switched to,
        // and picked back up when the tab returns.
        const handleVisibility = () => {
            if (document.hidden) {
                activeRef.current = false
                if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
                animFrameRef.current = null
                return
            }
            if (activeRef.current) return
            activeRef.current = true
            mouseRef.current = { x: -9999, y: -9999 }
            animFrameRef.current = requestAnimationFrame(animate)
        }
        document.addEventListener('visibilitychange', handleVisibility)
        if (activeRef.current) animFrameRef.current = requestAnimationFrame(animate)
        return () => {
            activeRef.current = false
            document.removeEventListener('visibilitychange', handleVisibility)
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        }
    }, [reducedMotion])
    return { handleMouseLeave, handleMouseMove, registerElement }
}
