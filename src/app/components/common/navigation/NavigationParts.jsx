/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { ICONS } from '../../../constants/navigationConstants'

const REGION_SELECT_ARROW =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")"

/** Labeled section divider used in the mobile navigation drawer. */
export function MobileSection({ title, children }) {
    return (
        <div style={{ marginBottom: '16px' }}>
            <div
                className="text-text-secondary text-[11px] font-semibold uppercase"
                style={{ letterSpacing: '0.5px', marginBottom: '4px', padding: '8px 12px' }}
            >
                {title}
            </div>
            {children}
        </div>
    )
}

/** Single tappable row in the mobile navigation drawer. */
export function MobileMenuItem({ item, isActive, onClick, accentColor = '#1e3a5f' }) {
    return (
        <button
            type="button"
            className="items-center rounded-[10px] cursor-pointer flex w-full text-left border-none active:scale-[0.99] active:opacity-80 transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none"
            onClick={onClick}
            style={{
                backgroundColor: isActive ? `${accentColor}12` : 'transparent',
                color: 'var(--text-primary)',
                fontWeight: isActive ? 600 : 400,
                gap: '12px',
                marginBottom: '4px',
                padding: '12px'
            }}
        >
            <i
                className={`fas ${ICONS[item.id] || 'fa-circle'} text-base w-5`}
                style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            ></i>
            <span className="text-[15px]">{item.text}</span>
        </button>
    )
}

/** Region <select> for the mobile drawer. */
export function MobileRegionSelect({ regionCode, permittedRegions, onChange, accentColor }) {
    return (
        <div style={{ marginBottom: '20px' }}>
            <label
                htmlFor="mobile-region-select"
                className="text-text-secondary block text-[11px] font-semibold tracking-wider uppercase"
                style={{ marginBottom: '6px' }}
            >
                Region
            </label>
            <select
                id="mobile-region-select"
                aria-label="Region"
                className="bg-bg-secondary rounded-[10px] text-text-primary cursor-pointer text-sm font-semibold w-full"
                value={regionCode || ''}
                onChange={onChange}
                onFocus={(e) => {
                    e.currentTarget.style.borderColor = accentColor
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${accentColor}20`
                    e.currentTarget.style.outline = 'none'
                }}
                onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-light)'
                    e.currentTarget.style.boxShadow = 'none'
                }}
                style={{
                    border: '2px solid var(--border-light)',
                    padding: '12px',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                }}
            >
                {permittedRegions.length === 0 ? (
                    <option value="">Loading...</option>
                ) : (
                    permittedRegions.map((r) => (
                        <option key={r.regionCode || r.region_code} value={r.regionCode || r.region_code}>
                            {r.regionName || r.region_name}
                        </option>
                    ))
                )}
            </select>
        </div>
    )
}

/** Compact region <select> for the two-level top bar. */
export function TwoLevelRegionSelect({ regionCode, permittedRegions, onChange }) {
    return (
        <select
            value={regionCode || ''}
            onChange={onChange}
            aria-label="Region"
            className="cursor-pointer transition-all duration-200 outline-none bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] rounded-[10px] font-semibold hover:bg-[rgba(255,255,255,0.14)] focus-visible:ring-2 focus-visible:ring-white/40"
            style={{
                appearance: 'none',
                backgroundImage: REGION_SELECT_ARROW,
                backgroundPosition: 'right 8px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 14,
                color: 'white',
                fontSize: 13,
                padding: '8px 30px 8px 12px'
            }}
        >
            {permittedRegions.length === 0 ? (
                <option value="">Loading...</option>
            ) : (
                permittedRegions.map((r) => (
                    <option
                        className="bg-[#1e293b] text-slate-50"
                        key={r.regionCode || r.region_code}
                        value={r.regionCode || r.region_code}
                    >
                        {r.regionName || r.region_name}
                    </option>
                ))
            )}
        </select>
    )
}

/** Region <select> for the top-bar basic header (responsive to tablet sizing). */
export function TopBarRegionSelect({ regionCode, permittedRegions, onChange, isTablet }) {
    return (
        <select
            className="bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] cursor-pointer font-semibold overflow-hidden whitespace-nowrap"
            aria-label="Region"
            value={regionCode || ''}
            onChange={onChange}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.16)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
            }}
            onFocus={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.16)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
                e.currentTarget.style.outline = 'none'
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.15)'
            }}
            onBlur={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                e.currentTarget.style.boxShadow = 'none'
            }}
            style={{
                appearance: 'none',
                backgroundImage: REGION_SELECT_ARROW,
                backgroundPosition: 'right 8px center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: isTablet ? '12px' : '16px',
                borderRadius: isTablet ? '8px' : '12px',
                color: 'white',
                fontSize: isTablet ? '12px' : '14px',
                letterSpacing: '0.01em',
                maxWidth: isTablet ? '120px' : 'none',
                padding: isTablet ? '6px 24px 6px 10px' : '10px 36px 10px 16px',
                textOverflow: 'ellipsis',
                transition: 'all 0.2s ease'
            }}
        >
            {permittedRegions.length === 0 ? (
                <option className="bg-[#1e293b] text-slate-50" value="">
                    Loading...
                </option>
            ) : (
                permittedRegions.map((r) => (
                    <option
                        className="bg-[#1e293b] text-slate-50"
                        key={r.regionCode || r.region_code}
                        value={r.regionCode || r.region_code}
                    >
                        {r.regionName || r.region_name}
                    </option>
                ))
            )}
        </select>
    )
}
