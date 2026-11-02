import React from 'react'

/** Sticky scrollspy nav for the account page's left column. Each entry
 *  scrolls its section into view; the section in view reads darker and
 *  sits on a filled row, the same way the rail marks the page you're on. */
export default function AccountSideNav({ activeId, onJump, sections }) {
    return (
        <aside className="hidden lg:block sticky top-0 self-start py-6 overflow-y-auto w-[180px] shrink-0 max-h-screen supports-[height:1dvh]:max-h-[100dvh]">
            <div className="px-2.5 pb-2 text-[12px] font-medium text-text-tertiary">On this page</div>
            <nav className="flex flex-col gap-px">
                {sections.map(({ id, label }) => {
                    const isActive = activeId === id
                    return (
                        <button
                            type="button"
                            key={id}
                            onClick={() => onJump(id)}
                            aria-current={isActive ? 'true' : undefined}
                            className={`flex h-8 items-center rounded-[4px] border-none px-2.5 text-left text-[13px] cursor-pointer transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                isActive
                                    ? 'bg-bg-tertiary font-medium text-text-primary'
                                    : 'bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                            }`}
                        >
                            <span className="truncate">{label}</span>
                        </button>
                    )
                })}
            </nav>
        </aside>
    )
}
