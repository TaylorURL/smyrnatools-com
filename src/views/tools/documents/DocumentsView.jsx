/* eslint-disable react/forbid-dom-props */
import React, { useCallback, useMemo, useRef, useState } from 'react'

import Modal, { ModalBody } from '../../../app/components/common/Modal'
import TopSection from '../../../app/components/sections/TopSection'
import { useConfirm } from '../../../app/context/ConfirmContext'
import { useDocumentsData } from '../../../app/hooks/useDocumentsData'
import { useIsMobile } from '../../../app/hooks/useIsMobile'
import { usePagination } from '../../../app/hooks/usePagination'
import { DateUtility } from '../../../utils/DateUtility'

/** Icon class mapping for each document file type. */
const FILE_TYPE_ICONS = {
    document: 'fa-file-word',
    image: 'fa-file-image',
    other: 'fa-file',
    pdf: 'fa-file-pdf',
    presentation: 'fa-file-powerpoint',
    spreadsheet: 'fa-file-excel',
    text: 'fa-file-alt',
    video: 'fa-file-video'
}
/** Accent color per file type for icon backgrounds and badges. */
const FILE_TYPE_COLORS = {
    document: '#2563eb',
    image: '#8b5cf6',
    other: '#64748b',
    pdf: '#dc2626',
    presentation: '#ea580c',
    spreadsheet: '#16a34a',
    text: '#64748b',
    video: '#7c3aed'
}
/** Options shown in the file-type dropdown filter. */
const TYPE_FILTER_OPTIONS = [
    'All Types',
    'pdf',
    'document',
    'spreadsheet',
    'image',
    'video',
    'presentation',
    'text',
    'other'
]
/** File types that support inline preview (PDF viewer, image tag, video player). */
const PREVIEWABLE_TYPES = new Set(['pdf', 'image', 'video'])

/**
 * Formats a byte count into a human-readable size string (e.g. "2.4 MB").
 * @param {number} bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

/**
 * Full-screen modal for previewing PDFs, images, and videos inline.
 * Uses the shared Modal component for consistent header/close behavior.
 */
function PreviewModal({ doc, onClose }) {
    return (
        <Modal title={doc.name} titleIcon="fas fa-eye" onClose={onClose}>
            <ModalBody>
                <div className="flex items-center justify-center min-h-[300px]">
                    {doc.file_type === 'pdf' && (
                        <iframe
                            src={doc.file_path}
                            className="w-full h-[75vh] border-none rounded-lg"
                            title={doc.name}
                        />
                    )}
                    {doc.file_type === 'image' && (
                        <img
                            src={doc.file_path}
                            alt={doc.name}
                            className="max-w-full max-h-[75vh] rounded-lg object-contain"
                        />
                    )}
                    {doc.file_type === 'video' && (
                        <video src={doc.file_path} controls className="max-w-full max-h-[75vh] rounded-lg">
                            Your browser does not support video playback.
                        </video>
                    )}
                </div>
            </ModalBody>
        </Modal>
    )
}

