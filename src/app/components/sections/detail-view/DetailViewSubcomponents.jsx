/* eslint-disable react/forbid-dom-props */
import React, { useContext, useEffect } from 'react'

import { DEFAULT_ACCENT_COLOR } from '../../../constants/themeConstants'
import { usePreferences } from '../../../context/PreferencesContext'
import StarRating from '../../common/StarRating'
import { DetailViewContext } from './DetailViewContext'

/**
 * The atoms every detail view is built from. Sizes and spacing here are held
 * to the same scale the list views use, so the two read as one product.
 *
 * The `dv-input` and `dv-btn` class hooks are load-bearing: the focus ring and
 * the press feedback live on those selectors in `src/app/index.css`, not in
 * the utility classes below.
 */

const DEFAULT_ACCENT = DEFAULT_ACCENT_COLOR

const LABEL_CLASS = 'flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-text-secondary'
const VALUE_BOX_CLASS = 'rounded-md border border-border-light bg-bg-secondary px-2.5 py-1.5 text-[12.5px] font-medium'
const INPUT_CLASS =
    'dv-input w-full rounded-md border border-border-light bg-bg-primary px-2.5 py-1.5 text-[12.5px] text-text-primary outline-none transition-[border-color,box-shadow] duration-150'

export function Section({ id, title, icon, children }) {
    const { activeSection, registerSection } = useContext(DetailViewContext)
    useEffect(() => {
        registerSection({ icon, id, title })
    }, [id, title, icon, registerSection])
    if (activeSection !== id) return null

    const childArray = React.Children.toArray(children)
    const count = childArray.length
    const gridClass = count === 1 ? 'flex flex-col gap-3' : 'grid grid-cols-2 gap-3'

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
        <div className="flex flex-col gap-3">
            <div className="dv-section-header flex items-center gap-2">
                {icon && <i className={`${icon} text-text-secondary text-[13px]`}></i>}
                <h2 className="m-0 text-[14px] font-bold text-text-primary">{title}</h2>
            </div>
            <div className={`dv-section-grid ${gridClass}`}>{renderChildren()}</div>
        </div>
    )
}

export function Card({ title, icon, children, actions, fullWidth }) {
    return (
        <div
            className={`overflow-hidden rounded-md border border-border-light bg-bg-primary ${fullWidth ? 'col-[1_/_-1]' : ''}`}
        >
            {title && (
                <div className="flex items-center justify-between gap-2 border-b border-border-light bg-bg-secondary px-3 py-2">
                    <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-text-primary">
                        {icon && <i className={`${icon} text-text-secondary text-[12px]`}></i>}
                        {title}
                    </div>
                    {actions && <div className="flex items-center gap-1.5">{actions}</div>}
                </div>
            )}
            <div className="flex flex-col gap-2.5 p-3">{children}</div>
        </div>
    )
}

export function Row({ children, cols = 2 }) {
    return (
        <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {children}
        </div>
    )
}

export function Field({ label, value, empty = '-', icon }) {
    const hasValue = value !== undefined && value !== null && value !== ''
    return (
        <div className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>
                {icon && <i className={`${icon} text-text-secondary text-[10px]`}></i>}
                {label}
            </span>
            <span className={`${VALUE_BOX_CLASS} ${hasValue ? 'text-text-primary' : 'text-text-tertiary'}`}>
                {hasValue ? value : empty}
            </span>
        </div>
    )
}

export function Input({ label, icon, ...props }) {
    return (
        <div className="flex flex-col gap-1">
            {label && (
                <label className={LABEL_CLASS}>
                    {icon && <i className={`${icon} text-text-secondary text-[10px]`}></i>}
                    {label}
                </label>
            )}
            <input {...props} className={INPUT_CLASS} style={props.style} />
        </div>
    )
}

