import React from 'react'
/** Responsive auto-fit grid container for StatCard components. Plan-tab
 *  spacing — 2px gap, no bottom margin (parent timeline supplies its own). */
export default function StatCardGrid({ children }) {
    return <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">{children}</div>
}
