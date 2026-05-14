import React, { useEffect, useRef, useState } from 'react'

/** Wraps a result block so it fades + slides in on mount and fades out
 *  before unmounting. Drives the entrance/exit animation for every panel
 *  in the right-hand recommendations column so swapping between idle /
 *  loading / advice / conflict states never just snaps. The last live
 *  children are stashed in a ref so a state flip that simultaneously
 *  hides this branch AND nullifies its inner data (e.g. `top` going null
 *  on reset) still has something to fade out instead of vanishing. */
export default function FadeIn({ children, delayMs = 0, show }) {
    const [mounted, setMounted] = useState(show)
    const [visible, setVisible] = useState(false)
    const lastChildrenRef = useRef(children)
    if (show && children) lastChildrenRef.current = children

    useEffect(() => {
        let timer
        if (show) {
            setMounted(true)
            timer = setTimeout(() => setVisible(true), delayMs + 20)
        } else {
            setVisible(false)
            timer = setTimeout(() => setMounted(false), 400)
        }
        return () => clearTimeout(timer)
    }, [show, delayMs])

    if (!mounted) return null

    return (
        <div
            className={`transition-all duration-500 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
        >
            {show ? children : lastChildrenRef.current}
        </div>
    )
}
