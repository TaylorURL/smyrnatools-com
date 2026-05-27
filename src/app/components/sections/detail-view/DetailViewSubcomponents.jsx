/* eslint-disable react/forbid-dom-props */
import React, { useContext, useEffect } from 'react'

import { usePreferences } from '../../../context/PreferencesContext'
import StarRating from '../../common/StarRating'
import { DetailViewContext } from './DetailViewContext'

const DEFAULT_ACCENT = '#1e3a5f'

export function Section({ id, title, icon, children }) {
    const { activeSection, registerSection } = useContext(DetailViewContext)
    const { preferences } = usePreferences()
    const accent = preferences.accentColor || DEFAULT_ACCENT
    useEffect(() => {
        registerSection({ icon, id, title })
    }, [id, title, icon, registerSection])
    if (activeSection !== id) return null
    const childArray = React.Children.toArray(children)
    const count = childArray.length
    const getGridClass = () => {
        if (count === 1) return 'flex flex-col gap-5'
        return 'grid grid-cols-2 gap-5'
    }
    const renderChildren = () => {
        if (count === 3) {
            return (
                <>
                    {childArray[0]}
                    {childArray[1]}
                    <div className="col-span-full">{childArray[2]}</div>
                </>
            )
        }
        if (count === 5) {
            return (
                <>
                    {childArray[0]}
                    {childArray[1]}
                    {childArray[2]}
                    {childArray[3]}
                    <div className="col-span-full">{childArray[4]}</div>
                </>
            )
        }
        return childArray
    }
    return (
        <div className="flex flex-col gap-5">
            <div className="dv-section-header flex items-center gap-3.5">
                <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px]"
                    style={{ background: `${accent}12` }}
                >
                    <i className={`${icon} text-text-primary`} style={{ fontSize: 20 }}></i>
                </div>
                <h2 className="m-0 text-[22px] font-bold text-slate-800">{title}</h2>
            </div>
            <div className={`dv-section-grid ${getGridClass()}`}>{renderChildren()}</div>
        </div>
    )
}

export function Card({ title, icon, children, actions, fullWidth }) {
    const { preferences } = usePreferences()
    const accent = preferences.accentColor || DEFAULT_ACCENT
    return (
        <div
            className={`overflow-hidden rounded border border-border-light bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${fullWidth ? 'col-[1_/_-1]' : ''}`}
        >
            {title && (
                <div className="flex items-center justify-between gap-2.5 border-b border-border-light bg-slate-50 px-5 py-3.5">
                    <div className="flex items-center gap-2.5 text-[15px] font-semibold text-slate-800">
                        {icon && <i className={`${icon} text-text-primary`} style={{ fontSize: 15 }}></i>}
                        {title}
                    </div>
                    {actions && <div className="flex items-center gap-2">{actions}</div>}
                </div>
            )}
            <div className="flex flex-col gap-4 p-5">{children}</div>
        </div>
    )
}

export function Row({ children, cols = 2 }) {
    return (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {children}
        </div>
    )
}

export function Field({ label, value, empty = '-', icon }) {
    const { preferences } = usePreferences()
    const accent = preferences.accentColor || DEFAULT_ACCENT
    return (
        <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-500">
                {icon && <i className={`${icon} text-text-primary`} style={{ fontSize: 11 }}></i>}
                {label}
            </span>
            <span
                className={`rounded-[10px] border border-border-light bg-slate-50 px-3.5 py-2.5 text-sm font-medium ${value ? 'text-slate-800' : 'text-slate-400'}`}
            >
                {value || empty}
            </span>
        </div>
    )
}

export function Input({ label, icon, ...props }) {
    const { preferences } = usePreferences()
    const accent = preferences.accentColor || DEFAULT_ACCENT
    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700">
                    {icon && <i className={`${icon} text-text-primary`} style={{ fontSize: 12 }}></i>}
                    {label}
                </label>
            )}
            <input
                {...props}
                className="dv-input w-full rounded-[10px] border-[1.5px] border-border-light bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition-[border-color,box-shadow] duration-150"
                style={props.style}
            />
        </div>
    )
}

