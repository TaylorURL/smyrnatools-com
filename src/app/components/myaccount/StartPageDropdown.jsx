import React, { useEffect, useRef, useState } from 'react'

import { FieldStyle, START_PAGE_OPTIONS } from '../../constants/myAccountConstants'

/** Custom styled dropdown for selecting the default start page — uses the
 *  shared icon list from `START_PAGE_OPTIONS`. Closes on outside click. */
export default function StartPageDropdown({ onChange, value }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    const selected = START_PAGE_OPTIONS.find((o) => o.id === value) || START_PAGE_OPTIONS[0]

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="flex h-9 w-full items-center justify-between rounded-[4px] px-3 text-left outline-none cursor-pointer transition-colors duration-150 ease-out motion-reduce:transition-none hover:bg-bg-hover focus-visible:ring-2 focus-visible:ring-accent"
                style={FieldStyle}
            >
                <span className="text-[14px] text-text-primary">{selected.id}</span>
                <i
                    className={`fas fa-chevron-down text-[11px] transition-transform ${open ? 'rotate-180' : ''} text-text-tertiary`}
                />
            </button>
            {open && (
                <div
                    role="listbox"
                    aria-label="Start page"
                    className="absolute left-0 right-0 z-dropdown mt-1 max-h-72 overflow-y-auto rounded-card p-1 bg-bg-primary border border-border-light shadow-modal"
                >
                    {START_PAGE_OPTIONS.map(({ id }) => {
                        const isActive = id === value
                        return (
                            <button
                                type="button"
                                key={id}
                                role="option"
                                aria-selected={isActive}
                                onClick={() => {
                                    onChange(id)
                                    setOpen(false)
                                }}
                                className={`flex h-9 w-full items-center rounded-[4px] border-none px-3 text-left text-[13px] cursor-pointer text-text-primary transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                                    isActive ? 'bg-bg-tertiary font-medium' : 'bg-transparent hover:bg-bg-hover'
                                }`}
                            >
                                {id}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
