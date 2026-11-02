import React from 'react'

/**
 * Record page header for detail views: a back link, the record's name set
 * large, then its tools on the right (issues, comments, history) beside its
 * commit actions (Save first). Section tabs run along the bottom edge when the
 * record has more than one.
 *
 * Under the mobile breakpoint `.dv-header` and `.dv-header-title` in
 * `index.css` tighten it, the commit actions move to the bottom bar and the
 * tabs with them, so changing a size here needs the matching rule checked.
 */
export default function DetailViewHeader({
    headerActions,
    commitActions,
    icon: _icon,
    onBack,
    onClose,
    subtitle,
    title,
    tabs,
    activeSection,
    setActiveSection
}) {
    return (
        <header className="relative shrink-0 border-b border-border-light bg-bg-secondary">
            <div className="dv-header px-4 pt-4 sm:px-6 lg:px-8">
                <button
                    type="button"
                    onClick={onBack || onClose}
                    aria-label="Back"
                    className="-ml-1.5 inline-flex h-7 items-center gap-1.5 rounded-[3px] border-none bg-transparent px-1.5 text-[12.5px] text-text-secondary cursor-pointer transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                    <i className="fas fa-arrow-left text-[11px]" aria-hidden="true"></i>
                    <span>Back</span>
                </button>
                <div className="mt-1 flex flex-wrap items-end gap-x-6 gap-y-3 pb-4">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="min-w-0">
                            <h1 className="dv-header-title m-0 truncate font-heading text-[26px] font-semibold leading-tight tracking-tight text-text-primary">
                                {title}
                            </h1>
                            {subtitle && <p className="m-0 mt-0.5 text-[13px] text-text-secondary">{subtitle}</p>}
                        </div>
                    </div>
                    <div className="dv-header-actions flex flex-wrap items-center gap-2">
                        {headerActions}
                        {commitActions && (
                            <div className="hidden items-center gap-2 border-l border-border-medium pl-3 md:flex [&>*]:!flex-none">
                                {commitActions}
                            </div>
                        )}
                    </div>
                </div>
                {tabs && (
                    <div className="-mb-px hidden items-center gap-6 md:flex" role="tablist" aria-label="Sections">
                        {tabs.map((section) => {
                            const active = activeSection === section.id
                            return (
                                <button
                                    type="button"
                                    key={section.id}
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setActiveSection(section.id)}
                                    className={`border-x-0 border-t-0 border-b-2 bg-transparent px-0 pb-2.5 text-[13px] font-medium cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:text-text-primary ${
                                        active
                                            ? 'border-text-primary text-text-primary'
                                            : 'border-transparent text-text-secondary hover:text-text-primary'
                                    }`}
                                >
                                    {section.title}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </header>
    )
}
