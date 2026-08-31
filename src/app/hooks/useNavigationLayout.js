import { useCallback, useEffect, useRef, useState } from 'react'

import { getCategoryForView } from '../constants/navigationConstants'

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

export function useDropdownOutsideClose(openDropdown, setOpenDropdown) {
    const dropdownRef = useRef(null)
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpenDropdown(null)
            }
        }
        if (openDropdown) document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [openDropdown, setOpenDropdown])
    return dropdownRef
}

/** Outside-click close for the mobile drawer. Inert outside two-level mode,
 *  where the drawer has its own dismissal. */
export function useMobileDrawerOutsideClose(isMobile, mobileMenuOpen, isTwoLevel, setMobileMenuOpen) {
    const mobileDrawerRef = useRef(null)
    useEffect(() => {
        if (!isMobile || !mobileMenuOpen || !isTwoLevel) return
        const handleClickOutside = (e) => {
            if (mobileDrawerRef.current && !mobileDrawerRef.current.contains(e.target)) {
                setMobileMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isMobile, mobileMenuOpen, isTwoLevel, setMobileMenuOpen])
    return mobileDrawerRef
}

/** Animates the sliding underline of the two-level secondary nav to match
 *  whichever tab is currently active. Returns refs for the nav container and
 *  the underline element. */
export function useTwoLevelUnderline(isTwoLevel, selectedView, activeCategory, visibleMenuItems) {
    const secondaryNavRef = useRef(null)
    const underlineRef = useRef(null)
    // Every geometry read happens before the first style write. Interleaving
    // them forces the browser to re-lay out between the two writes, which is
    // a synchronous layout on the click that switched tabs.
    const updateUnderline = useCallback(() => {
        const nav = secondaryNavRef.current
        const underline = underlineRef.current
        if (!nav || !underline) return
        const activeTab = nav.querySelector('[data-active="true"]')
        if (!activeTab) {
            underline.style.transform = 'scaleX(0)'
            return
        }
        const navRect = nav.getBoundingClientRect()
        const tabRect = activeTab.getBoundingClientRect()
        const navScrollLeft = nav.scrollLeft
        const left = tabRect.left - navRect.left + navScrollLeft
        const width = tabRect.width
        // The bar is one pixel wide and grows by scale, so the slide costs a
        // composite rather than a layout of the whole tab strip.
        underline.style.transform = `translateX(${left}px) scaleX(${width})`
    }, [])
    useEffect(() => {
        if (isTwoLevel) updateUnderline()
    }, [selectedView, activeCategory, visibleMenuItems, updateUnderline, isTwoLevel])
    useEffect(() => {
        if (!isTwoLevel) return
        window.addEventListener('resize', updateUnderline)
        return () => window.removeEventListener('resize', updateUnderline)
    }, [updateUnderline, isTwoLevel])
    return { secondaryNavRef, underlineRef }
}

/** Keeps the two-level active category in sync with the externally controlled
 *  selectedView. */
export function useActiveCategory(isTwoLevel, selectedView) {
    const [activeCategory, setActiveCategory] = useState(() => getCategoryForView(selectedView))
    useEffect(() => {
        if (isTwoLevel) setActiveCategory(getCategoryForView(selectedView))
    }, [selectedView, isTwoLevel])
    return [activeCategory, setActiveCategory]
}