export function Select({ label, icon, options = [], placeholder, ...props }) {
    // --select-chevron-sm carries the caret SVG, stroke included, so the
    // dark and gray themes swap it the same way they swap a colour token.
    const selectBg = 'var(--bg-primary) var(--select-chevron-sm) right 10px center/14px no-repeat'
    return (
        <div className="flex flex-col gap-1">
            {label && (
                <label className={LABEL_CLASS}>
                    {icon && <i className={`${icon} text-text-secondary text-[10px]`}></i>}
                    {label}
                </label>
            )}
            <select
                {...props}
                className="dv-input w-full cursor-pointer appearance-none rounded-md border border-border-light text-[12.5px] text-text-primary outline-none transition-[border-color,box-shadow] duration-150"
                style={{
                    background: selectBg,
                    padding: '8px 32px 8px 12px',
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
    return (
        <div className="flex flex-col gap-1">
            {label && (
                <label className={LABEL_CLASS}>
                    {icon && <i className={`${icon} text-text-secondary text-[10px]`}></i>}
                    {label}
                </label>
            )}
            <textarea
                {...props}
                className="dv-input w-full min-h-[96px] resize-y rounded-md border border-border-light bg-bg-primary px-2.5 py-1.5 text-[12.5px] leading-[1.5] text-text-primary outline-none transition-[border-color,box-shadow] duration-150"
                style={props.style}
            />
        </div>
    )
}

export function Button({ variant = 'primary', block, children, ...props }) {
    const { preferences } = usePreferences()
    const accent = preferences.accentColor || DEFAULT_ACCENT
    const variants = {
        danger: { background: 'var(--status-danger)', color: 'var(--on-accent)' },
        ghost: { background: 'transparent', color: 'var(--text-secondary)' },
        outline: { background: 'var(--bg-primary)', border: `1px solid ${accent}`, color: accent },
        primary: { background: accent, color: 'var(--on-accent)' },
        secondary: { background: 'var(--bg-secondary)', color: 'var(--text-primary)' },
        warning: { background: 'var(--status-warning)', color: 'var(--on-accent)' }
    }
    const v = variants[variant] || variants.primary
    return (
        <button
            type="button"
            {...props}
            className={`dv-btn inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-[opacity,transform] duration-150 ${block ? 'w-full' : 'w-auto'} ${props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'}`}
            style={{
                border: v.border || '1px solid transparent',
                ...v,
                ...props.style
            }}
        >
            {children}
        </button>
    )
}

export function Divider() {
    return <div className="my-1 h-px bg-border-light"></div>
}

export function Banner({ type = 'info', icon, children }) {
    // Each tone is a wash-plus-line pair of theme tokens rather than a fixed
    // colour, so the tint stays readable behind text-text-primary on light,
    // dark and gray alike.
    const types = {
        error: { bg: 'var(--tint-danger-wash)', border: 'var(--tint-danger-line)', icon: 'fa-times-circle' },
        info: { bg: 'var(--tint-info-wash)', border: 'var(--tint-info-line)', icon: 'fa-info-circle' },
        success: { bg: 'var(--tint-success-wash)', border: 'var(--tint-success-line)', icon: 'fa-check-circle' },
        warning: { bg: 'var(--notice-warning-bg)', border: 'var(--tint-warning-line)', icon: 'fa-exclamation-triangle' }
    }
    const t = types[type] || types.info
    return (
        <div
            className="flex items-center gap-2 rounded-md px-3 py-2 text-[12px] text-text-primary"
            style={{
                background: t.bg,
                border: `1px solid ${t.border}`
            }}
        >
            <i className={`fas ${icon || t.icon} text-[12px]`}></i>
            <span className="flex-1">{children}</span>
        </div>
    )
}

export function Toggle({ label, checked, onChange, disabled }) {
    const { preferences } = usePreferences()
    const accent = preferences.accentColor || DEFAULT_ACCENT
    return (
        <label className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
            <div
                className="relative h-5 w-9 rounded-full p-1 transition-colors duration-200"
                style={{ background: checked ? accent : 'var(--border-medium)' }}
            >
                <div
                    className="h-4 w-4 rounded-full bg-bg-primary shadow-card transition-transform duration-200"
                    style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
                ></div>
            </div>
            <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="hidden" />
            {label && <span className="text-[12.5px] font-medium text-text-primary">{label}</span>}
        </label>
    )
}

export function Rating({ value = 0, onChange, max = 5, disabled }) {
    // A step larger than the `xs` the list rows use: here the stars are a
    // control rather than a readout, so they need a target worth pressing.
    return (
        <StarRating
            value={value}
            onChange={disabled ? undefined : onChange}
            max={max}
            size="sm"
            tone="warning"
            showValue={value > 0}
            valueFormat="fraction"
        />
    )
}
