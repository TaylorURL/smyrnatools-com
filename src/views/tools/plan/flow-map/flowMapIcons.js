import L from 'leaflet'

import { yphColorFor } from '../../../../utils/PlanFlowLayoutUtility'
import { getMissingOperators, getSaturdayOverride, isSaturday } from '../../../../utils/PlanUtility'
import {
    LEAVE_OFF_COLOR,
    NEEDS_HELP_COLOR,
    PICKING_COLOR,
    PLANT_RADIUS_MAX,
    PLANT_RADIUS_MIN,
    ROUTE_IDLE_COLOR,
    ROUTE_OUTBOUND_COLOR,
    ROUTE_RETURN_COLOR
} from './flowMapShared'

/** Build a Leaflet DivIcon for a single driver moving along their route.
 *  Visuals — a soft colored halo behind the marker so each driver has
 *  presence against the basemap, a clean rounded-corner chevron rendered
 *  as inline SVG (renders crisp at any pixel scale and avoids relying on
 *  a font-icon glyph at marker resolution), and a small bright
 *  leading-edge dot that reads as a headlight. The outer
 *  `.pf-route-arrow` class stays as the rotation / opacity target so
 *  `updateArrow` can keep mutating the DOM in place across ticks without
 *  rebuilding the icon (rebuilding resets the in-flight CSS transition
 *  and produces the visible "jump" between frames). The chevron points
 *  to the right by default, so the existing `bearing - 90` rotation lands
 *  the tip pointing toward the destination. */
export function makeArrowIcon({ active, color, rotationDeg }) {
    const svg = `
        <svg class="pf-truck-glyph" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M5 4.5 C5 3.4 6.1 2.7 7.1 3.2 L20.3 11 C21.2 11.5 21.2 12.5 20.3 13 L7.1 20.8 C6.1 21.3 5 20.6 5 19.5 Z"
                  fill="currentColor"
                  stroke="rgba(255, 255, 255, 0.85)"
                  stroke-width="1.5"
                  stroke-linejoin="round" />
        </svg>`
    return L.divIcon({
        className: 'plan-flow-arrow-marker',
        html:
            `<div class="pf-route-arrow" ` +
            `style="color:${color};transform:rotate(${rotationDeg.toFixed(1)}deg);opacity:${active ? 1 : 0}">` +
            `<span class="pf-truck-halo"></span>` +
            svg +
            `<span class="pf-truck-headlight"></span>` +
            `</div>`,
        iconAnchor: [14, 14],
        iconSize: [28, 28]
    })
}

/** Mutate an existing arrow marker in-place without rebuilding its DOM.
 *  Lets CSS transitions on `transform` (rotation) and `opacity` actually
 *  fire — `setIcon` would replace the inner element and snap-reset every
 *  in-flight transition, which is the visible "jump" between ticks.
 *  Rotation is normalized to the nearest equivalent angle within ±180°
 *  of the previously displayed value so a bearing flip across ±180°
 *  (a 2° real-world turn) doesn't make the CSS transition spin the arrow
 *  ~358° the long way around. */
export function updateArrow(marker, { active, color, rotationDeg }) {
    if (!marker?._icon) return
    const inner = marker._icon.querySelector('.pf-route-arrow')
    if (!inner) {
        marker.setIcon(makeArrowIcon({ active, color, rotationDeg }))
        return
    }
    const prev = Number.isFinite(marker._pfArrowRotation) ? marker._pfArrowRotation : rotationDeg
    let normalized = rotationDeg
    while (normalized - prev > 180) normalized -= 360
    while (normalized - prev < -180) normalized += 360
    marker._pfArrowRotation = normalized
    inner.style.transform = `rotate(${normalized.toFixed(1)}deg)`
    const desiredOpacity = active ? '1' : '0'
    if (inner.style.opacity !== desiredOpacity) inner.style.opacity = desiredOpacity
    if (inner.style.color !== color) inner.style.color = color
}

