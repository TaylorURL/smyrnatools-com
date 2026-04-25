import React from 'react'

import LoadingScreen from '../../../app/components/common/LoadingScreen'
import MaintenanceFormReview from '../../../app/components/common/MaintenanceFormReview'
import MaintenanceFormViewOnly from '../../../app/components/common/MaintenanceFormViewOnly'
import ImageAttachment from '../../../app/components/ui/ImageAttachment'
import ImagePreviewModal from '../../../app/components/ui/ImagePreviewModal'
import { useAccentColor } from '../../../app/hooks/useAccentColor'
import { useMaintenanceForm } from '../../../app/hooks/useMaintenanceForm'
import { formatMaintenanceDateShort, getFieldTypeIcon } from '../../../utils/MaintenanceUtility'

const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
const FIELD_STYLE = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)'
}

const inputClassBase = 'w-full rounded px-2.5 py-1.5 text-[12.5px] outline-none transition-colors'

function fieldStyleFor(hasError) {
    return {
        ...FIELD_STYLE,
        borderColor: hasError ? '#dc2626' : 'var(--border-light)'
    }
}

/** Reusable single-line text input for short-answer and fallback field types. */
function FormInput({ field, value, disabled, hasError, onChange, placeholder = 'Type your answer…' }) {
    return (
        <input
            type="text"
            className={inputClassBase}
            style={fieldStyleFor(hasError)}
            value={value}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus
        />
    )
}

function FormTextarea({ field, value, disabled, hasError, onChange, placeholder = 'Type your answer…', rows = 5 }) {
    return (
        <textarea
            className={`${inputClassBase} min-h-[120px] resize-y`}
            style={fieldStyleFor(hasError)}
            value={value}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            autoFocus
        />
    )
}

/** Renders a checklist with per-item check state, optional image attachments. */
function ChecklistField({
    field,
    checklistStates,
    checklistComments,
    fieldImages,
    uploadingImage,
    errors,
    disabled,
    accentColor,
    onCheckChange,
    onCommentChange,
    imageActions
}) {
    const checkItems = field.options?.items || []
    const comments = checklistComments[field.id] || {}
    return (
        <div className="flex flex-col gap-2.5">
            {checkItems.map((checkItem, idx) => {
                const isChecked = checklistStates[field.id]?.[checkItem] || false
                const imageKey = `${field.id}_${checkItem.trim()}`
                const imageData = fieldImages[imageKey]
                const isUploadingThis = uploadingImage === imageKey
                const imageError = errors[`${field.id}_${checkItem.trim()}_image`]
                const showImageSection =
                    (isChecked && field.image_required) || imageData?.previewUrl || imageData?.uploadedUrl
                return (
                    <div key={idx} className="flex flex-col gap-1.5">
                        <label
                            className={`flex items-start gap-2.5 rounded px-3 py-2 transition-colors ${
                                disabled ? 'cursor-default' : 'cursor-pointer hover:brightness-95'
                            }`}
                            style={{
                                background: isChecked ? `${accentColor}14` : 'var(--bg-secondary)',
                                border: `1px solid ${isChecked ? accentColor : 'var(--border-light)'}`
                            }}
                        >
                            <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
                                checked={isChecked}
                                onChange={(e) => onCheckChange(field.id, checkItem, e.target.checked)}
                                disabled={disabled}
                            />
                            <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {checkItem}
                            </span>
                        </label>
                        {!isChecked && field.is_required && (
                            <input
                                type="text"
                                className={inputClassBase}
                                style={FIELD_STYLE}
                                value={comments[checkItem] || ''}
                                onChange={(e) => onCommentChange(field.id, checkItem, e.target.value)}
                                placeholder="Why is this incomplete?"
                                disabled={disabled}
                            />
                        )}
                        {showImageSection && (
                            <ImageAttachment
                                fieldId={field.id}
                                checklistItem={checkItem}
                                imageData={imageData}
                                isUploading={isUploadingThis}
                                disabled={disabled}
                                error={imageError}
                                onCamera={imageActions.triggerCameraCapture}
                                onUpload={imageActions.triggerImageUpload}
                                onRemove={imageActions.handleRemoveImage}
                                onPreview={imageActions.openImagePreview}
                            />
                        )}
                    </div>
                )
            })}
        </div>
    )
}

