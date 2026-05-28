import React from 'react'

import { JOB_PIN_COLOR, LEAVE_OFF_COLOR, NEEDS_HELP_COLOR, PICKING_COLOR, ROUTE_IDLE_COLOR } from './flowMapShared'

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
                transition: transform 0.16s cubic-bezier(0.23, 1, 0.32, 1);
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
            /* Leave-off popup chip — sits at the pin's top-right corner
             * as a small teal callout reading "−N" (count of operators
             * who can be left off today). Lives outside the ring chain
             * so a plant in good standing doesn't get a misleading
             * status ring just because it has slack. */
            .pf-plant-leave-popup {
                position: absolute;
                top: -8px; right: -10px;
                min-width: 22px; height: 18px;
                padding: 0 5px;
                border-radius: 4px;
                background: ${LEAVE_OFF_COLOR};
                color: #fff;
                font-family: 'Exo 2', system-ui, sans-serif;
                font-size: 10px; font-weight: 800; line-height: 14px;
                text-align: center;
                border: 2px solid var(--bg-primary);
                box-shadow: 0 1px 3px rgba(15, 23, 42, 0.25);
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
                pointer-events: auto;
                cursor: help;
            }
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
            /* Help-route lines — the colored base flows toward the
             * destination via a long-dash stroke-dashoffset animation,
             * with a faster dashed overlay on top for high-frequency
             * texture. Two layers at different rates read as a
             * continuous river of traffic instead of a static line
             * with a marching overlay. The brightness-breathing on the
             * overlay was removed — steady flow reads as calmer and
             * more professional. */
            .help-route-base {
                stroke-linecap: round;
                filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.35));
            }
            .help-route-base-active {
                animation: help-route-base-flow 1.6s linear infinite;
            }
            .help-route-flow {
                animation: help-route-flow 1s linear infinite;
                filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.7));
            }
            /* Static variant — same look minus the animation. Used by
             * routes whose operators are pouring at the destination or
             * outside their trip window. */
            .help-route-flow-static {
                stroke-linecap: round;
                filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.4));
            }
            @keyframes help-route-base-flow {
                to { stroke-dashoffset: -66; }
            }
            @keyframes help-route-flow {
                to { stroke-dashoffset: -32; }
            }
            html.dark .help-route-base {
                filter: drop-shadow(0 0 3px rgba(15, 23, 42, 0.85));
            }
            html.dark .help-route-flow {
                filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.8));
            }
            html.dark .help-route-flow-static {
                filter: drop-shadow(0 0 3px rgba(186, 230, 253, 0.45));
            }
            /* Job pin — shows up at a job site only while operators
             * are actually on-site there. Amber to match "active pour".
             * Single animation now: a concentric expanding ring (no
             * stacked box-shadow pulse, no vertical bob) — calmer and
             * still clearly reads as "active work happening here". */
            .plan-flow-job-marker { background: transparent !important; border: none !important; }
            .pf-job-pin {
                position: relative;
                width: 28px; height: 28px;
                border-radius: 50%;
                background: ${JOB_PIN_COLOR};
                color: #fff;
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 0 0 2px var(--bg-primary), 0 2px 6px rgba(0, 0, 0, 0.3);
                font-size: 12px;
            }
            .pf-job-pin::after {
                content: '';
                position: absolute;
                inset: -6px;
                border-radius: 50%;
                border: 2px solid ${JOB_PIN_COLOR};
                opacity: 0;
                animation: pf-job-pin-ring 2s ease-out infinite;
                pointer-events: none;
            }
            .pf-job-count {
                position: absolute;
                top: -6px; right: -6px;
                min-width: 16px; height: 16px; padding: 0 4px;
                border-radius: 8px;
                background: var(--bg-primary);
                color: var(--text-primary);
                border: 1.5px solid ${JOB_PIN_COLOR};
                font-family: 'Exo 2', system-ui, sans-serif;
                font-size: 10px; font-weight: 800; line-height: 13px;
                text-align: center;
                z-index: 1;
            }
            /* Inactive job pin — drivers have either left or haven't
             * arrived yet. Same shape, same hat icon, but switched to
             * the idle-slate color and a softer opacity so the pin
             * reads as "context: this job site exists today" without
             * pulling focus from active pours. Matches the slate-600
             * idle polyline treatment. */
            .pf-job-pin-inactive {
                background: ${ROUTE_IDLE_COLOR} !important;
                opacity: 0.7;
            }
            .pf-job-pin-inactive::after {
                display: none;
            }
            .pf-job-pin-inactive .pf-job-count {
                border-color: ${ROUTE_IDLE_COLOR};
                color: var(--text-secondary);
            }
            @keyframes pf-job-pin-ring {
                0%   { opacity: 0.65; transform: scale(0.9); }
                100% { opacity: 0;    transform: scale(1.5); }
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
             * component renders emerald for outbound and orange for
             * the return. The marker container carries a transform
             * transition so per-tick lat/lng updates lerp smoothly
             * between frames instead of snapping. */
            .plan-flow-arrow-marker {
                background: transparent !important;
                border: none !important;
                pointer-events: none;
                transition: transform 240ms linear;
                will-change: transform;
            }
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
            /* Soft colored halo behind each truck — slower and gentler
             * than before so it reads as presence, not panic. Inherits
             * the route color via currentColor. */
            .pf-truck-halo {
                position: absolute;
                inset: -3px;
                border-radius: 50%;
                background: radial-gradient(circle, currentColor 0%, transparent 65%);
                opacity: 0.45;
                animation: pf-truck-halo 2s ease-in-out infinite;
                pointer-events: none;
            }
            @keyframes pf-truck-halo {
                0%, 100% { opacity: 0.25; transform: scale(0.88); }
                50%      { opacity: 0.55; transform: scale(1.12); }
            }
            .pf-truck-glyph {
                position: relative;
                font-size: 16px;
                line-height: 1;
                filter: drop-shadow(0 1px 3px rgba(15, 23, 42, 0.55));
                z-index: 1;
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
                           pf-picking-glow 2s ease-in-out infinite 220ms;
            }
            @keyframes pf-picking-glow {
                0%, 100% { box-shadow: 0 0 0 0 rgba(34, 211, 238, 0); }
                50%      { box-shadow: 0 0 0 6px rgba(34, 211, 238, 0.22); }
            }
            /* Selected plant pin — soft halo pulse so the dispatcher
             * keeps track of which plant is focused while the rest of
             * the map animates. Slower + softer than before so it
             * doesn't compete with route motion. */
            .pf-plant-pin-selected::after {
                content: '';
                position: absolute;
                inset: -8px;
                border-radius: 50%;
                border: 2px solid ${PICKING_COLOR};
                opacity: 0.4;
                animation: pf-plant-halo 2.4s ease-in-out infinite;
                pointer-events: none;
            }
            @keyframes pf-plant-halo {
                0%, 100% { transform: scale(1);     opacity: 0.4; }
                50%      { transform: scale(1.18);  opacity: 0;   }
            }
            /* Respect prefers-reduced-motion — kill the looping flows,
             * halos, and pulses; transitions on hover/interaction are
             * left alone since they're triggered by the user, not the
             * autoplay cycle. */
            @media (prefers-reduced-motion: reduce) {
                .help-route-base-active,
                .help-route-flow,
                .pf-job-pin::after,
                .pf-truck-halo,
                .pf-tool-pill-picking,
                .pf-plant-pin-selected::after,
                .pf-flow-shell,
                .pf-tool-pill {
                    animation: none !important;
                }
                .help-route-flow {
                    opacity: 0.85;
                }
            }
        `}</style>
    )
}
