/* eslint-disable react/forbid-dom-props */
import React from 'react'
import ReactDOM from 'react-dom'

/** Pre-submit validation modal — single accent color, compact typography,
 *  no marketing copy. Progress bar fills as each operator's comment is
 *  checked; for the plant_manager path the row count is just 1 so the
 *  bar reads as a generic loader. */
const AIValidatingModal = ({ progress, accentColor }) => {
    const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
    if (typeof document === 'undefined' || !document.body) return null
    return ReactDOM.createPortal(
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4"
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <div
                className="w-full max-w-sm rounded-lg overflow-hidden bg-bg-primary border border-border-light"
                style={{ boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)' }}
            >
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border-light">
                    <div
                        className="flex h-9 w-9 items-center justify-center rounded shrink-0"
                        style={{ background: 'var(--bg-tertiary)' }}
                    >
                        <i
                            className="fas fa-circle-notch fa-spin text-[14px]"
                            style={{ color: accentColor }}
                            aria-hidden="true"
                        />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[13px] font-semibold leading-tight text-text-primary">
                            Validating report
                        </div>
                        <div className="text-[11px] mt-0.5 text-text-tertiary">Running pre-submission checks</div>
                    </div>
                </div>
                <div className="px-5 py-4">
                    {progress.total > 0 ? (
                        <>
                            <div className="flex items-center justify-between text-[11px] mb-2 text-text-tertiary tabular-nums">
                                <span>
                                    {progress.current} of {progress.total} operator
                                    {progress.total === 1 ? '' : 's'}
                                </span>
                                <span className="font-mono">{pct}%</span>
                            </div>
                            <div
                                className="h-1.5 w-full rounded-full overflow-hidden"
                                style={{ background: 'var(--bg-tertiary)' }}
                            >
                                <div
                                    className="h-full transition-all duration-300"
                                    style={{ background: accentColor, width: `${pct}%` }}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-2 text-[12px] text-text-tertiary">
                            <i className="fas fa-circle-notch fa-spin text-[10px]" aria-hidden="true" />
                            <span>Preparing…</span>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}

export default AIValidatingModal
