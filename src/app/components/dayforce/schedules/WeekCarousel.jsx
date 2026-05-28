/* eslint-disable react/forbid-dom-props */
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { Panel } from '../../ui/Panel'
import { WeekTable } from './WeekTable'

/** Show inline dots up to this count; switch to a compact "N / M" counter
 *  beyond it so the header doesn't outgrow the panel on multi-month ranges. */
const MAX_DOTS = 8

/** Per-week carousel for the Schedules tab. Shows one week at a time with
 *  prev/next arrows, a dot indicator (or compact counter when there are too
 *  many weeks for dots), and keyboard ←/→ navigation. Resets to the newest
 *  week whenever the underlying data set changes so a new period selection
 *  always lands on its most recent week.
 *
 *  The source `weekTables` array arrives newest-first from `useWeekTables`,
 *  but we reverse it locally so the carousel reads as a left-to-right
 *  timeline (older on the left, newer on the right). That puts the newest
 *  week at the LAST index, which matches user intuition: pressing → moves
 *  forward in time toward the newest week, pressing ← moves back in time
 *  toward older weeks. Without the reversal, the arrows feel inverted
 *  because incrementing the index would walk you backward in time.
 *
 *  Renders the WeekTable in `bare` mode and provides its own Panel chrome,
 *  so the week label + counter live in the carousel header instead of
 *  duplicating across stacked panels.
 */
export function WeekCarousel({ accent, weekTables }) {
    const orderedWeeks = useMemo(() => [...weekTables].reverse(), [weekTables])
    const total = orderedWeeks.length
    const [activeIndex, setActiveIndex] = useState(Math.max(0, total - 1))
    const safeIndex = Math.min(activeIndex, Math.max(0, total - 1))
    const current = orderedWeeks[safeIndex]

    /* Reset to the newest week (last index after the chronological reverse)
     * whenever the underlying list flips — new period selected, filter
     * narrowed, etc. Identity-check via the newest week's label keeps the
     * reset out of the way on no-op re-renders where the same weeks come
     * back with refreshed inner rows. */
    const newestLabel = orderedWeeks[total - 1]?.weekLabel
    useEffect(() => {
        setActiveIndex(Math.max(0, total - 1))
    }, [newestLabel, total])

    const goPrev = useCallback(() => setActiveIndex((i) => Math.max(0, i - 1)), [])
    const goNext = useCallback(() => setActiveIndex((i) => Math.min(total - 1, i + 1)), [total])

    /* Keyboard nav — ←/→ scroll between weeks. Skip when the user is
     * typing into any input / textarea / contenteditable so search /
     * filter text input keeps its arrow keys for caret movement. */
    useEffect(() => {
        if (total <= 1) return
        const onKey = (event) => {
            if (event.metaKey || event.ctrlKey || event.altKey) return
            const target = event.target
            const tag = target?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
            if (event.key === 'ArrowLeft') {
                event.preventDefault()
                goPrev()
            } else if (event.key === 'ArrowRight') {
                event.preventDefault()
                goNext()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [goPrev, goNext, total])

    if (total === 0 || !current) return null

    /* Single-week ranges skip the chrome entirely — no value in showing
     * disabled arrows + a "1 of 1" counter when there's nothing to flip
     * between. */
    if (total === 1) {
        return <WeekTable accent={accent} {...current} />
    }

    return (
        <Panel
            title={
                <div className="flex items-baseline gap-2 min-w-0">
                    <span className="truncate">{current.weekLabel}</span>
                    <span className="font-mono tabular-nums text-[11px] font-normal text-text-tertiary shrink-0">
                        {safeIndex + 1} / {total}
                    </span>
                </div>
            }
            right={
                <CarouselNav
                    accent={accent}
                    activeIndex={safeIndex}
                    onNext={goNext}
                    onPrev={goPrev}
                    onSelect={setActiveIndex}
                    total={total}
                />
            }
            innerClassName="p-0"
        >
            {/* Key on the week label so React tears the old subtree down on
             *  navigation — combined with `animate-fade-in-fast` this gives
             *  a soft cross-fade between weeks instead of an abrupt swap. */}
            <div key={current.weekLabel} className="animate-fade-in-fast">
                <WeekTable accent={accent} bare {...current} />
            </div>
        </Panel>
    )
}

function CarouselNav({ accent, activeIndex, onNext, onPrev, onSelect, total }) {
    const atStart = activeIndex === 0
    const atEnd = activeIndex === total - 1
    const showDots = total <= MAX_DOTS

    return (
        <div className="flex items-center gap-1.5">
            <ArrowButton ariaLabel="Previous week" direction="prev" disabled={atStart} onClick={onPrev} />
            {showDots ? (
                <DotStrip accent={accent} active={activeIndex} onSelect={onSelect} total={total} />
            ) : (
                <CompactCounter active={activeIndex} total={total} />
            )}
            <ArrowButton ariaLabel="Next week" direction="next" disabled={atEnd} onClick={onNext} />
        </div>
    )
}

function ArrowButton({ ariaLabel, direction, disabled, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-border-light bg-bg-tertiary text-text-secondary cursor-pointer transition-all duration-150 ease-out hover:bg-bg-hover hover:text-text-primary active:scale-[0.94] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:bg-bg-tertiary disabled:hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none motion-reduce:active:scale-100"
        >
            <i className={`fas fa-chevron-${direction === 'prev' ? 'left' : 'right'} text-[10px]`} />
        </button>
    )
}

function DotStrip({ accent, active, onSelect, total }) {
    return (
        <div className="flex items-center gap-1 px-1">
            {Array.from({ length: total }, (_, idx) => {
                const isActive = idx === active
                return (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => onSelect(idx)}
                        aria-label={`Jump to week ${idx + 1}`}
                        aria-current={isActive ? 'true' : undefined}
                        className="inline-flex items-center justify-center h-5 w-3.5 border-none bg-transparent cursor-pointer p-0 focus-visible:outline-none group"
                    >
                        <span
                            className="block rounded-full transition-all duration-200 ease-out group-hover:scale-125 group-focus-visible:ring-2 group-focus-visible:ring-accent motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                            style={{
                                background: isActive ? accent : 'var(--border-medium)',
                                height: isActive ? 6 : 5,
                                opacity: isActive ? 1 : 0.6,
                                width: isActive ? 18 : 5
                            }}
                        />
                    </button>
                )
            })}
        </div>
    )
}

function CompactCounter({ active, total }) {
    return (
        <span className="font-mono tabular-nums text-[11px] text-text-tertiary px-2 select-none">
            Week {active + 1} / {total}
        </span>
    )
}

export default WeekCarousel