/** Single document row — adapts layout for mobile (stacked) vs desktop (grid). */
function DocumentRow({ doc, uploaderName, canDelete, onDelete, onPreview, isMobile }) {
    const icon = FILE_TYPE_ICONS[doc.file_type] || FILE_TYPE_ICONS.other
    const color = FILE_TYPE_COLORS[doc.file_type] || FILE_TYPE_COLORS.other
    const previewable = PREVIEWABLE_TYPES.has(doc.file_type)

    if (isMobile) {
        return (
            <div className="flex items-start gap-3 px-4 py-3.5 border-b border-border-light last:border-b-0">
                <div
                    className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: `${color}15` }}
                >
                    <i className={`fas ${icon} text-sm text-text-primary`} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">{doc.name}</div>
                    <div className="text-xs text-text-tertiary mt-0.5">
                        {formatFileSize(doc.file_size)} &middot; {DateUtility.formatDate(doc.created_at)}
                        {uploaderName ? ` \u00b7 ${uploaderName}` : ''}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        {previewable && (
                            <button type="button"
                                onClick={() => onPreview(doc)}
                                className="text-xs font-medium px-2.5 py-1 rounded-md border border-border-light bg-bg-primary text-text-secondary cursor-pointer hover:bg-bg-tertiary hover:border-border-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                            >
                                <i className="fas fa-eye mr-1" />
                                Preview
                            </button>
                        )}
                        <a
                            href={doc.file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="text-xs font-medium px-2.5 py-1 rounded-md border border-border-light bg-bg-primary text-text-secondary no-underline hover:bg-bg-tertiary hover:border-border-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                            <i className="fas fa-download mr-1" />
                            Download
                        </a>
                        {canDelete && (
                            <button type="button"
                                onClick={() => onDelete(doc)}
                                className="text-xs font-medium px-2.5 py-1 rounded-md border border-[color:var(--danger)]/40 bg-bg-primary text-[color:var(--danger)] cursor-pointer hover:bg-[color:var(--danger)]/10 hover:border-[color:var(--danger)]/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--danger)]/40"
                            >
                                <i className="fas fa-trash mr-1" />
                                Delete
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-[1fr_90px_110px_140px_110px] items-center gap-2 px-3 py-1.5 border-b border-border-light last:border-b-0 hover:bg-bg-hover transition-colors duration-150">
            <div className="flex items-center gap-2 min-w-0">
                <span
                    className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-text-primary"
                    style={{ background: `${color}14` }}
                >
                    <i className={`fas ${icon} text-[10px]`} aria-hidden="true" />
                </span>
                <span className="text-[12px] font-semibold truncate text-text-primary" title={doc.name}>
                    {doc.name}
                </span>
            </div>
            <div className="text-[11px] font-mono tabular-nums text-text-secondary">
                {formatFileSize(doc.file_size)}
            </div>
            <div className="text-[11px] font-mono tabular-nums text-text-secondary">
                {DateUtility.formatDate(doc.created_at)}
            </div>
            <div className="text-[11px] truncate text-text-secondary" title={uploaderName || ''}>
                {uploaderName || '\u2014'}
            </div>
            <div className="flex items-center justify-end gap-0.5">
                {previewable && (
                    <button type="button"
                        onClick={() => onPreview(doc)}
                        className="flex items-center justify-center w-5 h-5 rounded text-[11px] cursor-pointer border-none bg-transparent text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        title="Preview"
                        aria-label={`Preview ${doc.name}`}
                    >
                        <i className="fas fa-eye" />
                    </button>
                )}
                <a
                    href={doc.file_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="flex items-center justify-center w-5 h-5 rounded text-[11px] no-underline text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    title="Download"
                    aria-label={`Download ${doc.name}`}
                >
                    <i className="fas fa-download" />
                </a>
                {canDelete && (
                    <button type="button"
                        type="button"
                        onClick={() => onDelete(doc)}
                        className="flex items-center justify-center w-5 h-5 rounded text-[11px] cursor-pointer border-none bg-transparent text-text-tertiary transition-colors hover:bg-[color:var(--danger)]/10 hover:text-[color:var(--danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--danger)]/40"
                        title="Delete"
                        aria-label={`Delete ${doc.name}`}
                    >
                        <i className="fas fa-trash" />
                    </button>
                )}
            </div>
        </div>
    )
}

/** Shimmer skeleton shown while documents are loading. */
function DocumentsSkeleton() {
    return Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 lg:px-7 py-4 border-b border-border-light animate-pulse">
            <div className="w-9 h-9 rounded-lg bg-bg-tertiary" />
            <div className="flex-1">
                <div className="h-3.5 rounded w-2/5 bg-bg-tertiary mb-1.5" />
                <div className="h-3 rounded w-1/4 bg-bg-secondary" />
            </div>
        </div>
    ))
}

/** Placeholder shown when no documents match the current filters. */
function EmptyState({ canUpload, onUpload }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-card flex items-center justify-center mb-4 bg-accent/10">
                <i className="fas fa-folder-open text-2xl text-accent" aria-hidden="true" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-text-primary mb-1">No documents yet</h3>
            <p className="text-sm text-text-tertiary mb-5 max-w-xs">
                {canUpload ? 'Upload your first document to get started.' : 'Documents will appear here once uploaded.'}
            </p>
            {canUpload && (
                <button type="button"
                    type="button"
                    onClick={onUpload}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border-none bg-accent text-white text-sm font-semibold cursor-pointer transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none hover:opacity-90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
                >
                    <i className="fas fa-cloud-upload-alt" aria-hidden="true" />
                    Upload Document
                </button>
            )}
        </div>
    )
}

