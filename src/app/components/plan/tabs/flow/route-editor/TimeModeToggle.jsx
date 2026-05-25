/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { SectionLabel } from './FormPrimitives'
import { TIME_MODE_CUSTOM, TIME_MODE_STAGGER } from './timeModes'

export function TimeModeToggle({ accentColor, isCustom, onModeChange }) {
    return (
        <div>
            <SectionLabel className="mb-1.5">Operator times</SectionLabel>
            <div className="grid grid-cols-2 rounded-lg overflow-hidden border border-border-medium bg-bg-primary">
                {[TIME_MODE_STAGGER, TIME_MODE_CUSTOM].map((modeOption) => {
                    const active = (modeOption === TIME_MODE_CUSTOM) === isCustom
                    return (
                        <button
                            key={modeOption}
                            type="button"
                            onClick={() => onModeChange(modeOption)}
                            aria-pressed={active}
                            className="border-none cursor-pointer text-[12px] font-semibold py-2"
                            style={{
                                background: active ? accentColor : 'transparent',
                                color: active ? '#fff' : 'var(--text-secondary)'
                            }}
                        >
                            {modeOption === TIME_MODE_STAGGER ? 'Staggered' : 'Per operator'}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
