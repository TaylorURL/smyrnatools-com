import { useEffect, useState } from 'react'

const MOBILE_BREAKPOINT = 768
/**
 * True while the viewport is narrower than the mobile breakpoint. This is a
 * width test only — it says nothing about the input device or platform.
 */
export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT)
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])
    return isMobile
}
