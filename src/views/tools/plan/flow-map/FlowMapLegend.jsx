/* eslint-disable react/forbid-dom-props */
import React, { useState } from 'react'

import {
    DIRECT_LOAD_COLOR,
    DRAFT_ROUTE_COLOR,
    LEAVE_OFF_COLOR,
    NEEDS_HELP_COLOR,
    ROUTE_IDLE_COLOR,
    ROUTE_OUTBOUND_COLOR,
    ROUTE_RETURN_COLOR,
    SELECTED_FILL_COLOR,
    SELECTED_RING_COLOR
} from './flowMapShared'

/** Mini-pin swatch matching the real Leaflet DivIcon — a hollow circle with
 *  a colored 2px ring. `borderColor` defaults to the theme's medium-border
 *  token so the unselected swatch reads the same as a normal pin. `fill`
 *  overrides the default `bg-bg-primary` so the Selected swatch can
 *  render an accent-filled circle behind its white ring, matching the
 *  real selected pin on the map. */
function PinSwatch({ borderColor, fill }) {
    return (
        <span
            aria-hidden="true"
            className="inline-block w-3.5 h-3.5 rounded-full shrink-0"
            style={{
                background: fill || 'var(--bg-primary)',
                border: `2px solid ${borderColor || 'var(--border-medium)'}`,
                boxShadow: borderColor === SELECTED_RING_COLOR ? '0 0 0 1px var(--border-medium)' : undefined
            }}
        />
    )
}

/** Solid colored line swatch for route legends. */
function LineSwatch({ color }) {
    return (
        <span
            aria-hidden="true"
            className="inline-block h-[3px] w-6 rounded-sm shrink-0"
            style={{ background: color }}
        />
    )
}

/** Miniature amber popup chip mirroring the on-pin leave-off callout
 *  (`pf-plant-leave-popup` in FlowMapStyleSheet). */
function LeaveOffSwatch() {
    return (
        <span
            aria-hidden="true"
            className="inline-flex items-center justify-center h-[14px] min-w-[22px] px-1 rounded-sm text-[9px] font-extrabold leading-none text-white shrink-0 font-mono tabular-nums"
            style={{ background: LEAVE_OFF_COLOR }}
        >
            −2
        </span>
    )
}

/** Dashed colored line swatch for the direct-load and draft route lines. */
function DashedSwatch({ color }) {
    return (
        <span
            aria-hidden="true"
            className="inline-block h-[3px] w-6 rounded-sm shrink-0"
            style={{
                backgroundImage: `linear-gradient(to right, ${color} 50%, transparent 50%)`,
                backgroundRepeat: 'repeat-x',
                backgroundSize: '6px 3px'
            }}
        />
    )
}

function LegendRow({ children, swatch }) {
    return (
        <div className="flex items-center gap-2 text-[11.5px] leading-tight text-text-secondary">
            {swatch}
            <span>{children}</span>
        </div>
    )
}

function LegendSection({ children, label }) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-text-tertiary">{label}</span>
            {children}
        </div>
    )
}

/**
 * Floating map legend docked bottom-left of the Leaflet surface so it sits
 * opposite the time scrubber and clear of the bottom-right attribution. The
 * header stays visible when collapsed so a dispatcher can re-expand without
 * losing their bearings on the map below. Labels mirror the copy already
 * used in the toolbar pill ("Click a plant to set the destination") and the
 * clock-in board ("Leave off N") so the legend reads in the same voice the
 * rest of the planner uses.
 *
 * All swatches pull from `flowMapShared` constants — no user accent on the
 * map surface — so the legend always matches what the pins/lines render.
 */
export function FlowMapLegend() {
    const [collapsed, setCollapsed] = useState(false)
    return (
        <div className="absolute bottom-3 left-3 z-[1000] pointer-events-none">
            <div className="pointer-events-auto rounded-md overflow-hidden bg-bg-primary border border-border-light shadow-card min-w-[220px] max-w-[280px]">
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border-light">
                    <span className="inline-flex items-center gap-1.5 font-heading text-[11.5px] font-bold uppercase tracking-wider text-text-primary">
                        <i aria-hidden="true" className="fas fa-circle-question text-[10px] text-text-tertiary" />
                        Legend
                    </span>
                    <button type="button"
                        onClick={() => setCollapsed((prev) => !prev)}
                        className="w-6 h-6 -mr-1 inline-flex items-center justify-center rounded bg-transparent border-none cursor-pointer text-text-tertiary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
                        aria-label={collapsed ? 'Expand legend' : 'Collapse legend'}
                        aria-expanded={!collapsed}
                    >
                        <i
                            aria-hidden="true"
                            className={`fas fa-chevron-down text-[10px] transition-transform duration-200 ease-out motion-reduce:transition-none ${collapsed ? '-rotate-90' : ''}`}
                        />
                    </button>
                </div>
                {!collapsed && (
                    <div className="px-3 py-2.5 flex flex-col gap-2.5">
                        <LegendSection label="Plants">
                            <LegendRow swatch={<PinSwatch />}>Plant</LegendRow>
                            <LegendRow
                                swatch={<PinSwatch borderColor={SELECTED_RING_COLOR} fill={SELECTED_FILL_COLOR} />}
                            >
                                Selected
                            </LegendRow>
                            <LegendRow swatch={<PinSwatch borderColor={NEEDS_HELP_COLOR} />}>Needs help</LegendRow>
                            <LegendRow swatch={<LeaveOffSwatch />}>Leave off (extra crew available)</LegendRow>
                        </LegendSection>
                        <LegendSection label="Help routes">
                            <LegendRow swatch={<LineSwatch color={ROUTE_OUTBOUND_COLOR} />}>Going to help</LegendRow>
                            <LegendRow swatch={<LineSwatch color={ROUTE_RETURN_COLOR} />}>Returning home</LegendRow>
                            <LegendRow swatch={<LineSwatch color={ROUTE_IDLE_COLOR} />}>Not yet started</LegendRow>
                        </LegendSection>
                        <LegendSection label="Job lines">
                            <LegendRow swatch={<DashedSwatch color={DIRECT_LOAD_COLOR} />}>Job assignment</LegendRow>
                            <LegendRow swatch={<DashedSwatch color={DRAFT_ROUTE_COLOR} />}>New route preview</LegendRow>
                        </LegendSection>
                    </div>
                )}
            </div>
        </div>
    )
}