/** Dispatches to the correct input component based on the field's type. */
function FieldRenderer({ field, form, imageHook, errors, disabled, accentColor }) {
    const {
        responses,
        handleResponseChange,
        checklistStates,
        checklistComments,
        handleChecklistChange,
        handleChecklistComment
    } = form
    const hasError = !!errors[field.id]
    const value = responses[field.id] || ''
    switch (field.field_type) {
        case 'short_answer':
            return (
                <FormInput
                    field={field}
                    value={value}
                    disabled={disabled}
                    hasError={hasError}
                    onChange={handleResponseChange}
                />
            )
        case 'long_answer':
            return (
                <FormTextarea
                    field={field}
                    value={value}
                    disabled={disabled}
                    hasError={hasError}
                    onChange={handleResponseChange}
                />
            )
        case 'checklist':
            return (
                <ChecklistField
                    field={field}
                    checklistStates={checklistStates}
                    checklistComments={checklistComments}
                    fieldImages={imageHook.fieldImages}
                    uploadingImage={imageHook.uploadingImage}
                    errors={errors}
                    disabled={disabled}
                    accentColor={accentColor}
                    onCheckChange={handleChecklistChange}
                    onCommentChange={handleChecklistComment}
                    imageActions={imageHook}
                />
            )
        case 'notes':
            return (
                <FormTextarea
                    field={field}
                    value={value}
                    disabled={disabled}
                    hasError={hasError}
                    onChange={handleResponseChange}
                    placeholder="Add any notes…"
                    rows={4}
                />
            )
        default:
            return (
                <FormInput
                    field={field}
                    value={value}
                    disabled={disabled}
                    hasError={hasError}
                    onChange={handleResponseChange}
                />
            )
    }
}

function FieldImageSection({ field, imageHook, errors, disabled }) {
    if (field.field_type === 'checklist') return null
    return (
        <div className="mt-3">
            <label
                className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)' }}
            >
                <i className="fas fa-camera text-[10px]" /> Photo Attachment
                {field.image_required && <span style={{ color: '#dc2626' }}>*</span>}
            </label>
            <ImageAttachment
                fieldId={field.id}
                imageData={imageHook.fieldImages[field.id]}
                isUploading={imageHook.uploadingImage === field.id}
                disabled={disabled}
                error={errors[`${field.id}_image`]}
                onCamera={imageHook.triggerCameraCapture}
                onUpload={imageHook.triggerImageUpload}
                onRemove={imageHook.handleRemoveImage}
                onPreview={imageHook.openImagePreview}
            />
        </div>
    )
}

/** Sticky wizard header with progress bar, step counter, and prev/next/submit. */
function StepperHeader({
    accentColor,
    formTitle,
    dueDate,
    currentStep,
    totalSteps,
    isFirstStep,
    isLastStep,
    submitting,
    isEditing,
    onBack,
    onPrevious,
    onNext,
    onSubmit
}) {
    const pct = ((currentStep + 1) / totalSteps) * 100
    return (
        <div
            className="sticky top-0 z-50 flex flex-col gap-2 px-3 py-2 sm:px-4"
            style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-light)' }}
        >
            <div className="flex items-center gap-2.5">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-bg-tertiary border-none cursor-pointer shrink-0"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                    aria-label="Close"
                >
                    <i className="fas fa-times text-[11px]" />
                </button>
                <div
                    className="flex h-6 w-6 items-center justify-center rounded shrink-0"
                    style={{ background: 'var(--bg-tertiary)', color: accentColor }}
                >
                    <i className="fas fa-clipboard-list text-[11px]" />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                    <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                        Maintenance Form
                    </span>
                    <span className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {formTitle}
                    </span>
                </div>
                <div className="flex flex-col gap-1 shrink-0 w-20 sm:w-[150px]">
                    <div
                        className="h-1.5 w-full overflow-hidden rounded-full"
                        style={{ background: 'var(--bg-tertiary)' }}
                    >
                        <div
                            className="h-full transition-[width] duration-300"
                            style={{ background: accentColor, width: `${pct}%` }}
                        />
                    </div>
                    <span
                        className="text-center text-[9.5px] font-semibold uppercase tracking-wider font-mono tabular-nums"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        {currentStep + 1} / {totalSteps} · Due {dueDate}
                    </span>
                </div>
            </div>
            <div className="flex gap-1.5">
                <button
                    type="button"
                    onClick={onPrevious}
                    disabled={isFirstStep}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-95"
                    style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-light)',
                        color: 'var(--text-secondary)'
                    }}
                >
                    <i className="fas fa-arrow-left text-[10px]" />
                    Prev
                </button>
                {isLastStep ? (
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={submitting}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider text-white px-2.5 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: '#16a34a' }}
                    >
                        {submitting ? (
                            <i className="fas fa-spinner fa-spin text-[10px]" />
                        ) : (
                            <>
                                <span>{isEditing ? 'Update' : 'Submit'}</span>
                                <i className="fas fa-check text-[10px]" />
                            </>
                        )}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={onNext}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded text-[10.5px] font-semibold uppercase tracking-wider text-white px-2.5 py-1.5"
                        style={{ background: accentColor }}
                    >
                        Next
                        <i className="fas fa-arrow-right text-[10px]" />
                    </button>
                )}
            </div>
        </div>
    )
}

