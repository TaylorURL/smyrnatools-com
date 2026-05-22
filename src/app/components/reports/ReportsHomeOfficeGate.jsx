/* eslint-disable react/forbid-dom-props */
import React, { useMemo } from 'react'

import { usePreferences } from '../../context/PreferencesContext'
import { usePermittedRegions } from '../../hooks/useNavigationData'

const isOfficeRegion = (region) => {
    const type = String(region?.type ?? region?.region_type ?? '').toLowerCase()
    return type === 'office'
}

/** Picks the user's region by code regardless of which casing the
 *  upstream regions list happens to use. Mirrors the same defensive
 *  destructure the Navigation region dropdown does. */
const toSelectedRegionShape = (region) => ({
    code: region.regionCode || region.region_code || '',
    name: region.regionName || region.region_name || '',
    type: region.type || region.region_type || ''
})

/** Full-surface gate rendered over `ReportsView` whenever the user has
 *  Home Office selected as their active region. Home Office is a
 *  reporting umbrella, not a reporting territory — reports are owned
 *  by the operating regions. The gate blurs the underlying report
 *  surface (so the user can see what's behind it but can't interact)
 *  and prompts them to pick one of their permitted operating regions
 *  to view its reports. */
export function ReportsHomeOfficeGate({ userId }) {
    const { preferences, updatePreferences } = usePreferences()
    const regionCode = preferences.selectedRegion?.code || ''
    const permittedRegions = usePermittedRegions(userId, regionCode, updatePreferences)

    /** Exclude Home Office (the region the user is already in and the
     *  reason this gate is showing). Anything else they have permission
     *  to view is a candidate. */
    const operatingRegions = useMemo(
        () => (permittedRegions || []).filter((region) => !isOfficeRegion(region)),
        [permittedRegions]
    )

    const handleSelect = (region) => {
        const next = toSelectedRegionShape(region)
        if (!next.code) return
        updatePreferences('selectedRegion', next)
        window.dispatchEvent(new CustomEvent('region-changed', { detail: next }))
    }

    return (
        <div
            className="absolute inset-0 z-40 flex items-center justify-center p-4 sm:p-6"
            style={{ background: 'rgba(15, 23, 42, 0.45)' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reports-home-office-gate-title"
        >
            <div className="rounded-lg max-w-md w-full p-5 sm:p-6 bg-bg-primary border border-border-light shadow-xl flex flex-col gap-4">
                <div className="flex items-start gap-3">
                    <span
                        className="inline-flex items-center justify-center w-10 h-10 rounded-full shrink-0"
                        style={{ background: '#1e3a5f1f', color: '#1e3a5f' }}
                    >
                        <i className="fas fa-globe text-[18px]" />
                    </span>
                    <div className="min-w-0">
                        <h2
                            id="reports-home-office-gate-title"
                            className="text-[16px] sm:text-[17px] font-semibold m-0 text-text-primary leading-tight"
                        >
                            Pick a region to view reports
                        </h2>
                        <p className="text-[12.5px] text-text-secondary mt-1 leading-snug">
                            Home Office doesn&apos;t own its own reports — they live with the operating regions. Choose
                            one below to load that region&apos;s reports.
                        </p>
                    </div>
                </div>

                {operatingRegions.length === 0 ? (
                    <div className="rounded-md p-3 text-[12.5px] bg-bg-secondary border border-border-light text-text-secondary">
                        You don&apos;t have permission to view any operating region&apos;s reports. Ask an administrator
                        to grant access.
                    </div>
                ) : (
                    <ul className="flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto">
                        {operatingRegions.map((region) => {
                            const shape = toSelectedRegionShape(region)
                            return (
                                <li key={shape.code}>
                                    <button
                                        type="button"
                                        onClick={() => handleSelect(region)}
                                        className="w-full text-left rounded-md px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer border bg-bg-secondary border-border-light hover:bg-bg-tertiary transition-colors"
                                    >
                                        <span className="min-w-0">
                                            <span className="block text-[13.5px] font-semibold text-text-primary truncate">
                                                {shape.name || shape.code}
                                            </span>
                                            {shape.type && (
                                                <span className="block text-[10.5px] uppercase tracking-wider text-text-tertiary mt-0.5">
                                                    {shape.type}
                                                </span>
                                            )}
                                        </span>
                                        <i className="fas fa-arrow-right text-[11px] text-text-tertiary shrink-0" />
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>
        </div>
    )
}

export default ReportsHomeOfficeGate
