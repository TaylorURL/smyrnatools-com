/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { FIELD_STYLE, RATING_LABELS } from '../../constants/verificationModalConstants'
import LoadingScreen from '../common/LoadingScreen'
import { OperatorRow, Pill, RequiredHint, Section } from './VerificationAtoms'

function operatorStatusPill({ operatorOk, phoneOk, ratingOk }) {
    if (operatorOk) {
        return (
            <Pill bg="#dcfce7" fg="#166534">
                Complete
            </Pill>
        )
    }
    if (!phoneOk && !ratingOk) {
        return (
            <Pill bg="#fee2e2" fg="#b91c1c">
                Phone & Rating
            </Pill>
        )
    }
    if (!phoneOk) {
        return (
            <Pill bg="#fee2e2" fg="#b91c1c">
                Phone Required
            </Pill>
        )
    }
    return (
        <Pill bg="#fee2e2" fg="#b91c1c">
            Rating Required
        </Pill>
    )
}

function RatingStars({ onSelect, rating }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => onSelect(star)}
                    className="border-none bg-transparent p-0 cursor-pointer"
                    aria-label={`Rate ${star} of 5`}
                >
                    <i
                        className="fas fa-star text-[14px]"
                        style={{ color: star <= rating ? '#f59e0b' : 'var(--bg-tertiary)' }}
                    />
                </button>
            ))}
        </div>
    )
}

function RatingControl({ onSelect, ratingOk, value }) {
    return (
        <div>
            <div className="flex items-center gap-2.5">
                <RatingStars rating={value} onSelect={onSelect} />
                <span className="text-[11px] text-text-secondary">
                    {value > 0 ? `${value}/5 · ${RATING_LABELS[value]}` : 'Not yet rated'}
                </span>
            </div>
            {!ratingOk && <RequiredHint>Rating required for verification</RequiredHint>}
        </div>
    )
}

function PhoneControl({ accentColor, isSavingPhone, onChange, onSave, phoneOk, value }) {
    return (
        <div>
            <div className="flex gap-1.5">
                <input
                    type="tel"
                    placeholder="(555) 555-5555"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="flex-1 rounded px-2.5 py-1.5 text-[12.5px] outline-none font-mono tabular-nums"
                    style={{
                        ...FIELD_STYLE,
                        borderColor: !phoneOk ? '#dc2626' : 'var(--border-light)'
                    }}
                />
                <button
                    onClick={onSave}
                    disabled={isSavingPhone || !value.trim()}
                    className="flex h-7 w-7 items-center justify-center rounded text-white border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: accentColor }}
                    aria-label="Save phone"
                >
                    <i className={`fas ${isSavingPhone ? 'fa-spinner fa-spin' : 'fa-save'} text-[11px]`} />
                </button>
            </div>
            {!phoneOk && <RequiredHint>Phone required for verification</RequiredHint>}
        </div>
    )
}

/** "Operator Information" section — name/position/id rows plus editable rating + phone. */
export default function VerificationOperatorSection({
    accentColor,
    expanded,
    isLoadingOperator,
    isSavingPhone,
    onSavePhone,
    onSaveRating,
    onToggle,
    operatorData,
    operatorOk,
    operatorPhone,
    operatorRating,
    phoneOk,
    ratingOk,
    setOperatorPhone
}) {
    return (
        <Section
            icon="fa-user"
            title="Operator Information"
            accentColor={accentColor}
            expanded={expanded}
            onToggle={onToggle}
            pill={operatorStatusPill({ operatorOk, phoneOk, ratingOk })}
        >
            {isLoadingOperator ? (
                <LoadingScreen message="Loading operator data..." inline={true} />
            ) : operatorData ? (
                <div>
                    <OperatorRow label="Name" value={operatorData.name || 'N/A'} />
                    {operatorData.position && <OperatorRow label="Position" value={operatorData.position} />}
                    {operatorData.smyrna_id && <OperatorRow label="Employee ID" value={operatorData.smyrna_id} mono />}
                    <OperatorRow
                        label="Performance Rating"
                        required={!ratingOk}
                        value={<RatingControl onSelect={onSaveRating} ratingOk={ratingOk} value={operatorRating} />}
                    />
                    <OperatorRow
                        label="Phone Number"
                        required={!phoneOk}
                        last
                        value={
                            <PhoneControl
                                accentColor={accentColor}
                                isSavingPhone={isSavingPhone}
                                onChange={setOperatorPhone}
                                onSave={onSavePhone}
                                phoneOk={phoneOk}
                                value={operatorPhone}
                            />
                        }
                    />
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-6 px-3 text-center text-text-tertiary">
                    <i className="fas fa-exclamation-triangle text-2xl mb-2" />
                    <div className="text-[12px] font-semibold text-text-primary">
                        Unable to load operator information
                    </div>
                    <div className="text-[11px] mt-0.5">
                        The operator may have been removed or there was a connection issue
                    </div>
                </div>
            )}
        </Section>
    )
}
