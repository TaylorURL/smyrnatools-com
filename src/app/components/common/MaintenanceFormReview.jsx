import React from 'react'

import { formatMaintenanceDateShort } from '../../../utils/MaintenanceUtility'
import { useAccentColor } from '../../hooks/useAccentColor'
import { getImageDisplayUrl } from '../../hooks/useMaintenanceImages'
import ImagePreviewModal from '../ui/ImagePreviewModal'

const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

/**
 * Full-page review interface for submitted maintenance forms.
 * Displays all responses (text fields, checklists with images),
 * with approve / reject controls + reviewer notes.
 */
export default function MaintenanceFormReview({
    checklistComments,
    checklistStates,
    errors,
    fieldImages,
    fields,
    formObj,
    imagePreview,
    item,
    onBack,
    onClosePreview,
    onOpenPreview,
    onReview,
    responses,
    reviewNotes,
    setReviewNotes,
    submitterName,
    submitting
}) {
    const accentColor = useAccentColor()
    return (
        <div className="flex min-h-screen w-full flex-col" style={{ background: 'var(--bg-secondary)' }}>
            <div
                className="sticky top-0 z-40 flex items-center gap-2.5 px-3 sm:px-4 py-2"
                style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-light)' }}
            >
                <button
                    type="button"
                    onClick={onBack}
                    className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-bg-tertiary border-none cursor-pointer"
                    style={{ background: 'var(--bg-tertiary)', color: accentColor }}
                    aria-label="Back"
                >
                    <i className="fas fa-arrow-left text-[11px]" />
                </button>
                <div
                    className="flex h-6 w-6 items-center justify-center rounded shrink-0"
                    style={{ background: 'var(--bg-tertiary)', color: accentColor }}
                >
                    <i className="fas fa-clipboard-check text-[11px]" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                        Form Review
                    </div>
                    <div className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {formObj?.title}
                    </div>
                    <div className="text-[10.5px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                        Submitted by {submitterName || 'Unknown'} · {formatMaintenanceDateShort(item?.submitted_at)}
                    </div>
                </div>
            </div>

            <div className="mx-auto w-full max-w-3xl px-3 sm:px-4 py-3 flex flex-col gap-2.5">
                {fields.length === 0 ? (
                    <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                        No form fields found.
                    </p>
                ) : (
                    fields.map((field, idx) => {
                        const imageData = fieldImages[field.id]
                        const imageUrl = imageData?.uploadedUrl
                        return (
                            <div
                                key={field.id}
                                className="flex gap-2.5 rounded p-3"
                                style={{
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-light)'
                                }}
                            >
                                <div
                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold font-mono tabular-nums"
                                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                                >
                                    {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4
                                        className="mb-1.5 text-[12.5px] font-semibold m-0"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {field.label}
                                    </h4>
                                    {field.field_type === 'checklist' ? (
                                        <div className="flex flex-col gap-1.5">
                                            {(field.options?.items || []).map((checkItem, cidx) => {
                                                const isChecked = checklistStates[field.id]?.[checkItem]
                                                const comment = checklistComments[field.id]?.[checkItem]
                                                const itemImageKey = `${field.id}_${checkItem.trim()}`
                                                const itemImageUrl = fieldImages[itemImageKey]?.uploadedUrl
                                                const tone = isChecked
                                                    ? '#16a34a'
                                                    : comment
                                                      ? '#92400e'
                                                      : 'var(--text-tertiary)'
                                                return (
                                                    <div key={cidx} className="flex flex-col gap-0.5">
                                                        <span
                                                            className="flex items-center gap-1.5 text-[12px]"
                                                            style={{ color: tone }}
                                                        >
                                                            <i
                                                                className={`fas ${isChecked ? 'fa-check-square' : 'fa-square'} text-[10px]`}
                                                            />
                                                            {checkItem}
                                                        </span>
                                                        {comment && !isChecked && (
                                                            <span
                                                                className="ml-5 text-[10.5px] italic"
                                                                style={{ color: 'var(--text-secondary)' }}
                                                            >
                                                                {comment}
                                                            </span>
                                                        )}
                                                        {itemImageUrl && (
                                                            <img
                                                                src={itemImageUrl}
                                                                alt="Attached"
                                                                className="ml-5 mt-1 max-w-[180px] cursor-pointer rounded"
                                                                style={{ border: '1px solid var(--border-light)' }}
                                                                onClick={() => onOpenPreview(itemImageUrl)}
                                                            />
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-[12px] m-0" style={{ color: 'var(--text-secondary)' }}>
                                            {responses[field.id] || (
                                                <span className="italic" style={{ color: 'var(--text-tertiary)' }}>
                                                    No response
                                                </span>
                                            )}
                                        </p>
                                    )}
                                    {imageUrl && field.field_type !== 'checklist' && (
                                        <img
                                            src={getImageDisplayUrl(imageUrl)}
                                            alt="Attached"
                                            className="mt-1.5 max-w-[180px] cursor-pointer rounded"
                                            style={{ border: '1px solid var(--border-light)' }}
                                            onClick={() => onOpenPreview(getImageDisplayUrl(imageUrl))}
                                        />
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}

                {/* Review decision */}
                <div
                    className="rounded p-3 mt-2"
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                >
                    <div className={`${SECTION_LABEL_CLASS} mb-2`} style={{ color: 'var(--text-secondary)' }}>
                        Review Decision
                    </div>
                    <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Add notes (optional)…"
                        rows={3}
                        className="w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none resize-y min-h-[80px]"
                        style={FIELD_STYLE}
                    />
                    {errors?.submit && (
                        <div
                            className="mt-2 flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-medium"
                            style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c' }}
                        >
                            <i className="fas fa-exclamation-circle text-[11px]" />
                            {errors.submit}
                        </div>
                    )}
                    <div className="mt-2 flex gap-1.5">
                        <button
                            type="button"
                            onClick={() => onReview('approved')}
                            disabled={submitting}
                            className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider text-white px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: '#16a34a' }}
                        >
                            <i className="fas fa-check text-[10px]" />
                            Approve
                        </button>
                        <button
                            type="button"
                            onClick={() => onReview('rejected')}
                            disabled={submitting}
                            className="inline-flex items-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider text-white px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: '#dc2626' }}
                        >
                            <i className="fas fa-times text-[10px]" />
                            Reject
                        </button>
                    </div>
                </div>
            </div>
            <ImagePreviewModal imageUrl={imagePreview} onClose={onClosePreview} />
        </div>
    )
}