/** Page-size selector and prev/next navigation for paginated document lists. */
function Pagination({ currentPage, totalPages, pageSize, onPageSizeChange, onPageChange }) {
    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border-light bg-bg-secondary">
            <select
                className="appearance-none bg-bg-primary border border-border-light rounded-md text-sm text-text-primary py-1.5 pl-3 pr-8 cursor-pointer hover:border-border-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus:border-accent bg-no-repeat [color-scheme:light] dark:[color-scheme:dark]"
                style={{
                    backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")",
                    backgroundPosition: 'right 8px center',
                    backgroundSize: '14px'
                }}
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                aria-label="Documents per page"
            >
                {[25, 50, 100].map((n) => (
                    <option key={n} value={n}>
                        {n} per page
                    </option>
                ))}
            </select>
            <div className="flex items-center gap-2">
                <button type="button"
                    className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                        currentPage === 1
                            ? 'bg-bg-tertiary text-text-tertiary border-border-light cursor-not-allowed opacity-60'
                            : 'bg-bg-primary text-text-primary border-border-light hover:bg-bg-tertiary hover:border-border-medium cursor-pointer'
                    }`}
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                >
                    <i className="fas fa-chevron-left text-[10px] mr-1" />
                    <span className="hidden xs:inline">Prev</span>
                </button>
                <span className="text-sm text-text-secondary tabular-nums">
                    {currentPage} / {totalPages}
                </span>
                <button type="button"
                    className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                        currentPage === totalPages
                            ? 'bg-bg-tertiary text-text-tertiary border-border-light cursor-not-allowed opacity-60'
                            : 'bg-bg-primary text-text-primary border-border-light hover:bg-bg-tertiary hover:border-border-medium cursor-pointer'
                    }`}
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                >
                    <span className="hidden xs:inline">Next</span>
                    <i className="fas fa-chevron-right text-[10px] ml-1" />
                </button>
            </div>
        </div>
    )
}

/**
 * Document library view. Displays uploaded files in a searchable, filterable
 * table with file-type icons, pagination, inline preview for PDFs/images/videos,
 * and role-gated upload/delete capabilities via useDocumentsData.
 */
