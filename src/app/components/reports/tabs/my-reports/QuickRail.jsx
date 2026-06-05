import React from 'react'

const ONE_OFFS = [
    {
        icon: 'fa-flask',
        key: 'qc_strength',
        sub: 'Concrete cylinder strength & samples',
        title: 'QC Strength'
    },
    {
        icon: 'fa-vial',
        key: 'third_party_lab',
        sub: 'Report issues with lab results',
        title: 'Third-Party Lab'
    },
    {
        icon: 'fa-truck',
        key: 'lost_load',
        sub: 'Report lost or spilled loads',
        title: 'Lost Load'
    }
]

const RECENT_ICON = {
    lost_load: 'fa-truck',
    qc_strength: 'fa-flask',
    third_party_lab: 'fa-vial'
}

/**
 * Docked side rail for one-off reports + a compact "Recent" strip. Icons
 * are neutral glyphs (no per-shortcut colored tile) so the rail doesn't
 * compete with the main column's status stripes for attention.
 */
function QuickRail({
    hasQCStrengthPermission,
    hasLostLoadsPermission,
    onOpenQCStrength,
    onOpenThirdPartyLab,
    onOpenLostLoad,
    recentItems = []
}) {
    const availability = {
        lost_load: hasLostLoadsPermission,
        qc_strength: hasQCStrengthPermission,
        third_party_lab: hasQCStrengthPermission
    }
    const handlers = {
        lost_load: onOpenLostLoad,
        qc_strength: onOpenQCStrength,
        third_party_lab: onOpenThirdPartyLab
    }
    const visible = ONE_OFFS.filter((o) => availability[o.key])
    if (visible.length === 0 && recentItems.length === 0) return null
    return (
        <aside className="rounded-lg border bg-bg-primary border-border-light overflow-hidden">
            {visible.length > 0 && (
                <div className="px-3 pt-3 pb-2">
                    <div className="flex items-baseline justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-[.08em] text-text-tertiary font-heading">
                            One-off reports
                        </span>
                        <span className="text-[10px] text-text-tertiary">Submit anytime</span>
                    </div>
                    <div className="flex flex-col">
                        {visible.map((o, idx) => (
                            <button
                                key={o.key}
                                type="button"
                                onClick={() => handlers[o.key]?.()}
                                className={`flex items-center gap-3 px-2 py-2.5 text-left w-full border-none cursor-pointer bg-transparent hover:bg-bg-secondary active:scale-[0.99] transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none ${idx > 0 ? 'border-t border-border-light' : ''}`}
                            >
                                <i
                                    className={`fas ${o.icon} text-[14px] w-4 text-center text-text-secondary`}
                                    aria-hidden="true"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-[12.5px] truncate text-text-primary">
                                        {o.title}
                                    </div>
                                    <div className="text-[10.5px] truncate text-text-tertiary">{o.sub}</div>
                                </div>
                                <i className="fas fa-plus text-[10px] text-text-tertiary" aria-hidden="true" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
            {recentItems.length > 0 && (
                <div
                    className={`px-3 py-2.5 ${visible.length > 0 ? 'border-t border-border-light bg-bg-secondary' : ''}`}
                >
                    <div className="text-[10px] font-bold uppercase tracking-[.08em] text-text-tertiary mb-1.5 font-heading">
                        Recent
                    </div>
                    {recentItems.slice(0, 3).map((r, idx) => (
                        <div
                            key={r.id || idx}
                            className={`flex items-center gap-2 py-1.5 text-[11.5px] text-text-secondary ${idx > 0 ? 'border-t border-border-light' : ''}`}
                        >
                            <i
                                className={`fas ${RECENT_ICON[r.kind] || 'fa-file-alt'} w-3.5 text-[11px] text-text-tertiary`}
                                aria-hidden="true"
                            />
                            <span className="flex-1 truncate text-text-primary">{r.title}</span>
                            <span className="text-[10px] shrink-0 text-text-tertiary tabular-nums">{r.when}</span>
                        </div>
                    ))}
                </div>
            )}
        </aside>
    )
}

export default QuickRail
