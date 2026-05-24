/* eslint-disable react/forbid-dom-props */
import React from 'react'

export default function DetailViewHeader({ headerActions, icon, onBack, onClose, subtitle, title }) {
    return (
        <div className="relative overflow-hidden border-b border-border-light bg-white">
            <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: `linear-gradient(to right, var(--accent) 1px, transparent 1px), linear-gradient(to bottom, var(--accent) 1px, transparent 1px)`,
                    backgroundSize: '20px 20px'
                }}
            ></div>
            <div className="dv-header relative flex items-center gap-4 px-6 py-4">
                <button
                    onClick={onBack || onClose}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border-none bg-slate-100 text-base text-slate-500 cursor-pointer transition-all duration-150 hover:bg-slate-200 hover:text-slate-700"
                >
                    <i className="fas fa-arrow-left"></i>
                </button>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                        {icon && <i className={`${icon} text-text-primary`} style={{ fontSize: 20 }}></i>}
                        <h1 className="dv-header-title m-0 truncate text-[22px] font-bold text-slate-900">{title}</h1>
                    </div>
                    {subtitle && <p className="m-0 mt-1 text-[13px] text-slate-500">{subtitle}</p>}
                </div>
                <div className="dv-header-actions flex items-center gap-2">{headerActions}</div>
            </div>
        </div>
    )
}
