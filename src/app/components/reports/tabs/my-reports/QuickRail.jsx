/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { usePreferences } from '../../../../context/PreferencesContext'

const ONE_OFFS = [
    {
        icon: 'fa-flask',
        iconBg: 'bg-violet-600',
        key: 'qc_strength',
        sub: 'Concrete cylinder strength & samples',
        title: 'QC Strength Report'
    },
    {
        icon: 'fa-vial',
        iconBg: 'bg-rose-600',
        key: 'third_party_lab',
        sub: 'Report issues with lab results',
        title: 'Third-Party Lab Report'
    },
    {
        icon: 'fa-truck',
        iconBg: 'bg-red-500',
        key: 'lost_load',
        sub: 'Report lost or spilled loads',
        title: 'Lost Load Report'
    }
]

const RECENT_ICON = {
    lost_load: { color: 'text-red-500', icon: 'fa-truck' },
    qc_strength: { color: 'text-violet-600', icon: 'fa-flask' },
    third_party_lab: { color: 'text-rose-600', icon: 'fa-vial' }
}

/**
 * Docked side rail with shortcut buttons for the three one-off reports
 * (QC Strength, Third-Party Lab, Lost Load) plus a compact "Recent" strip
 * showing the three most recent submissions.
 */
function QuickRail({
    hasQCStrengthPermission,
    hasLostLoadsPermission,
    onOpenQCStrength,
    onOpenThirdPartyLab,
    onOpenLostLoad,
    recentItems = []
}) {
    const { preferences } = usePreferences()
    const accent = preferences.accentColor || '#1e3a5f'
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
        <aside className="rounded-lg p-4 border bg-bg-primary border-border-light">
            {visible.length > 0 && (
                <>
                    <div className="flex items-center gap-2 mb-3">
                        <i className="fas fa-bolt text-[13px]" style={{ color: accent }} />
                        <span className="font-bold text-[14px] text-text-primary font-heading">One-off reports</span>
                        <span className="ml-auto text-[11px] text-text-secondary">Submit anytime</span>
                    </div>
                    <div className="flex flex-col gap-2">
                        {visible.map((o) => (
                            <button
                                key={o.key}
                                type="button"
                                onClick={() => handlers[o.key]?.()}
                                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left w-full transition-colors border-none cursor-pointer hover:opacity-90 bg-bg-tertiary text-text-primary"
                            >
                                <div
                                    className={`w-7 h-7 rounded-md ${o.iconBg} text-white flex items-center justify-center shrink-0`}
                                >
                                    <i className={`fas ${o.icon} text-[11px]`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-[12.5px] truncate text-text-primary">
                                        {o.title}
                                    </div>
                                    <div className="text-[10.5px] truncate text-text-secondary">{o.sub}</div>
                                </div>
                                <i className="fas fa-plus text-[11px]" style={{ color: accent }} />
                            </button>
                        ))}
                    </div>
                </>
            )}
            {recentItems.length > 0 && (
                <div className="mt-3.5 px-3 py-2.5 rounded-lg bg-bg-tertiary">
                    <div className="text-[11px] font-semibold mb-1.5 text-text-secondary">Recent</div>
                    {recentItems.slice(0, 3).map((r, idx) => {
                        const cfg = RECENT_ICON[r.kind] || { color: 'text-slate-500', icon: 'fa-file-alt' }
                        return (
                            <div
                                key={r.id || idx}
                                className="flex items-center gap-2 py-1.5 border-t first:border-t-0 text-[11.5px] border-border-light text-text-primary"
                            >
                                <i className={`fas ${cfg.icon} ${cfg.color} w-3.5 text-[11px]`} />
                                <span className="flex-1 truncate">{r.title}</span>
                                <span className="text-[10px] shrink-0 text-text-secondary">{r.when}</span>
                            </div>
                        )
                    })}
                </div>
            )}
        </aside>
    )
}

export default QuickRail
