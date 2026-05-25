/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { MilitaryTimeInput } from '../../../../common/MilitaryTimeInput'
import { LabeledField } from './FormPrimitives'

export function StaggerFields({ accentColor, draft, setDraft }) {
    return (
        <>
            <div className="grid grid-cols-2 gap-2">
                <LabeledField label="Arrival time">
                    <MilitaryTimeInput
                        extraClass="w-full"
                        onChange={(next) => setDraft({ ...draft, time: next })}
                        value={draft.time || ''}
                    />
                </LabeledField>
                <LabeledField
                    label={
                        <>
                            Leave time <span className="text-text-tertiary normal-case font-normal">· return</span>
                        </>
                    }
                >
                    <MilitaryTimeInput
                        extraClass="w-full"
                        onChange={(next) => setDraft({ ...draft, leaveTime: next })}
                        value={draft.leaveTime || ''}
                    />
                </LabeledField>
            </div>
            <LabeledField
                label={
                    <>
                        Stagger{' '}
                        <span className="text-text-tertiary normal-case font-normal">
                            · {draft.staggerMinutes || 0} min between operators
                        </span>
                    </>
                }
            >
                <input
                    type="range"
                    min={0}
                    max={15}
                    step={1}
                    value={draft.staggerMinutes || 0}
                    onChange={(event) => setDraft({ ...draft, staggerMinutes: parseInt(event.target.value, 10) })}
                    className="w-full"
                    style={{ accentColor }}
                />
                <div className="flex justify-between text-[10.5px] text-text-tertiary">
                    <span>0m</span>
                    <span>15m</span>
                </div>
            </LabeledField>
        </>
    )
}
