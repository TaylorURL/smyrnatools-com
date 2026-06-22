/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'

import { DEFAULT_TAG_STYLE, TAG_COLORS } from '../../../constants/safetyManagerReportConstants'
import {
    CARD_STYLE,
    FIELD_INPUT_CLASS,
    FIELD_STYLE,
    SECTION_LABEL_CLASS
} from '../../../constants/weeklyReportConstants'

function ModalHeader({ onClose }) {
    return (
        <div className="flex items-center justify-between px-3 py-2.5 bg-bg-secondary border-b border-border-light">
            <div>
                <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                    Categories
                </div>
                <div className="text-[12.5px] font-semibold text-text-primary">Select Issue Categories</div>
            </div>
            <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded border-none cursor-pointer bg-bg-tertiary text-text-secondary h-6 w-6 hover:bg-bg-hover hover:text-text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
            >
                <i className="fas fa-times text-[10px]" />
            </button>
        </div>
    )
}

function BulkActions({ onClear, onSelectAll }) {
    const buttonClass =
        'inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-semibold cursor-pointer transition-colors duration-150 hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary'
    return (
        <div className="flex gap-1.5 p-2 border-b border-border-light">
            <button type="button" onClick={onSelectAll} className={buttonClass} style={FIELD_STYLE}>
                <i className="fas fa-check-double text-[10px]" /> Select All
            </button>
            <button type="button" onClick={onClear} className={buttonClass} style={FIELD_STYLE}>
                <i className="fas fa-times text-[10px]" /> Clear
            </button>
        </div>
    )
}

function SearchBar({ onChange, query }) {
    return (
        <div className="p-2 border-b border-border-light">
            <div
                className="flex items-center gap-2 rounded px-2 py-1.5 transition-colors duration-150 focus-within:ring-2 focus-within:ring-[var(--accent)]/40 focus-within:ring-offset-1 focus-within:ring-offset-bg-primary focus-within:border-[var(--accent)]"
                style={FIELD_STYLE}
            >
                <i className="fas fa-search text-[10px] pointer-events-none text-text-tertiary" />
                <input
                    type="search"
                    aria-label="Search tags"
                    placeholder="Search tags…"
                    value={query}
                    onChange={(e) => onChange(e.target.value)}
                    className="flex-1 border-none bg-transparent text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-accent/30 text-text-primary placeholder:text-text-tertiary [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none"
                />
            </div>
        </div>
    )
}

/** Single row inside the tag list — checkbox + colored icon + name. */
function TagListItem({ isSelected, onToggle, option }) {
    const tagStyle = TAG_COLORS[option] || DEFAULT_TAG_STYLE
    return (
        <div
            onClick={onToggle}
            className="flex items-center gap-2 rounded cursor-pointer mb-0.5 px-2 py-1.5"
            style={{ background: isSelected ? 'var(--bg-secondary)' : 'transparent' }}
        >
            <div
                className="flex items-center justify-center rounded text-[9px] text-white h-[18px] w-[18px]"
                style={{
                    background: isSelected ? 'var(--accent, #1e3a5f)' : 'var(--bg-tertiary)',
                    border: isSelected ? `1px solid var(--accent, #1e3a5f)` : '1px solid var(--border-light)'
                }}
            >
                {isSelected && <i className="fas fa-check" />}
            </div>
            <i className={tagStyle.icon} style={{ color: tagStyle.color, fontSize: 11 }} />
            <span className="text-[12px] text-text-primary" style={{ fontWeight: isSelected ? 600 : 400 }}>
                {option}
            </span>
        </div>
    )
}

function FilteredTagList({ filtered, onToggle, value }) {
    if (filtered.length === 0) {
        return (
            <div className="p-6 text-center text-[12px] text-text-tertiary">
                <i className="fas fa-search block text-[16px] mb-1" />
                <span>No matching tags</span>
            </div>
        )
    }
    return filtered.map((option) => (
        <TagListItem
            key={option}
            isSelected={value.includes(option)}
            onToggle={() => onToggle(option)}
            option={option}
        />
    ))
}

/** Modal body for the tag picker — opens on demand, mounts via portal,
 *  closes on outside click or the Done button. */
function TagPickerModal({ onChange, onClose, options, value }) {
    const [query, setQuery] = useState('')
    const lower = query.toLowerCase()
    const filtered = options.filter((o) => o.toLowerCase().includes(lower))
    const toggle = (val) => {
        const has = value.includes(val)
        onChange(has ? value.filter((v) => v !== val) : [...value, val])
    }
    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                className="flex w-full max-w-[400px] max-h-[80vh] flex-col overflow-hidden rounded shadow-2xl"
                style={CARD_STYLE}
                onClick={(e) => e.stopPropagation()}
            >
                <ModalHeader onClose={onClose} />
                <BulkActions onClear={() => onChange([])} onSelectAll={() => onChange(options)} />
                <SearchBar onChange={setQuery} query={query} />
                <div className="flex-1 overflow-y-auto p-1.5">
                    <FilteredTagList filtered={filtered} onToggle={toggle} value={value} />
                </div>
                <div className="p-2 bg-bg-secondary border-t border-border-light">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded text-[12px] font-bold uppercase tracking-wider text-white py-2 cursor-pointer border-none bg-[var(--accent,_#1e3a5f)] hover:bg-[var(--accent-hover,_#15263d)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
                    >
                        Done · {value.length} selected
                    </button>
                </div>
            </div>
        </div>
    )
}

/** Picker button + portal-mounted modal for multi-select tag input. */
export function TagPicker({ disabled, onChange, options, placeholder, value }) {
    const [open, setOpen] = useState(false)
    const handleChange = (next) => {
        if (disabled) return
        onChange(next)
    }
    return (
        <div className="relative w-full">
            <button
                type="button"
                disabled={disabled}
                aria-expanded={open}
                onClick={() => setOpen(true)}
                className={`${FIELD_INPUT_CLASS} flex items-center justify-between text-left cursor-pointer disabled:cursor-not-allowed`}
                style={FIELD_STYLE}
            >
                <span className="flex items-center gap-1.5">
                    <i className="fas fa-tags text-[10px] text-text-tertiary" />
                    {value.length
                        ? `${value.length} tag${value.length > 1 ? 's' : ''} selected`
                        : placeholder || 'Select tags'}
                </span>
                <i className="fas fa-chevron-down text-[9px] text-text-tertiary" />
            </button>
            {open &&
                typeof document !== 'undefined' &&
                ReactDOM.createPortal(
                    <TagPickerModal
                        onChange={handleChange}
                        onClose={() => setOpen(false)}
                        options={options}
                        value={value}
                    />,
                    document.body
                )}
        </div>
    )
}
