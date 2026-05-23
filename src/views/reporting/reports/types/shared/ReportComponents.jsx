import React from 'react'

const RPT_INPUT =
    'w-full rounded-md border border-gray-200 bg-bg-primary px-3.5 py-2.5 text-sm text-slate-800 box-border disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10'
const RPT_TEXTAREA = `${RPT_INPUT} min-h-[60px] resize-y`
const TH_STYLE =
    'bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-gray-200'
const TD_STYLE =
    'px-4 py-3 text-[0.9375rem] text-slate-800 border-b border-slate-100 align-middle bg-bg-primary last:border-b-0'

export function EmptyState({ icon = 'fa-inbox', title, subtitle, success = false }) {
    return (
        <div
            className={`text-center p-8 rounded-lg text-[0.9375rem] text-slate-500 ${success ? 'bg-green-50' : 'bg-slate-50'}`}
        >
            {icon && (
                <i
                    className={`fas ${icon} text-4xl mb-3 block ${success ? 'text-text-primary' : 'text-slate-300'}`}
                ></i>
            )}
            {title && <h4>{title}</h4>}
            {subtitle && <p>{subtitle}</p>}
        </div>
    )
}

export function SectionHeader({ icon, title, subtitle }) {
    return (
        <div className="flex items-start gap-3 mb-5">
            {icon && (
                <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-sky-100 text-text-primary text-base">
                    <i className={`fas ${icon}`}></i>
                </div>
            )}
            <div>
                <h3 className="text-lg font-semibold text-slate-800 m-0">{title}</h3>
                {subtitle && <p className="text-sm text-slate-500 mt-1 mb-0">{subtitle}</p>}
            </div>
        </div>
    )
}

export { RPT_INPUT, RPT_TEXTAREA, TD_STYLE, TH_STYLE }
