/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { GeocodeService } from '../../../services/GeocodeService'

const SUGGESTION_DEBOUNCE_MS = 250
const SUGGESTION_MIN_QUERY_LEN = 3
/* Higher limit gives the picker more room to surface the right
 * candidate on tricky addresses (rural roads, plus codes, new
 * construction) — Photon and Census both rank decently, so the extra
 * rows usually contain useful near-matches rather than noise. */
const SUGGESTION_LIMIT = 8

/**
 * Free-text address input with multi-provider autocomplete + verification.
 *
 * As the dispatcher types we hit the geocode chain (Photon → Census →
 * Nominatim, debounced) for matching US addresses, render the top hits
 * in a dropdown, and on select replace the input with the canonical
 * display name plus pre-warm the geocode cache with the known-good
 * lat/lng. Result: by the time Submit fires, the job coord is already
 * cached so plant ranking runs without a network round-trip and the
 * address is guaranteed to be a real, geocodable location.
 *
 * The dropdown renders inside a `createPortal` at document body level so an
 * ancestor with `overflow: hidden | auto` (e.g. the booking form's scroll
 * container) can't clip it out of view. Position is recomputed off the
 * input's bounding rect on open + on scroll/resize.
 */
const DEFAULT_INPUT_CLASSNAME = 'w-full rounded-lg px-3 py-2.5 text-[14px] outline-none'

