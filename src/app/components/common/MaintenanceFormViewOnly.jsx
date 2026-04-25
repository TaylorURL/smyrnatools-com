import React from 'react'

import { formatMaintenanceDateShort } from '../../../utils/MaintenanceUtility'
import { useAccentColor } from '../../hooks/useAccentColor'
import { getImageDisplayUrl } from '../../hooks/useMaintenanceImages'
import ImagePreviewModal from '../ui/ImagePreviewModal'

const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'

/** Status badge configuration mapping submission status to display props. */
const STATUS_CONFIG = {
    approved: { bg: '#dcfce7', fg: '#166534', icon: 'fa-check-circle', label: 'Approved' },
    rejected: { bg: '#fee2e2', fg: '#b91c1c', icon: 'fa-times-circle', label: 'Rejected' },
    submitted: { bg: '#dbeafe', fg: '#1e40af', icon: 'fa-clock', label: 'Pending Review' }
}

/**
 * Read-only view of a submitted maintenance form. Status pill, optional
 * reviewer notes, then all field responses (text + checklist with images).
 */
export default function MaintenanceFormViewOnly({
    checklistStates,
    fieldImages,
    fields,
    formObj,
    imagePreview,
    item,
    onBack,
    onClosePreview,
    onOpenPreview,
    responses,
    reviewNotes
}) {
    const accentColor = useAccentColor()
    const statusInfo = STATUS_CONFIG[item?.status]
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
                    <i className="fas fa-clipboard-list text-[11px]" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                        Submission
                    </div>
                    <div className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {formObj?.title}
                    </div>
                    <div className="text-[10.5px] font-mono tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                        Due {formatMaintenanceDateShort(item?.due_date)}
                    </div>
                </div>
            </div>
            <div className="mx-auto w-full max-w-3xl px-3 sm:px-4 py-3 flex flex-col gap-2.5">
                {statusInfo && (
                    <div
                        className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wider"
                        style={{ background: statusInfo.bg, color: statusInfo.fg }}
                    >
                        <i className={`fas ${statusInfo.icon} text-[10px]`} />
                        {statusInfo.label}
                    </div>
                )}
                {reviewNotes && (
                    <div
                        className="rounded p-3"
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                    >
                        <div className={`${SECTION_LABEL_CLASS} mb-1`} style={{ color: 'var(--text-secondary)' }}>
                            Reviewer Notes
                        </div>
                        <p className="m-0 text-[12px]" style={{ color: 'var(--text-primary)' }}>
                            {reviewNotes}
                        </p>
                    </div>
                )}
                {fields.map((field) => {
                    const imageData = fieldImages[field.id]
                    const imageUrl = imageData?.uploadedUrl
                    return (
                        <div
                            key={field.id}
                            className="rounded p-3"
                            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                        >
                            <div className={`${SECTION_LABEL_CLASS} mb-1`} style={{ color: 'var(--text-secondary)' }}>
                                {field.label}
                            </div>
                            {field.field_type === 'checklist' ? (
                                <div className="flex flex-col gap-1">
                                    {(field.options?.items || []).map((checkItem, cidx) => {
                                        const isChecked = checklistStates[field.id]?.[checkItem]
                                        const itemImageKey = `${field.id}_${checkItem.trim()}`
                                        const itemImageUrl = fieldImages[itemImageKey]?.uploadedUrl
                                        return (
                                            <div key={cidx} className="flex flex-col">
                                                <span
                                                    className="flex items-center gap-1.5 text-[12px]"
                                                    style={{ color: isChecked ? '#16a34a' : '#dc2626' }}
                                                >
                                                    <i
                                                        className={`fas ${isChecked ? 'fa-check' : 'fa-times'} text-[10px]`}
                                                    />
                                                    {checkItem}
                                                </span>
                                                {itemImageUrl && (
                                                    <img
                                                        src={getImageDisplayUrl(itemImageUrl)}
                                                        alt="Attached"
                                                        className="ml-5 mt-1 max-w-[180px] cursor-pointer rounded"
                                                        style={{ border: '1px solid var(--border-light)' }}
                                                        onClick={() => onOpenPreview(getImageDisplayUrl(itemImageUrl))}
                                                    />
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <span className="text-[12px]" style={{ color: 'var(--text-primary)' }}>
                                    {responses[field.id] || '—'}
                                </span>
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
                    )
                })}
            </div>
            <ImagePreviewModal imageUrl={imagePreview} onClose={onClosePreview} />
        </div>
    )
}
