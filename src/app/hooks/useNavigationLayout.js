import { useEffect, useState } from 'react'

const TABLET_MIN = 768
const TABLET_MAX = 1024

export function useIsTablet() {
    const [isTablet, setIsTablet] = useState(window.innerWidth >= TABLET_MIN && window.innerWidth < TABLET_MAX)
    useEffect(() => {
        const handleResize = () => {
            setIsTablet(window.innerWidth >= TABLET_MIN && window.innerWidth < TABLET_MAX)
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])
    return isTablet
}
