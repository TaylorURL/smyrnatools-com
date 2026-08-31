/* eslint-disable react/forbid-dom-props */
import React from 'react'
import ReactDOM from 'react-dom'

const SELECT_BG =
    "var(--bg-secondary) url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\") right 10px center/18px no-repeat"

export default function DetailViewTransferModal({
    accent,
    assetType,
    closeTransfer,
    currentRegion,
    doTransfer,
    plants,
    regions,
    setTargetPlant,
    setTargetRegion,
    show,
    targetPlant,
    targetRegion,
    transferErr,
    transferring
}) {
    if (!show) return null
    return ReactDOM.createPortal(
        <div
            onClick={(e) => e.target === e.currentTarget && closeTransfer()}
            className="fixed inset-0 z-drawer flex items-center justify-center bg-[var(--scrim)] p-5"
        >
            <div className="flex w-full max-w-[400px] max-h-[85vh] flex-col overflow-hidden rounded bg-bg-primary shadow-modal">
                <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ background: accent }}>
                    <span className="flex items-center gap-2.5 text-[15px] font-semibold text-white">
                        <i className="fas fa-exchange-alt"></i> Transfer Region
                    </span>
                    <button
                        type="button"
                        onClick={closeTransfer}
                        aria-label="Close"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border-none bg-white/15 text-sm text-white cursor-pointer hover:bg-white/25 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                    <div className="mb-4 rounded-[10px] bg-bg-tertiary p-3.5">
                        <div className="mb-0.5 text-[11px] font-semibold text-text-secondary">CURRENT REGION</div>
                        <div className="text-sm font-semibold text-text-primary">{currentRegion || 'Unknown'}</div>
                    </div>
                    <div className="mb-3.5">
                        <label
                            htmlFor="transfer-target-region"
                            className="mb-1.5 block text-xs font-semibold text-text-secondary"
                        >
                            Target Region
                        </label>
                        <select
                            id="transfer-target-region"
                            aria-label="Target region"
                            className="dv-input w-full cursor-pointer appearance-none rounded-[10px] border-[1.5px] border-border-light text-sm text-text-primary outline-none transition-colors duration-150 hover:border-border-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            value={targetRegion}
                            onChange={(e) => setTargetRegion(e.target.value)}
                            disabled={transferring}
                            style={{
                                background: SELECT_BG,
                                padding: '12px 40px 12px 16px'
                            }}
                        >
                            <option value="">Select Region...</option>
                            {/* Office regions own no plants to land in, and an
                                Aggregate region has no work for a mixer, so
                                neither is offered as a destination. */}
                            {regions
                                .filter(
                                    (r) =>
                                        r.regionCode !== currentRegion &&
                                        r.type !== 'Office' &&
                                        !(assetType === 'mixer' && r.type === 'Aggregate')
                                )
                                .map((r) => (
                                    <option key={r.regionCode} value={r.regionCode}>
                                        {r.regionName}
                                    </option>
                                ))}
                        </select>
                    </div>
                    {targetRegion && (
                        <div className="mb-3.5">
                            <label
                                htmlFor="transfer-target-plant"
                                className="mb-1.5 block text-xs font-semibold text-text-secondary"
                            >
                                Target Plant
                            </label>
                            <select
                                id="transfer-target-plant"
                                aria-label="Target plant"
                                className="dv-input w-full cursor-pointer appearance-none rounded-[10px] border-[1.5px] border-border-light text-sm text-text-primary outline-none transition-colors duration-150 hover:border-border-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                value={targetPlant}
                                onChange={(e) => setTargetPlant(e.target.value)}
                                disabled={transferring || !plants.length}
                                style={{
                                    background: SELECT_BG,
                                    padding: '12px 40px 12px 16px'
                                }}
                            >
                                <option value="">Select Plant...</option>
                                {plants.map((p) => (
                                    <option key={p.plantCode || p.plant_code} value={p.plantCode || p.plant_code}>
                                        {p.plantName || p.plant_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    {transferErr && (
                        <div className="flex items-center gap-2 rounded-lg bg-[var(--tint-danger-wash)] px-3 py-2.5 text-xs text-text-primary">
                            <i className="fas fa-exclamation-circle"></i>
                            {transferErr}
                        </div>
                    )}
                </div>
                <div className="flex gap-2.5 border-t border-border-light bg-bg-secondary px-5 py-3.5">
                    <button
                        type="button"
                        className="dv-btn flex-1 rounded-[10px] border-none bg-bg-tertiary px-4 py-2.5 text-[13px] font-semibold text-text-secondary cursor-pointer"
                        onClick={closeTransfer}
                        disabled={transferring}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="dv-btn flex-1 flex items-center justify-center gap-2 rounded-[10px] border-none px-4 py-2.5 text-[13px] font-semibold text-white"
                        onClick={doTransfer}
                        disabled={transferring || !targetRegion || !targetPlant}
                        style={{
                            background: accent,
                            cursor: transferring || !targetRegion || !targetPlant ? 'not-allowed' : 'pointer',
                            opacity: transferring || !targetRegion || !targetPlant ? 0.5 : 1
                        }}
                    >
                        {transferring ? (
                            <>
                                <i className="fas fa-spinner fa-spin"></i> Transferring...
                            </>
                        ) : (
                            'Confirm'
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