function FieldCard({ accentColor, field }) {
    const fieldTypeName = field.field_type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    return (
        <div className="mb-3 flex items-center gap-2.5">
            <div
                className="flex h-8 w-8 items-center justify-center rounded shrink-0"
                style={{ background: 'var(--bg-tertiary)', color: accentColor }}
            >
                <i className={`fas ${getFieldTypeIcon(field.field_type)} text-[14px]`} />
            </div>
            <div className="flex-1 min-w-0">
                <h2
                    className="flex items-center gap-1.5 text-[15px] font-semibold m-0"
                    style={{ color: 'var(--text-primary)' }}
                >
                    <span className="truncate">{field.label}</span>
                    {field.is_required && <span style={{ color: '#dc2626' }}>*</span>}
                </h2>
                <span
                    className="mt-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                    style={{ background: `${accentColor}14`, color: accentColor }}
                >
                    <i className={`fas ${getFieldTypeIcon(field.field_type)} text-[9px]`} />
                    {fieldTypeName}
                </span>
            </div>
        </div>
    )
}

function MinimalHeader({ accentColor, formTitle, onBack }) {
    return (
        <div
            className="sticky top-0 z-50 flex items-center gap-2.5 px-3 py-2 sm:px-4"
            style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-light)' }}
        >
            <button
                type="button"
                onClick={onBack}
                className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-bg-tertiary border-none cursor-pointer"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                aria-label="Close"
            >
                <i className="fas fa-times text-[11px]" />
            </button>
            <div
                className="flex h-6 w-6 items-center justify-center rounded shrink-0"
                style={{ background: 'var(--bg-tertiary)', color: accentColor }}
            >
                <i className="fas fa-clipboard-list text-[11px]" />
            </div>
            <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                {formTitle || 'Loading…'}
            </span>
        </div>
    )
}

function LoadingState({ accentColor, formTitle, onBack }) {
    return (
        <div className="flex min-h-screen w-full flex-col" style={{ background: 'var(--bg-secondary)' }}>
            <MinimalHeader accentColor={accentColor} formTitle={formTitle} onBack={onBack} />
            <div className="flex flex-1 items-center justify-center p-6">
                <LoadingScreen inline message="Loading form…" />
            </div>
        </div>
    )
}

function EmptyFieldsState({ accentColor, formTitle, onBack }) {
    return (
        <div className="flex min-h-screen w-full flex-col" style={{ background: 'var(--bg-secondary)' }}>
            <MinimalHeader accentColor={accentColor} formTitle={formTitle || 'Form'} onBack={onBack} />
            <div
                className="flex flex-1 flex-col items-center justify-center gap-1.5 p-6"
                style={{ color: 'var(--text-tertiary)' }}
            >
                <i className="fas fa-exclamation-circle text-2xl" />
                <h3 className="text-[13px] font-semibold m-0" style={{ color: 'var(--text-primary)' }}>
                    No Fields
                </h3>
                <p className="text-[11px] m-0">This form has no fields configured.</p>
            </div>
        </div>
    )
}

/**
 * Stepper-based form filler for maintenance tasks. One field per step with
 * optional image attachments, then submits responses. Also delegates to
 * review and read-only components when applicable.
 */
