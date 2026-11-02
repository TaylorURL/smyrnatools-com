import React from 'react'

/** Empty state inside a history tab: a short title and an optional line of
 *  context, centred. `icon` is still accepted from callers but not drawn. */
export default function HistoryEmptyState({ title, subtitle, icon: _icon }) {
    return (
        <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
            <p className="m-0 text-[15px] font-medium text-text-primary">{title}</p>
            {subtitle && <p className="m-0 text-[13px] text-text-secondary">{subtitle}</p>}
        </div>
    )
}
