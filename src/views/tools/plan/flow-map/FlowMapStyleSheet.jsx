import React from 'react'

import { LEAVE_OFF_COLOR, NEEDS_HELP_COLOR } from './flowMapShared'

/** Encapsulates the entire inline `<style>` block for the Planner map
 *  surface — plant pins, route flow animations, job pins, arrow markers,
 *  draft polylines, and the toolbar pill mount-in animation. Lives as a
 *  component so the orchestrator file can read in a single import without
 *  the styles bloating its line count. */
export function FlowMapStyleSheet() {
    return (
        <style>{`
            .plan-flow-map-marker { background: transparent !important; border: none !important; }
            .pf-plant-pin {
                position: relative;
                border-radius: 50%;
                display: flex; flex-direction: column;
                align-items: center; justify-content: center;
                font-family: 'Exo 2', system-ui, sans-serif;
                cursor: pointer;
                transition: transform 0.12s ease;
            }
            .pf-plant-pin:hover { transform: scale(1.05); }
            .pf-plant-code { font-weight: 800; line-height: 1; letter-spacing: 0.02em; }
            .pf-plant-ops {
                font-family: 'Exo 2', monospace; font-variant-numeric: tabular-nums;
                font-size: 10px; font-weight: 700; margin-top: 2px;
                display: flex; align-items: baseline; gap: 2px;
            }
            .pf-plant-ops span { font-size: 8px; opacity: 0.7; letter-spacing: 0.05em; }
            .pf-plant-badge {
                position: absolute; top: -4px; right: -4px;
                width: 16px; height: 16px; border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                color: #fff; font-size: 11px; font-weight: 800;
                border: 2px solid var(--bg-primary);
            }
            .pf-needs { background: ${NEEDS_HELP_COLOR}; }
            .pf-leave { background: ${LEAVE_OFF_COLOR}; }
            .leaflet-container { background: var(--bg-tertiary); }
            .leaflet-control-attribution {
                background: rgba(255, 255, 255, 0.85) !important;
                color: #475569 !important;
                font-size: 10px !important;
            }
            html.dark .leaflet-control-attribution {
                background: rgba(15, 23, 42, 0.85) !important;
                color: #cbd5e1 !important;
            }
            html.dark .leaflet-control-attribution a {
                color: #93c5fd !important;
            }
            /* Help-route lines — the colored base itself flows toward
             * the destination via a long-dash stroke-dashoffset
             * animation, with a faster white dashed overlay on top
             * for high-frequency texture. Two layers of motion at
             * different rates read as a continuous river of traffic
             * rather than a static line with a marching overlay. */
            .help-route-base {
                stroke-linecap: round;
                filter: drop-shadow(0 1px 3px rgba(15, 23, 42, 0.55));
            }
            .help-route-base-active {
                animation: help-route-base-flow 1.4s linear infinite;
            }
            .help-route-flow {
                animation: help-route-flow 0.9s linear infinite,
                           help-route-flow-breath 1.8s ease-in-out infinite;
                filter: drop-shadow(0 0 10px rgba(255, 255, 255, 1))
                        drop-shadow(0 0 18px rgba(186, 230, 253, 0.7));
            }
            /* Subtle brightness breathing on the overlay so an active
             * route has its own internal rhythm on top of the linear
             * dash flow — reads as "the road has a pulse" instead of
             * a perfectly mechanical dashed line. */
            @keyframes help-route-flow-breath {
                0%, 100% { filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.85))
                                   drop-shadow(0 0 14px rgba(186, 230, 253, 0.55)); }
                50%      { filter: drop-shadow(0 0 14px rgba(255, 255, 255, 1))
                                   drop-shadow(0 0 22px rgba(186, 230, 253, 0.85)); }
            }
            /* Static variant — same look minus the animation. Used by
             * routes whose operators are pouring at the destination or
             * outside their trip window. */
            .help-route-flow-static {
                stroke-linecap: round;
                filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.45));
            }
            @keyframes help-route-base-flow {
                to { stroke-dashoffset: -66; }
            }
            @keyframes help-route-flow {
                to { stroke-dashoffset: -32; }
            }
            html.dark .help-route-base {
                filter: drop-shadow(0 0 5px rgba(15, 23, 42, 0.85));
            }
            html.dark .help-route-flow {
                filter: drop-shadow(0 0 10px rgba(255, 255, 255, 1))
                        drop-shadow(0 0 18px rgba(186, 230, 253, 0.7));
            }
            html.dark .help-route-flow-static {
                filter: drop-shadow(0 0 6px rgba(186, 230, 253, 0.55));
            }
            /* Job pin — shows up at a job site only while operators
             * are actually on-site there. Amber to match the in-transit
             * route color, hard-hat glyph to read as "active pour". */
            .plan-flow-job-marker { background: transparent !important; border: none !important; }
            .pf-job-pin {
                position: relative;
                width: 28px; height: 28px;
                border-radius: 50%;
                background: #f59e0b;
                color: #fff;
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 0 0 2px var(--bg-primary), 0 2px 6px rgba(0,0,0,0.35);
                font-size: 12px;
                animation: pf-job-pin-pulse 1.6s ease-in-out infinite,
                           pf-job-pin-bob 2.4s ease-in-out infinite;
            }
            /* Second concentric ring out of phase with the box-shadow
             * pulse so the pin reads as a continuous "wave" outward
             * rather than a single beat. Lives as a pseudo-element so
             * it stays pinned to the marker geometry through Leaflet
             * pans without needing extra DOM. */
            .pf-job-pin::after {
                content: '';
                position: absolute;
                inset: -8px;
                border-radius: 50%;
                border: 2px solid rgba(245, 158, 11, 0.85);
                opacity: 0;
                animation: pf-job-pin-ring 1.6s ease-in-out infinite 0.8s;
                pointer-events: none;
            }
            .pf-job-count {
                position: absolute;
                top: -6px; right: -6px;
                min-width: 16px; height: 16px; padding: 0 4px;
                border-radius: 8px;
                background: var(--bg-primary);
                color: var(--text-primary);
                border: 1.5px solid #f59e0b;
                font-family: 'Exo 2', system-ui, sans-serif;
                font-size: 10px; font-weight: 800; line-height: 13px;
                text-align: center;
                z-index: 1;
            }
            @keyframes pf-job-pin-pulse {
                0%, 100% { box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 0 rgba(245, 158, 11, 0.55); }
                50%      { box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 6px rgba(245, 158, 11, 0); }
            }
            @keyframes pf-job-pin-ring {
                0%   { opacity: 0.7; transform: scale(0.85); }
                100% { opacity: 0;   transform: scale(1.6);  }
            }
            /* Subtle vertical bob so the active pour pin reads as
             * "alive" against a stationary basemap — concrete is
             * flowing, work is happening here. */
            @keyframes pf-job-pin-bob {
                0%, 100% { transform: translateY(0); }
                50%      { transform: translateY(-2px); }
            }
            /* Direct-load line — thin dotted slate edge connecting
             * a geocoded job location to the plant the order is
             * assigned to. Reads as a quiet "owned by" indicator
             * under the animated transit polylines. */
            .pf-direct-load-line {
                stroke-linecap: round;
            }
            html.dark .pf-direct-load-line {
                filter: drop-shadow(0 0 2px rgba(15, 23, 42, 0.85));
            }
            /* Direction arrows that walk the route while operators
             * are in transit. Color is set inline so the same icon
             * component renders green for outbound and orange for
             * the return. The marker container carries a transform
             * transition so per-tick lat/lng updates lerp smoothly
             * between frames instead of snapping (the React autoplay
             * tick runs at ~240ms; without the transition the arrow
             * visibly hops between positions). The inner glyph
             * carries its own transition for the rotation + color +
             * visibility changes. */
            .plan-flow-arrow-marker {
                background: transparent !important;
                border: none !important;
                pointer-events: none;
                transition: transform 240ms linear;
                will-change: transform;
            }
            /* Suppress the marker transform transition during a map
             * pan or zoom — otherwise every arrow lags a frame
             * behind the basemap as the projection reflows. */
            body.pf-map-moving .plan-flow-arrow-marker {
                transition: none;
            }
            .pf-route-arrow {
                width: 28px; height: 28px;
                display: flex; align-items: center; justify-content: center;
                position: relative;
                transition: transform 240ms linear, color 240ms linear, opacity 200ms ease;
                transform-origin: 50% 50%;
                will-change: transform, opacity;
            }
            /* Pulsing colored halo so each driver has a glowing
             * presence on the map; the halo inherits the truck's
             * route color via currentColor (radial gradient is
             * driven by the inline color on .pf-route-arrow). */
            .pf-truck-halo {
                position: absolute;
                inset: -3px;
                border-radius: 50%;
                background: radial-gradient(circle, currentColor 0%, transparent 65%);
                opacity: 0.55;
                animation: pf-truck-halo 1.3s ease-in-out infinite;
                pointer-events: none;
            }
            @keyframes pf-truck-halo {
                0%, 100% { opacity: 0.25; transform: scale(0.82); }
                50%      { opacity: 0.65; transform: scale(1.18); }
            }
            /* The truck glyph itself — drop-shadow gives it a slight
             * lift off the map so it doesn't fight with the polyline
             * underneath. font-size matches the 28x28 icon box. */
            .pf-truck-glyph {
                position: relative;
                font-size: 16px;
                line-height: 1;
                filter: drop-shadow(0 1px 3px rgba(15, 23, 42, 0.55));
                z-index: 1;
            }
            /* Headlight sits on the right edge of the un-rotated
             * icon. Because the marker is rotated by (bearing - 90),
             * "right" after rotation is the truck's leading edge —
             * the headlight always ends up at the front of the cab
             * regardless of bearing. */
            .pf-truck-headlight {
                position: absolute;
                right: 1px;
                top: 50%;
                width: 5px; height: 5px;
                border-radius: 50%;
                background: #fffbeb;
                box-shadow: 0 0 6px 2px rgba(254, 240, 138, 0.9),
                            0 0 12px 4px rgba(254, 240, 138, 0.35);
                transform: translateY(-50%);
                animation: pf-truck-headlight 1.4s ease-in-out infinite;
                pointer-events: none;
                z-index: 2;
            }
            @keyframes pf-truck-headlight {
                0%, 100% { opacity: 0.55; }
                50%      { opacity: 1;    }
            }
            html.dark .pf-truck-headlight {
                box-shadow: 0 0 8px 3px rgba(254, 240, 138, 0.95),
                            0 0 16px 6px rgba(254, 240, 138, 0.45);
            }
            /* Soft mount-in for the entire Planner shell so the first
             * paint of the map + chrome feels like a single staged
             * fade rather than three separate flashes. */
            .pf-flow-shell {
                animation: pf-flow-mount 320ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
            }
            @keyframes pf-flow-mount {
                0%   { opacity: 0; transform: translateY(4px); }
                100% { opacity: 1; transform: translateY(0); }
            }
            /* Animated entrance for the dynamic toolbar pills (picking
             * banner, selected-plant chip, routing spinner) so they
             * don't snap in mid-flight. */
            .pf-tool-pill {
                animation: pf-tool-pill-in 220ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
            }
            @keyframes pf-tool-pill-in {
                0%   { opacity: 0; transform: translateY(-3px) scale(0.96); }
                100% { opacity: 1; transform: translateY(0) scale(1); }
            }
            .pf-tool-pill-picking {
                animation: pf-tool-pill-in 220ms cubic-bezier(0.22, 0.61, 0.36, 1) both,
                           pf-picking-glow 1.4s ease-in-out infinite 220ms;
            }
            @keyframes pf-picking-glow {
                0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
                50%      { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.18); }
            }
            /* Selected plant pin — soft halo pulse so the dispatcher
             * keeps track of which plant is focused while the rest of
             * the map animates. Only applies when the parent marker
             * carries the .pf-plant-pin-selected class. */
            .pf-plant-pin-selected::after {
                content: '';
                position: absolute;
                inset: -8px;
                border-radius: 50%;
                border: 2px solid currentColor;
                opacity: 0.55;
                animation: pf-plant-halo 1.8s ease-in-out infinite;
                pointer-events: none;
            }
            @keyframes pf-plant-halo {
                0%, 100% { transform: scale(1);     opacity: 0.55; }
                50%      { transform: scale(1.18);  opacity: 0;    }
            }
        `}</style>
    )
}