/** Translate one assignment's `{ outbound, returning }` activity state
 *  into the Leaflet style objects for both legs. The outbound polyline
 *  reads green while operators are en-route to help and tones down once
 *  they've arrived; the return polyline reads orange only while they're
 *  actually heading home, otherwise it sits muted so the geometry stays
 *  readable without competing with the active leg. */
export function makeLegStyles({ activity, isInvolved, selectedCode }) {
    const selectionOpacity = isInvolved ? 1 : selectedCode ? 0.35 : 0.85

    const leg = (state, activeColor) => {
        const isTransit = state === 'transit'
        const isAtDest = state === 'at-dest'
        const activityOpacity = isTransit ? 1 : isAtDest ? 0.45 : 0.18
        const opacityScale = Math.min(activityOpacity, selectionOpacity)
        const baseColor = isTransit ? activeColor : ROUTE_IDLE_COLOR
        return {
            base: {
                // Long-dash pattern on the active base so the colored route
                // itself visibly flows toward the destination — the dashes
                // are large enough to read as nearly-solid, but their
                // forward shift gives the route real motion. Idle / at-dest
                // legs keep the original solid base so they sit quietly.
                className: isTransit ? 'help-route-base help-route-base-active' : 'help-route-base',
                color: baseColor,
                dashArray: isTransit ? '60 6' : null,
                lineCap: 'round',
                opacity: (isTransit ? 0.95 : 0.62) * opacityScale,
                weight: isInvolved ? 7 : 6
            },
            flow: {
                className: isTransit ? 'help-route-flow' : 'help-route-flow-static',
                color: '#ffffff',
                dashArray: '16 16',
                lineCap: 'round',
                opacity: (isTransit ? 1 : isAtDest ? 0 : 0.5) * opacityScale,
                weight: isInvolved ? 4 : 3
            }
        }
    }

    const outbound = leg(activity.outbound, ROUTE_OUTBOUND_COLOR)
    const returning = leg(activity.returning, ROUTE_RETURN_COLOR)
    return {
        outboundBase: outbound.base,
        outboundFlow: outbound.flow,
        returnBase: returning.base,
        returnFlow: returning.flow
    }
}

/** Visual diameter (px) for a plant based on its effective operator count.
 *  Mirrors the schematic Planner's sizing so dense plants read first. */
function radiusForOps(ops) {
    const n = Math.max(0, Number.isFinite(ops) ? ops : 0)
    const scaled = PLANT_RADIUS_MIN + Math.sqrt(n) * 4
    return Math.round(Math.max(PLANT_RADIUS_MIN, Math.min(PLANT_RADIUS_MAX, scaled)))
}

/** Computes the rich status snapshot for a plant — derived from the
 *  schematic Planner's `PlanFlowNode` so map markers carry the same
 *  needs-help / leave-off / yph cues without duplicating the entire
 *  visual component. */