export default function DocumentsView() {
    const confirm = useConfirm()
    const isMobile = useIsMobile()
    const { canUpload, deleteDocument, documents, error, loading, profiles, uploadFile, uploading } = useDocumentsData()

    const [searchInput, setSearchInput] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [previewDoc, setPreviewDoc] = useState(null)
    const fileInputRef = useRef(null)

    const handleUploadClick = useCallback(() => {
        fileInputRef.current?.click()
    }, [])

    const handleFileChange = useCallback(
        (e) => {
            const file = e.target.files?.[0]
            if (file) uploadFile(file)
            e.target.value = ''
        },
        [uploadFile]
    )

    const handleDelete = useCallback(
        async (doc) => {
            const ok = await confirm({ confirmLabel: 'Delete', title: `Delete "${doc.name}"?` })
            if (ok) deleteDocument(doc)
        },
        [confirm, deleteDocument]
    )

    const searchLower = searchInput.toLowerCase().trim()
    const filtered = useMemo(() => {
        let result = documents
        if (typeFilter) result = result.filter((d) => d.file_type === typeFilter)
        if (searchLower) result = result.filter((d) => d.name.toLowerCase().includes(searchLower))
        return result
    }, [documents, typeFilter, searchLower])

    const { paginatedItems, currentPage, totalPages, pageSize, changePageSize, goToPage } = usePagination({
        initialPageSize: 25,
        items: filtered,
        resetDependencies: [searchInput, typeFilter]
    })

    /** File-type dropdown rendered inside TopSection's custom filter slot. */
    const typeFilterSelect = (
        <select
            className="appearance-none bg-bg-secondary border border-border-light rounded-xl text-text-primary text-sm cursor-pointer min-w-[140px] py-3 pl-4 pr-10 bg-no-repeat transition-colors hover:bg-bg-tertiary hover:border-border-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus:border-accent [color-scheme:light] dark:[color-scheme:dark]"
            style={{
                backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E\")",
                backgroundPosition: 'right 12px center',
                backgroundSize: '18px'
            }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter documents by file type"
        >
            {TYPE_FILTER_OPTIONS.map((opt) => (
                <option key={opt} value={opt === 'All Types' ? '' : opt}>
                    {opt === 'All Types' ? opt : opt.charAt(0).toUpperCase() + opt.slice(1)}
                </option>
            ))}
        </select>
    )

    return (
        <div className="bg-bg-secondary min-h-screen w-full pb-16">
            <TopSection
                title="Documents"
                isLoading={loading}
                sticky
                hideViewModeToggle
                hidePlantFilter
                searchPlaceholder="Search documents..."
                searchInput={searchInput}
                onSearchInputChange={setSearchInput}
                onClearSearch={() => setSearchInput('')}
                addButtonLabel="Upload Document"
                onAddClick={canUpload ? handleUploadClick : undefined}
                customFilters={typeFilterSelect}
            />
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.jpg,.jpeg,.png,.gif,.svg,.webp,.mp4,.mov,.webm"
            />
            {uploading && (
                <div className="mx-3 sm:mx-4 md:mx-6 lg:mx-8 mt-4">
                    <div className="flex items-center gap-3 bg-accent/10 border border-accent/30 rounded-xl px-5 py-3.5 animate-fade-slide-in">
                        <i className="fas fa-circle-notch fa-spin text-accent" aria-hidden="true" />
                        <span className="text-sm text-text-primary font-medium">Uploading document...</span>
                    </div>
                </div>
            )}
            {error && (
                <div className="mx-3 sm:mx-4 md:mx-6 lg:mx-8 mt-4">
                    <div className="flex items-center justify-between bg-[color:var(--danger)]/10 border border-[color:var(--danger)]/30 rounded-xl text-text-primary px-5 py-3.5">
                        <span className="text-sm">{error}</span>
                    </div>
                </div>
            )}
            <div className="px-3 py-4 sm:px-4 md:px-6 lg:px-8">
                <div className="bg-bg-primary rounded-xl border border-border-light shadow-sm overflow-hidden">
                    {loading ? (
                        <DocumentsSkeleton />
                    ) : filtered.length === 0 ? (
                        <EmptyState canUpload={canUpload} onUpload={handleUploadClick} />
                    ) : (
                        <>
                            {!isMobile && (
                                <div className="grid grid-cols-[1fr_100px_120px_160px_140px] px-4 lg:px-7 py-2.5 bg-bg-secondary border-b border-border-light text-[11px] font-bold uppercase tracking-wide text-text-tertiary">
                                    <div>Name</div>
                                    <div>Size</div>
                                    <div>Date</div>
                                    <div>Uploaded By</div>
                                    <div className="text-right">Actions</div>
                                </div>
                            )}
                            {paginatedItems.map((doc) => (
                                <DocumentRow
                                    key={doc.id}
                                    doc={doc}
                                    uploaderName={profiles[doc.uploaded_by]}
                                    canDelete={canUpload}
                                    onDelete={handleDelete}
                                    onPreview={setPreviewDoc}
                                    isMobile={isMobile}
                                />
                            ))}
                            {filtered.length > pageSize && (
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    pageSize={pageSize}
                                    onPageSizeChange={changePageSize}
                                    onPageChange={goToPage}
                                />
                            )}
                        </>
                    )}
                </div>
                {!loading && filtered.length > 0 && (
                    <div className="text-xs text-text-tertiary text-center mt-3">
                        {filtered.length} document{filtered.length !== 1 ? 's' : ''}
                        {typeFilter ? ` (${typeFilter})` : ''}
                    </div>
                )}
            </div>
            {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
        </div>
    )
}
