import React from 'react'

function AttachmentField({ attachment, fileInputRef, onFileSelect, onClear }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Writeup Attachment <span className="text-text-tertiary font-normal normal-case">(optional PDF)</span>
            </label>
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={onFileSelect}
                className="hidden"
            />
            {attachment ? (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg-secondary border border-border-light">
                    <i className="fas fa-file-pdf text-text-primary" />
                    <span className="flex-1 min-w-0 text-sm font-medium text-text-primary truncate">
                        {attachment.name}
                    </span>
                    <span className="text-xs text-text-secondary shrink-0">
                        {(attachment.size / 1024 / 1024).toFixed(1)}MB
                    </span>
                    <button type="button"
                        type="button"
                        onClick={onClear}
                        aria-label="Remove attachment"
                        className="w-6 h-6 flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors duration-150 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                    >
                        <i className="fas fa-times text-xs" />
                    </button>
                </div>
            ) : (
                <button type="button"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg border-2 border-dashed border-border-light text-sm text-text-secondary hover:border-border-dark transition-colors"
                >
                    <i className="fas fa-cloud-upload-alt" />
                    Upload PDF
                </button>
            )}
        </div>
    )
}

export default AttachmentField