export default function MaintenanceFormView({ item, onBack, onSubmitted }) {
    const accentColor = useAccentColor()
    const form = useMaintenanceForm({ item, onSubmitted })
    const { imageHook } = form
    const isDisabled = form.isReview || (form.isViewOnly && !form.isEditing)
    if (form.isReview) {
        if (form.loading)
            return <LoadingState accentColor={accentColor} formTitle={form.formObj?.title} onBack={onBack} />
        return (
            <MaintenanceFormReview
                checklistComments={form.checklistComments}
                checklistStates={form.checklistStates}
                errors={form.errors}
                fieldImages={imageHook.fieldImages}
                fields={form.fields}
                formObj={form.formObj}
                imagePreview={imageHook.imagePreview}
                item={item}
                onBack={onBack}
                onClosePreview={imageHook.closeImagePreview}
                onOpenPreview={imageHook.openImagePreview}
                onReview={form.handleReview}
                responses={form.responses}
                reviewNotes={form.reviewNotes}
                setReviewNotes={form.setReviewNotes}
                submitterName={form.submitterName}
                submitting={form.submitting}
            />
        )
    }
    if (form.isViewOnly && !form.isEditing) {
        return (
            <MaintenanceFormViewOnly
                checklistStates={form.checklistStates}
                fieldImages={imageHook.fieldImages}
                fields={form.fields}
                formObj={form.formObj}
                imagePreview={imageHook.imagePreview}
                item={item}
                onBack={onBack}
                onClosePreview={imageHook.closeImagePreview}
                onOpenPreview={imageHook.openImagePreview}
                responses={form.responses}
                reviewNotes={form.reviewNotes}
            />
        )
    }
    if (form.loading || (!form.formObj && !item)) {
        return <LoadingState accentColor={accentColor} formTitle={form.formObj?.title} onBack={onBack} />
    }
    if (form.fields.length === 0) {
        return <EmptyFieldsState accentColor={accentColor} formTitle={form.formObj?.title} onBack={onBack} />
    }
    return (
        <div className="flex min-h-screen w-full flex-col" style={{ background: 'var(--bg-secondary)' }}>
            <StepperHeader
                accentColor={accentColor}
                formTitle={form.formObj?.title}
                dueDate={formatMaintenanceDateShort(item?.due_date)}
                currentStep={form.currentStep}
                totalSteps={form.totalSteps}
                isFirstStep={form.isFirstStep}
                isLastStep={form.isLastStep}
                submitting={form.submitting}
                isEditing={form.isEditing}
                onBack={onBack}
                onPrevious={form.handlePrevious}
                onNext={form.handleNext}
                onSubmit={form.handleSubmit}
            />
            {form.currentField && (
                <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-3 py-3 sm:px-4 sm:py-4">
                    <div
                        className="rounded p-3 sm:p-4"
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                    >
                        <FieldCard accentColor={accentColor} field={form.currentField} />
                        {form.currentField.description && (
                            <p className="mb-3 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                {form.currentField.description}
                            </p>
                        )}
                        <FieldRenderer
                            field={form.currentField}
                            form={form}
                            imageHook={imageHook}
                            errors={form.errors}
                            disabled={isDisabled}
                            accentColor={accentColor}
                        />
                        {form.errors[form.currentField.id] && (
                            <div
                                className="mt-2 flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-medium"
                                style={{
                                    background: '#fee2e2',
                                    border: '1px solid #fca5a5',
                                    color: '#b91c1c'
                                }}
                            >
                                <i className="fas fa-exclamation-circle text-[11px]" />
                                {form.errors[form.currentField.id]}
                            </div>
                        )}
                        {form.currentField.image_required && (
                            <FieldImageSection
                                field={form.currentField}
                                imageHook={imageHook}
                                errors={form.errors}
                                disabled={isDisabled}
                            />
                        )}
                    </div>
                    {form.errors.submit && (
                        <div
                            className="mt-2 flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-medium"
                            style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c' }}
                        >
                            <i className="fas fa-exclamation-triangle text-[11px]" />
                            {form.errors.submit}
                        </div>
                    )}
                </div>
            )}
            <input
                ref={imageHook.fileInputRef}
                type="file"
                accept="image/*"
                onChange={imageHook.onFileInputChange}
                className="hidden"
            />
            <input
                ref={imageHook.cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={imageHook.onFileInputChange}
                className="hidden"
            />
            <ImagePreviewModal imageUrl={imageHook.imagePreview} onClose={imageHook.closeImagePreview} />
        </div>
    )
}
