import React from 'react'

/**
 * Embedded Google Maps preview of the driving route from the recommended
 * plant to the job address. Reuses the same iframe URL shape `JobMapModal`
 * uses on the Schedule tab so the dispatcher gets the familiar layout.
 * Only renders once the job address has actually geocoded and produced a
 * real OSRM travel time (`travelMin` finite) — that's our "address is
 * correct and working" signal, so a typo or unverified address never paints
 * a map. `dirflg=d` pins the embed to driving routes only — no transit /
 * walking / cycling alternatives.
 */
export default function RoutePreview({ jobAddress, plantAddress, plantName, travelMin }) {
    const trimmedJob = (jobAddress || '').trim()
    const trimmedPlant = (plantAddress || '').trim()
    if (!trimmedJob || !trimmedPlant) return null
    if (!Number.isFinite(travelMin)) return null
    const plantQuery = encodeURIComponent(trimmedPlant)
    const jobQuery = encodeURIComponent(trimmedJob)
    /* `output=embed` is the documented embed-in-iframe form; saddr →
     * daddr asks Google Maps to render the route between the two.
     * `dirflg=d` forces driving directions — without it Google may
     * surface transit / walking tabs for the same OD pair. */
    const mapSrc = `https://www.google.com/maps?saddr=${plantQuery}&daddr=${jobQuery}&dirflg=d&output=embed`
    const externalUrl = `https://www.google.com/maps/dir/?api=1&origin=${plantQuery}&destination=${jobQuery}&travelmode=driving`
    return (
        <div className="rounded-lg overflow-hidden bg-bg-primary border border-border-light">
            <div className="px-4 py-2.5 flex items-center gap-2 border-b border-border-light">
                <i className="fas fa-route text-[11px] text-text-tertiary" />
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-text-tertiary">
                    Route from {plantName || 'plant'} to job
                </div>
                {Number.isFinite(travelMin) && (
                    <span className="text-[11px] font-mono tabular-nums text-text-secondary">· {travelMin} min</span>
                )}
                <a
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-[11px] hover:underline text-text-tertiary"
                    title="Open this route in Google Maps"
                >
                    Open in Maps
                    <i className="fas fa-arrow-up-right-from-square text-[9px]" />
                </a>
            </div>
            <iframe
                className="block h-[280px] w-full"
                src={mapSrc}
                title={`Route from ${plantName || 'plant'} to ${trimmedJob}`}
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
            />
        </div>
    )
}
