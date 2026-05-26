/* eslint-disable react/forbid-dom-props */
import React, { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const POPOVER_WIDTH = 240

/** One-decimal trim, with no trailing zero — `21.50` reads worse than
 *  `21.5` and integers stay as plain `21` (no decimal at all). */
const trimYards = (value) => {
    const n = Number(value) || 0
    if (Number.isInteger(n)) return n
    return Math.round(n * 10) / 10
}

/**
 * "Loaded / total" cell on the schedule table. Portals its hover card to
 * `<body>` at the cell's fixed screen coords so the popover can't be clipped
 * by the table's scroll container, and so the breakdown stays readable
 * even on rows near the right edge or bottom of the viewport.
 */
export default function PlanScheduleLoadedCell({ detail, homePlantCode, total }) {
    const tdRef = useRef(null)
    const [anchorRect, setAnchorRect] = useState(null)
    const loaded = detail?.loadedYardage || 0
    const breakdownRows = useMemo(() => {
        if (!detail?.byPlant) return []
        return Object.entries(detail.byPlant)
            .filter(([, v]) => (v?.loadedYardage || 0) > 0 || (v?.ticketCount || 0) > 0)
            .sort((a, b) => b[1].loadedYardage - a[1].loadedYardage)
    }, [detail])

    if (!total && !loaded) {
        return <td className="px-3 py-2 font-mono text-right whitespace-nowrap text-text-tertiary">—</td>
    }

    const loadedDisplay = trimYards(loaded)
    const isComplete = total > 0 && loaded >= total

    const handleEnter = () => {
        const rect = tdRef.current?.getBoundingClientRect()
        if (rect) setAnchorRect(rect)
    }
    const handleLeave = () => setAnchorRect(null)

    // Position the popover below-right of the cell, but flip to above if it
    // would run off the bottom of the viewport. Right-aligns to the cell so
    // long breakdowns extend to the left, not off-screen.
    const popover = anchorRect
        ? (() => {
              const popoverHeightEstimate = 32 + breakdownRows.length * 22 + 16
              const left = Math.max(
                  8,
                  Math.min(window.innerWidth - POPOVER_WIDTH - 8, anchorRect.right - POPOVER_WIDTH)
              )
              const fitsBelow = anchorRect.bottom + popoverHeightEstimate + 8 < window.innerHeight
              const top = fitsBelow ? anchorRect.bottom + 4 : anchorRect.top - popoverHeightEstimate - 4
              return createPortal(
                  <div
                      className="rounded-md p-2.5 text-left whitespace-nowrap pointer-events-none origin-top animate-[fadeSlideIn_180ms_ease-out_both] motion-reduce:animate-none"
                      style={{
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-light)',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
                          left,
                          minWidth: POPOVER_WIDTH,
                          position: 'fixed',
                          top,
                          zIndex: 9999
                      }}
                  >
                      <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5 text-text-secondary">
                          Loaded {loadedDisplay} of {total} yd
                      </div>
                      {breakdownRows.length > 0 ? (
                          <div className="flex flex-col gap-1">
                              {breakdownRows.map(([plantId, v]) => (
                                  <div key={plantId} className="flex items-center justify-between gap-3 text-[12.5px]">
                                      <span className="font-mono font-semibold text-text-primary">
                                          {plantId}
                                          {plantId === homePlantCode && (
                                              <span className="ml-1.5 text-[9.5px] font-bold uppercase tracking-wider text-text-tertiary">
                                                  home
                                              </span>
                                          )}
                                      </span>
                                      <span className="font-mono text-text-primary">
                                          {trimYards(v.loadedYardage)} yd
                                          <span className="ml-1.5 text-text-tertiary">· {v.ticketCount} tkt</span>
                                      </span>
                                  </div>
                              ))}
                          </div>
                      ) : loaded > 0 ? (
                          <div className="text-[12.5px] text-text-tertiary">
                              Plant breakdown unavailable — refresh the page if this persists.
                          </div>
                      ) : (
                          <div className="text-[12.5px] text-text-tertiary">No tickets loaded yet.</div>
                      )}
                  </div>,
                  document.body
              )
          })()
        : null

    return (
        <td
            ref={tdRef}
            className="px-3 py-2 font-mono whitespace-nowrap"
            style={{ color: isComplete ? '#16a34a' : 'var(--text-primary)' }}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
        >
            {/* 3-column inline grid keeps the slash and the digits on either
                side of it at the same x-position across every row, so the
                column reads as a clean stack rather than a ragged one. */}
            <span
                className="inline-grid items-baseline justify-end"
                style={{
                    columnGap: 3,
                    fontVariantNumeric: 'tabular-nums',
                    gridTemplateColumns: 'minmax(2.25em, auto) auto minmax(2.25em, auto)'
                }}
            >
                <span className="font-bold text-right">{loadedDisplay}</span>
                <span className="text-text-tertiary">/</span>
                <span className="text-text-tertiary text-left">{total || '—'}</span>
            </span>
            {popover}
        </td>
    )
}
