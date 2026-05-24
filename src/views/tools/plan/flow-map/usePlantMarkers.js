import L from 'leaflet'
import { useEffect } from 'react'

import { buildPlantStatus, makePlantIcon } from './flowMapIcons'

/** Sync plant markers with the latest stats / metrics. Re-runs every
 *  scrubber tick because the pin headcount + status ring walk with the
 *  view minute; the signature short-circuits the marker rebuild when none
 *  of the visible properties changed so we don't churn the DOM and steal
 *  in-flight clicks. */
export function usePlantMarkers({
    accentColor,
    activeOrdersAtTime,
    allPlantStats,
    draft,
    effAtViewTime,
    geocodedPlants,
    handleNodeClickRef,
    leaveOffByCode,
    markersByCodeRef,
    minPoolByCode,
    pickingDestination,
    planDate,
    plantLayerRef,
    plantProduction,
    poolAtViewTime,
    selectedCode,
    thresholds,
    viewTime,
    yphByCode
}) {
    useEffect(() => {
        const layer = plantLayerRef.current
        if (!layer) return
        const plantsByCode = new Map(geocodedPlants.map((p) => [p.code, p]))
        const seen = new Set()

        allPlantStats.forEach((stat) => {
            const pos = plantsByCode.get(stat.code)
            if (!pos) return
            seen.add(stat.code)
            const status = buildPlantStatus({
                accentColor,
                activeOrdersAtTime,
                draft,
                effAtViewTime,
                leaveOffByCode,
                maxYph: thresholds.MAX_YPH,
                minPoolByCode,
                pickingDestination,
                planDate,
                plantProduction,
                poolAtViewTime,
                selectedCode,
                stat,
                viewTime,
                yphByCode
            })
            // Signature of every visual property the pin renders. The
            // autoplay re-runs this effect every 120ms, but the pin
            // itself only changes when one of these flips. Without the
            // skip, every tick swaps the marker's DOM element and any
            // click landing mid-swap gets dropped — the "spam click to
            // make it open" symptom.
            const sig = [
                status.effWithMissing,
                status.ringColor,
                status.isSelected ? 1 : 0,
                status.isDestinationCandidate ? 1 : 0,
                status.needsHelp ? 1 : 0,
                status.hasLeaveOff ? 1 : 0,
                status.send,
                status.recv
            ].join('|')
            const existing = markersByCodeRef.current[stat.code]
            if (existing) {
                existing.setLatLng([pos.lat, pos.lng])
                if (existing._planFlowSig !== sig) {
                    existing.setIcon(makePlantIcon(stat, status, accentColor))
                    existing._planFlowSig = sig
                }
            } else {
                // zIndexOffset keeps the plant pin above the job pins and
                // directional arrows that sit in the same marker pane —
                // without it, a job pin near a plant could steal the
                // click event and the side panel wouldn't open.
                const marker = L.marker([pos.lat, pos.lng], {
                    icon: makePlantIcon(stat, status, accentColor),
                    riseOnHover: true,
                    zIndexOffset: 1000
                })
                marker._planFlowSig = sig
                marker.on('click', () => handleNodeClickRef.current?.(stat.code))
                marker.bindTooltip(
                    () =>
                        `<strong>Plant ${stat.code}</strong><br/>${status.effWithMissing} op${status.effWithMissing === 1 ? '' : 's'}` +
                        (status.send ? ` · sending ${status.send}` : '') +
                        (status.recv ? ` · receiving ${status.recv}` : '') +
                        (status.needsHelp ? '<br/><span style="color:#dc2626">Needs help</span>' : '') +
                        (status.hasLeaveOff ? '<br/><span style="color:#d97706">Leave off available</span>' : ''),
                    { direction: 'top', offset: [0, -10] }
                )
                marker.addTo(layer)
                markersByCodeRef.current[stat.code] = marker
            }
        })

        // Drop markers for plants that no longer have positions / stats.
        Object.keys(markersByCodeRef.current).forEach((code) => {
            if (!seen.has(code)) {
                const marker = markersByCodeRef.current[code]
                layer.removeLayer(marker)
                delete markersByCodeRef.current[code]
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        accentColor,
        activeOrdersAtTime,
        allPlantStats,
        draft,
        effAtViewTime,
        geocodedPlants,
        leaveOffByCode,
        minPoolByCode,
        pickingDestination,
        plantProduction,
        poolAtViewTime,
        selectedCode,
        thresholds.MAX_YPH,
        viewTime,
        yphByCode
    ])
}