function AddressAutocomplete({ fieldStyle, inputClassName, onChange, placeholder, required, value }) {
    const [suggestions, setSuggestions] = useState([])
    const [isOpen, setIsOpen] = useState(false)
    const [highlightIndex, setHighlightIndex] = useState(-1)
    const [isLoading, setIsLoading] = useState(false)
    /* Tracks whether we've sent at least one search since the last
     * accept / reset. Drives the empty-state copy: pre-search vs
     * "no matches found" reads very differently to the dispatcher. */
    const [hasSearched, setHasSearched] = useState(false)
    const [dropdownStyle, setDropdownStyle] = useState(null)
    /* Tracks whether the latest text edit came from the user typing (we
     * SHOULD fetch suggestions) or from us programmatically setting the
     * value via a pick (we should NOT — that would re-open the dropdown
     * the dispatcher just dismissed). */
    const userTypedRef = useRef(false)
    const containerRef = useRef(null)
    const inputRef = useRef(null)
    const dropdownRef = useRef(null)

    useEffect(() => {
        if (!userTypedRef.current) return undefined
        const trimmed = String(value || '').trim()
        if (trimmed.length < SUGGESTION_MIN_QUERY_LEN) {
            setSuggestions([])
            setIsOpen(false)
            setIsLoading(false)
            setHasSearched(false)
            return undefined
        }
        let cancelled = false
        setIsLoading(true)
        setIsOpen(true)
        const handle = setTimeout(async () => {
            const results = await GeocodeService.search(trimmed, { limit: SUGGESTION_LIMIT })
            if (cancelled) return
            setSuggestions(results)
            setHighlightIndex(-1)
            setIsLoading(false)
            setHasSearched(true)
            setIsOpen(true)
        }, SUGGESTION_DEBOUNCE_MS)
        return () => {
            cancelled = true
            clearTimeout(handle)
        }
    }, [value])

    /* Click-outside closes the dropdown — without this it lingers on top
     * of the next field the dispatcher tabs into. The portal lives
     * outside the container, so we explicitly check both refs. */
    useEffect(() => {
        const handleClick = (event) => {
            const inContainer = containerRef.current?.contains(event.target)
            const inDropdown = dropdownRef.current?.contains(event.target)
            if (!inContainer && !inDropdown) setIsOpen(false)
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    /* Position the portaled dropdown directly under the input. Recomputes
     * synchronously after layout changes so a window resize, page scroll,
     * or focus shift doesn't leave it floating in the wrong place. */
    const positionDropdown = () => {
        const input = inputRef.current
        if (!input) return
        const rect = input.getBoundingClientRect()
        setDropdownStyle({
            left: rect.left,
            top: rect.bottom + 4,
            width: rect.width
        })
    }

    useLayoutEffect(() => {
        if (!isOpen) return undefined
        positionDropdown()
        const handle = () => positionDropdown()
        window.addEventListener('resize', handle)
        window.addEventListener('scroll', handle, true)
        return () => {
            window.removeEventListener('resize', handle)
            window.removeEventListener('scroll', handle, true)
        }
    }, [isOpen, suggestions.length])

    const handleType = (event) => {
        userTypedRef.current = true
        onChange(event.target.value)
    }

    const acceptSuggestion = (suggestion) => {
        userTypedRef.current = false
        GeocodeService.primeCache(suggestion.displayName, suggestion.coord)
        onChange(suggestion.displayName)
        setSuggestions([])
        setIsOpen(false)
        setHighlightIndex(-1)
        setHasSearched(false)
    }

    const handleKeyDown = (event) => {
        if (!isOpen || suggestions.length === 0) return
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            setHighlightIndex((prev) => (prev + 1) % suggestions.length)
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setHighlightIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1))
        } else if (event.key === 'Enter' && highlightIndex >= 0) {
            event.preventDefault()
            acceptSuggestion(suggestions[highlightIndex])
        } else if (event.key === 'Escape') {
            setIsOpen(false)
        }
    }

    const handleFocus = () => {
        if (suggestions.length > 0 || isLoading || hasSearched) setIsOpen(true)
    }

    const showDropdown = isOpen && dropdownStyle && (suggestions.length > 0 || isLoading || hasSearched)

    return (
        <div ref={containerRef} className="relative">
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={handleType}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                placeholder={placeholder}
                required={required}
                autoComplete="off"
                className={inputClassName || DEFAULT_INPUT_CLASSNAME}
                style={fieldStyle}
            />
            {isLoading && (
                <i className="fas fa-circle-notch fa-spin absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-text-tertiary" />
            )}
            {showDropdown &&
                createPortal(
                    <ul
                        ref={dropdownRef}
                        role="listbox"
                        className="fixed z-[1000] max-h-72 overflow-y-auto rounded-lg shadow-lg bg-bg-primary border border-border-light"
                        style={{ left: dropdownStyle.left, top: dropdownStyle.top, width: dropdownStyle.width }}
                    >
                        {suggestions.length === 0 && isLoading && (
                            <li className="px-3 py-2 text-[12.5px] flex items-center gap-2 text-text-tertiary">
                                <i className="fas fa-circle-notch fa-spin text-[10px]" />
                                Searching addresses…
                            </li>
                        )}
                        {suggestions.length === 0 && !isLoading && hasSearched && (
                            <li className="px-3 py-2 text-[12.5px] flex items-center gap-2 text-text-tertiary">
                                <i className="fas fa-circle-info text-[10px]" />
                                No matches found — keep typing or check spelling.
                            </li>
                        )}
                        {suggestions.map((suggestion, index) => (
                            <li
                                key={`${suggestion.coord.lat}-${suggestion.coord.lng}-${index}`}
                                role="option"
                                aria-selected={highlightIndex === index}
                                onMouseDown={(event) => {
                                    event.preventDefault()
                                    acceptSuggestion(suggestion)
                                }}
                                onMouseEnter={() => setHighlightIndex(index)}
                                className="px-3 py-2 text-[12.5px] cursor-pointer leading-snug text-text-primary"
                                style={{
                                    background: highlightIndex === index ? 'var(--bg-secondary)' : 'transparent',
                                    borderTop: index === 0 ? 'none' : '1px solid var(--border-light)'
                                }}
                            >
                                <i className="fas fa-location-dot text-[10px] mr-2 text-text-tertiary" />
                                {suggestion.displayName}
                            </li>
                        ))}
                    </ul>,
                    document.body
                )}
        </div>
    )
}

export default AddressAutocomplete