export function buildPlantStatus({
    accentColor,
    activeOrdersAtTime,
    draft,
    effAtViewTime,
    leaveOffByCode,
    maxYph,
    minPoolByCode,
    pickingDestination,
    planDate,
    plantProduction,
    poolAtViewTime,
    selectedCode,
    stat,
    viewTime,
    yphByCode
}) {
    const { eff = 0, recv = 0, send = 0, base = 0 } = stat
    /* On Saturdays with a per-plant override, the override IS the
     * working count — the dispatcher already factored sick / vacation
     * into that number, so skip the missing-operator subtraction.
     * Other days fall back to the normal getMissingOperators path. */
    const saturdayOverrideActive = isSaturday(planDate) && getSaturdayOverride(plantProduction, stat.code) != null
    const missingAtPlant = saturdayOverrideActive ? 0 : getMissingOperators(plantProduction, stat.code)
    /* When the scrubber is active, the headcount on the pin walks the
     * help schedule minute-by-minute (subtracted while operators are en
     * route, credited at the destination once they arrive, returned home
     * after they leave). Falls back to the day-wide effective count in
     * "All day" mode. */
    const liveEff =
        Number.isFinite(viewTime) && effAtViewTime && Number.isFinite(effAtViewTime[stat.code])
            ? effAtViewTime[stat.code]
            : eff
    const effWithMissing = Math.max(0, liveEff - missingAtPlant)
    const yph = yphByCode[stat.code]
    const isTimeView = Number.isFinite(viewTime)
    const poolNow = isTimeView ? poolAtViewTime?.[stat.code] : null
    const activeNow = isTimeView ? activeOrdersAtTime?.[stat.code]?.length || 0 : 0
    const timeDeficit = isTimeView && Number.isFinite(poolNow) && poolNow < 0 && activeNow > 0 ? -poolNow : 0
    const minPool = minPoolByCode?.[stat.code]
    const peakOverbookShortage = isTimeView ? timeDeficit : Number.isFinite(minPool) && minPool < 0 ? -minPool : 0
    const needsHelp = isTimeView ? timeDeficit > 0 : (yph != null && yph > maxYph) || peakOverbookShortage > 0
    const leaveOffInfo = !needsHelp && !isTimeView ? leaveOffByCode?.[stat.code] || { count: 0 } : { count: 0 }
    const hasLeaveOff = (leaveOffInfo.count || 0) > 0
    const isSelected = selectedCode === stat.code
    const isDestinationCandidate = pickingDestination && draft && stat.code !== draft.fromPlant
    const ringColor = needsHelp
        ? NEEDS_HELP_COLOR
        : hasLeaveOff
          ? LEAVE_OFF_COLOR
          : isSelected
            ? accentColor
            : isDestinationCandidate
              ? PICKING_COLOR
              : yphColorFor(yph, accentColor) || 'var(--border-medium)'
    return {
        base,
        effWithMissing,
        hasLeaveOff,
        isDestinationCandidate,
        isSelected,
        needsHelp,
        recv,
        ringColor,
        send
    }
}

/** Builds the DivIcon HTML for a single plant marker. Same visual
 *  vocabulary as the schematic Planner — sized by ops count, status ring
 *  in the same colour. Click handling is wired via Leaflet's marker
 *  click event rather than HTML onclick. */
export function makePlantIcon(stat, status, accentColor) {
    const r = radiusForOps(status.effWithMissing)
    const codeFontSize = Math.max(13, Math.min(18, Math.round(r * 0.32)))
    const ringWidth = status.isSelected ? 4 : status.isDestinationCandidate ? 4 : 3
    /* The `pf-plant-pin-selected` modifier turns on the halo pulse CSS so
     * the focused plant keeps a soft ring expanding around it while the
     * dispatcher works the side panel — much easier to keep track of
     * "which plant am I editing?" when the map is animating routes. */
    const pinClass = `pf-plant-pin${status.isSelected ? ' pf-plant-pin-selected' : ''}`
    return L.divIcon({
        className: 'plan-flow-map-marker',
        html: `
            <div class="${pinClass}" style="
                width:${r}px;height:${r}px;
                box-shadow:0 0 0 ${ringWidth}px ${status.ringColor}, 0 2px 6px rgba(0,0,0,0.35);
                background:${status.isSelected ? accentColor : 'var(--bg-primary)'};
                color:${status.isSelected ? '#fff' : 'var(--text-primary)'};
            ">
                <div class="pf-plant-code" style="font-size:${codeFontSize}px">${stat.code}</div>
                <div class="pf-plant-ops">${status.effWithMissing}<span>OP${status.effWithMissing === 1 ? '' : 'S'}</span></div>
                ${status.needsHelp ? '<div class="pf-plant-badge pf-needs">!</div>' : ''}
                ${status.hasLeaveOff ? '<div class="pf-plant-badge pf-leave">·</div>' : ''}
            </div>
        `,
        iconAnchor: [r / 2, r / 2],
        iconSize: [r, r]
    })
}
