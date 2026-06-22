/* eslint-disable react/forbid-dom-props */
import React, { useState } from 'react'

import { formatSaturdayLabel } from '../../constants/saturdayForecastConstants'
import { useAccentColor } from '../../hooks/useAccentColor'
import { useSaturdayForecastPrompt } from '../../hooks/useSaturdayForecastPrompt'
import SaturdayForecastModal from './SaturdayForecastModal'

/**
 * Compact dashboard banner that prompts plant managers to submit operator-count
 * forecasts for the upcoming Saturday. Renders nothing when there are no plants
 * pending for the current user — safe to always mount above the dashboard
 * scroll content.
 *
 * The banner intentionally has no dismiss button: the prompt persists until
 * every managed plant has a forecast on record for the week. Managers can,
 * however, close the modal at any time and re-open it from the banner.
 */
export default function SaturdayForecastBanner() {
    const accentColor = useAccentColor()
    const { needsPrompt, pendingPlants, saturdayDate, submittedPlants, refresh } = useSaturdayForecastPrompt()
    const [modalOpen, setModalOpen] = useState(false)

    if (!needsPrompt) return null

    const pendingCount = pendingPlants.length
    const saturdayLabel = formatSaturdayLabel(saturdayDate)
    const tint = `${accentColor}14`
    const tintHover = `${accentColor}22`

    const openModal = () => setModalOpen(true)
    const closeModal = () => setModalOpen(false)
    const handleSubmitted = () => {
        refresh()
        setModalOpen(false)
    }

    return (
        <>
            <div className="px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4">
                <button type="button"
                    onClick={openModal}
                    aria-label={`Open Saturday operator forecast form for ${saturdayLabel}`}
                    className="group w-full flex flex-col items-stretch sm:flex-row sm:items-center gap-3 sm:gap-4 rounded-lg border-l-[3px] pl-3 sm:pl-4 pr-3 sm:pr-4 py-2.5 sm:py-3 text-left bg-bg-primary border border-border-light cursor-pointer transition-[background-color,box-shadow,border-color] duration-150 ease-out motion-reduce:transition-none hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--accent)_35%,transparent)] active:scale-[0.997] animate-fade-slide-in motion-reduce:animate-none"
                    style={{
                        background: `linear-gradient(to right, ${tint}, transparent 60%)`,
                        borderLeftColor: accentColor
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = `linear-gradient(to right, ${tintHover}, transparent 60%)`
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = `linear-gradient(to right, ${tint}, transparent 60%)`
                    }}
                >
                    <span
                        className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-md self-start sm:self-auto"
                        style={{ background: tintHover, color: accentColor }}
                        aria-hidden="true"
                    >
                        <i className="fas fa-calendar-week text-[15px]" />
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="text-[13px] sm:text-[13.5px] font-semibold leading-snug text-text-primary">
                            Set Saturday operator counts for your plants
                        </span>
                        <span className="text-[11.5px] sm:text-[12px] leading-snug text-text-secondary">
                            <span className="tabular-nums">{saturdayLabel}</span>
                            <span className="text-text-tertiary"> · </span>
                            <span className="tabular-nums">
                                {pendingCount} plant{pendingCount === 1 ? '' : 's'} pending
                            </span>
                            {submittedPlants.length > 0 && (
                                <>
                                    <span className="text-text-tertiary"> · </span>
                                    <span className="tabular-nums">{submittedPlants.length} submitted</span>
                                </>
                            )}
                        </span>
                    </span>
                    <span
                        className="self-stretch sm:self-auto inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold text-white shrink-0 transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none group-hover:opacity-95 group-active:scale-[0.97]"
                        style={{ background: accentColor }}
                    >
                        Open form
                        <i className="fas fa-arrow-right text-[11px]" aria-hidden="true" />
                    </span>
                </button>
            </div>
            {modalOpen && (
                <SaturdayForecastModal
                    accentColor={accentColor}
                    onClose={closeModal}
                    onSubmitted={handleSubmitted}
                    pendingPlants={pendingPlants}
                    saturdayDate={saturdayDate}
                    submittedPlants={submittedPlants}
                />
            )}
        </>
    )
}
