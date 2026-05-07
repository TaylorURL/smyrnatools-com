import React, { useEffect, useRef, useState } from 'react'

import { GeocodeService } from '../../../services/GeocodeService'

const SUGGESTION_DEBOUNCE_MS = 350
const SUGGESTION_MIN_QUERY_LEN = 5

/**
 * Free-text address input with Nominatim-backed autocomplete + verification.
 *
 * As the dispatcher types we hit Nominatim (debounced) for matching US
 * addresses, render the top hits in a dropdown, and on select replace the
 * input with the canonical `display_name` plus pre-warm the geocode cache
 * with the known-good lat/lng. Result: by the time Submit fires, the job
 * coord is already cached so plant ranking runs without a network round-
 * trip and the address is guaranteed to be a real, geocodable location.
 *
 * Pure presentation otherwise — the parent owns `value` so spilling state
 * up into BookOrderView's request memo stays trivial.
 */
function AddressAutocomplete({ fieldStyle, onChange, placeholder, required, value }) {
    const [suggestions, setSuggestions] = useState([])
    const [isOpen, setIsOpen] = useState(false)
    const [highlightIndex, setHighlightIndex] = useState(-1)
    const [isLoading, setIsLoading] = useState(false)
    /* Tracks whether the latest text edit came from the user typing (we
     * SHOULD fetch suggestions) or from us programmatically setting the
     * value via a pick (we should NOT — that would re-open the dropdown
     * the dispatcher just dismissed). */
    const userTypedRef = useRef(false)
    const containerRef = useRef(null)

    useEffect(() => {
        if (!userTypedRef.current) return undefined
        const trimmed = String(value || '').trim()
        if (trimmed.length < SUGGESTION_MIN_QUERY_LEN) {
            setSuggestions([])
            setIsOpen(false)
            setIsLoading(false)
            return undefined
        }
        let cancelled = false
        setIsLoading(true)
        const handle = setTimeout(async () => {
            const results = await GeocodeService.search(trimmed)
            if (cancelled) return
            setSuggestions(results)
            setIsOpen(results.length > 0)
            setHighlightIndex(-1)
            setIsLoading(false)
        }, SUGGESTION_DEBOUNCE_MS)
        return () => {
            cancelled = true
            clearTimeout(handle)
            setIsLoading(false)
        }
    }, [value])

    /* Click-outside closes the dropdown — without this it lingers on top
     * of the next field the dispatcher tabs into. */
    useEffect(() => {
        const handleClick = (event) => {
            if (!containerRef.current?.contains(event.target)) setIsOpen(false)
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

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

    return (
        <div ref={containerRef} className="relative">
            <input
                type="text"
                value={value}
                onChange={handleType}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setIsOpen(true)}
                placeholder={placeholder}
                required={required}
                autoComplete="off"
                className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none"
                style={fieldStyle}
            />
            {isLoading && (
                <i
                    className="fas fa-circle-notch fa-spin absolute right-3 top-1/2 -translate-y-1/2 text-[12px]"
                    style={{ color: 'var(--text-tertiary)' }}
                />
            )}
            {isOpen && suggestions.length > 0 && (
                <ul
                    role="listbox"
                    className="absolute z-20 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-lg shadow-lg"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                >
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
                            className="px-3 py-2 text-[12.5px] cursor-pointer leading-snug"
                            style={{
                                background: highlightIndex === index ? 'var(--bg-secondary)' : 'transparent',
                                borderTop: index === 0 ? 'none' : '1px solid var(--border-light)',
                                color: 'var(--text-primary)'
                            }}
                        >
                            <i
                                className="fas fa-location-dot text-[10px] mr-2"
                                style={{ color: 'var(--text-tertiary)' }}
                            />
                            {suggestion.displayName}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

export default AddressAutocomplete
