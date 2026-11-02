import React from 'react'

/** Bottom bar for mobile detail views: the record's actions (Save, Delete)
 *  on a row of their own above an evenly split section-tab strip. Sharing one
 *  scrolling row, the tabs truncated to "Basic Inf…" and the actions ran off
 *  the right edge of the screen. */
export default function DetailViewMobileNav({ activeSection, footerActions, sections, setActiveSection }) {
    return (
        <nav className="dv-mobile-nav" aria-label="Sections">
            {footerActions && <div className="dv-mobile-nav-actions">{footerActions}</div>}
            <div className="flex overflow-hidden rounded-[4px] border border-border-medium">
                {sections.map((section) => {
                    const isActive = activeSection === section.id
                    return (
                        <button
                            type="button"
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            aria-current={isActive ? 'true' : undefined}
                            className={`dv-mobile-nav-btn ${
                                isActive
                                    ? 'bg-bg-tertiary font-medium text-text-primary'
                                    : 'bg-bg-primary text-text-secondary'
                            }`}
                        >
                            <span className="truncate">{section.title}</span>
                        </button>
                    )
                })}
            </div>
        </nav>
    )
}
