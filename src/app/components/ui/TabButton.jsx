/* eslint-disable react/forbid-dom-props */
import React from 'react'

/** Plan-tab pill button — same chrome as the report toolbar tabs and the
 *  Plan filter chips. */
export default function TabButton({ label, isActive, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="px-2.5 py-1 rounded text-[11.5px] font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap shrink-0 border-none transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none active:scale-[0.97]"
            style={{
                background: isActive ? 'var(--bg-primary)' : 'transparent',
                border: `1px solid ${isActive ? 'var(--border-light)' : 'transparent'}`,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
        >
            {label}
        </button>
    )
}