export function Select({ label, icon, options = [], placeholder, ...props }) {
    const { preferences } = usePreferences()
    const accent = preferences.accentColor || DEFAULT_ACCENT
    const selectBg =
        "var(--bg-primary) url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\") right 12px center/16px no-repeat"
    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700">
                    {icon && <i className={`${icon} text-text-primary`} style={{ fontSize: 12 }}></i>}
                    {label}
                </label>
            )}
            <select
                {...props}
                className="dv-input w-full cursor-pointer appearance-none rounded-[10px] border-[1.5px] border-border-light text-sm text-slate-800 outline-none"
                style={{
                    background: selectBg,
                    padding: '12px 40px 12px 14px',
                    ...props.style
                }}
            >
                {placeholder && <option value="">{placeholder}</option>}
                {options.map((opt) => (
                    <option
                        key={typeof opt === 'string' ? opt : opt.value}
                        value={typeof opt === 'string' ? opt : opt.value}
                    >
                        {typeof opt === 'string' ? opt : opt.label}
                    </option>
                ))}
            </select>
        </div>
    )
}

export function Textarea({ label, icon, ...props }) {
    const { preferences } = usePreferences()
    const accent = preferences.accentColor || DEFAULT_ACCENT
    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <label className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700">
                    {icon && <i className={`${icon} text-text-primary`} style={{ fontSize: 12 }}></i>}
                    {label}
                </label>
            )}
            <textarea
                {...props}
                className="dv-input w-full min-h-[120px] resize-y rounded-[10px] border-[1.5px] border-border-light bg-white px-3.5 py-3 text-sm leading-[1.6] text-slate-800 outline-none transition-[border-color,box-shadow] duration-150"
                style={props.style}
            />
        </div>
    )
}

export function Button({ variant = 'primary', block, children, ...props }) {
    const { preferences } = usePreferences()
    const accent = preferences.accentColor || DEFAULT_ACCENT
    const variants = {
        danger: { background: '#dc2626', color: 'white' },
        ghost: { background: 'transparent', color: 'var(--text-secondary)' },
        outline: { background: 'var(--bg-primary)', border: `1.5px solid ${accent}`, color: accent },
        primary: { background: accent, color: 'white' },
        secondary: { background: 'var(--bg-secondary)', color: 'var(--text-secondary)' },
        warning: { background: '#f59e0b', color: 'white' }
    }
    const v = variants[variant] || variants.primary
    return (
        <button
            {...props}
            className={`dv-btn inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold transition-[opacity,transform] duration-150 ${block ? 'w-full' : 'w-auto'} ${props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'}`}
            style={{
                border: v.border || 'none',
                ...v,
                ...props.style
            }}
        >
            {children}
        </button>
    )
}

export function Divider() {
    return <div className="my-1 h-px bg-slate-200"></div>
}

export function Banner({ type = 'info', icon, children }) {
    const types = {
        error: { bg: '#fef2f2', border: '#fecaca', icon: 'fa-times-circle' },
        info: { bg: '#eff6ff', border: '#bfdbfe', icon: 'fa-info-circle' },
        success: { bg: '#f0fdf4', border: '#bbf7d0', icon: 'fa-check-circle' },
        warning: { bg: '#fffbeb', border: '#fde68a', icon: 'fa-exclamation-triangle' }
    }
    const t = types[type] || types.info
    return (
        <div
            className="flex items-center gap-2.5 rounded-[10px] px-3.5 py-3 text-[13px]"
            style={{
                background: t.bg,
                border: `1px solid ${t.border}`,
                color: 'var(--text-primary)'
            }}
        >
            <i className={`fas ${icon || t.icon}`}></i>
            <span className="flex-1">{children}</span>
        </div>
    )
}

export function Toggle({ label, checked, onChange, disabled }) {
    const { preferences } = usePreferences()
    const accent = preferences.accentColor || DEFAULT_ACCENT
    return (
        <label className={`flex items-center gap-3 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
            <div
                className="relative h-7 w-[52px] rounded-[14px] p-[3px] transition-colors duration-200"
                style={{ background: checked ? accent : 'var(--border-medium)' }}
            >
                <div
                    className="h-[22px] w-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-200"
                    style={{ transform: checked ? 'translateX(24px)' : 'translateX(0)' }}
                ></div>
            </div>
            <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="hidden" />
            {label && <span className="text-sm font-medium text-slate-800">{label}</span>}
        </label>
    )
}

export function Rating({ value = 0, onChange, max = 5, disabled }) {
    return (
        <StarRating
            value={value}
            onChange={disabled ? undefined : onChange}
            max={max}
            size="lg"
            tone="warning"
            showValue={value > 0}
            valueFormat="fraction"
        />
    )
}
