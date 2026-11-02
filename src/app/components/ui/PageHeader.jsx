import React from 'react'

/**
 * The title block every top-level page opens with: the page name set large in
 * the heading face, an optional line of context under it, actions on the
 * right, and optional underline tabs along the bottom rule. It sits on the
 * page background with the same side inset as the content beneath.
 */
export default function PageHeader({ title, meta, actions, tabs, activeTab, onTabChange }) {
    return (
        <header className="shrink-0 bg-bg-secondary px-4 pt-6 sm:px-6 lg:px-8">
            <div className={`flex flex-wrap items-end gap-x-4 gap-y-3 ${tabs ? '' : 'pb-1'}`}>
                <div className="min-w-0 flex-1">
                    <h1 className="m-0 truncate font-heading text-[28px] font-semibold leading-none tracking-tight text-text-primary">
                        {title}
                    </h1>
                    {meta && <p className="m-0 mt-2 truncate text-[13px] text-text-secondary">{meta}</p>}
                </div>
                {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
            {tabs && (
                <div className="mt-4 border-b border-border-light">
                    <div className="-mb-px flex items-center gap-6" role="tablist">
                        {tabs.map((tab) => {
                            const active = tab.id === activeTab
                            return (
                                <button
                                    type="button"
                                    key={tab.id}
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => onTabChange?.(tab.id)}
                                    className={`border-x-0 border-t-0 border-b-2 bg-transparent px-0 pb-2.5 pt-1 text-[13px] font-medium cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:text-text-primary ${
                                        active
                                            ? 'border-text-primary text-text-primary'
                                            : 'border-transparent text-text-secondary hover:text-text-primary'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </header>
    )
}
