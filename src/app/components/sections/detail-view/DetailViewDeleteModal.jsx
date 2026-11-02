import React, { useCallback, useEffect, useRef } from 'react'

import Dialog from '../../ui/Dialog'

const ASK_PATTERN = /^are you sure you want to delete (.+?)\?\s*(.*)$/is

/**
 * Callers word the prompt as "Are you sure you want to delete Truck #2100?
 * This action cannot be undone." and title it "Confirm Delete". The dialog
 * asks the question in its title instead ("Delete Truck #2100?") and keeps
 * the consequence as the line under it. A message in any other shape is
 * shown as given.
 */
function deleteCopy(deleteTitle, deleteMessage) {
    const match = ASK_PATTERN.exec(deleteMessage || '')
    if (match) return { body: match[2] || 'This can’t be undone.', title: `Delete ${match[1]}?` }
    const title =
        !deleteTitle || /^confirm delete$/i.test(deleteTitle)
            ? 'Delete this record?'
            : deleteTitle.endsWith('?')
              ? deleteTitle
              : `${deleteTitle}?`
    return { body: deleteMessage, title }
}

export default function DetailViewDeleteModal({ deleteMessage, deleteTitle, onDeleteCancel, onDeleteConfirm, show }) {
    // Callers pass an inline cancel, so the identity changes on every render
    // of the record page. The dialog re-runs its focus handling whenever
    // `onClose` changes, so it gets one stable close that calls the latest.
    const onCancelRef = useRef(onDeleteCancel)
    useEffect(() => {
        onCancelRef.current = onDeleteCancel
    })
    const handleCancel = useCallback(() => onCancelRef.current?.(), [])

    const { body, title } = deleteCopy(deleteTitle, deleteMessage)
    return (
        <Dialog
            open={show}
            onClose={handleCancel}
            size="sm"
            title={title}
            footer={
                <>
                    <button type="button" className="btn-secondary" onClick={handleCancel}>
                        Cancel
                    </button>
                    <button type="button" className="btn-danger" onClick={onDeleteConfirm}>
                        Delete
                    </button>
                </>
            }
        >
            {body && <p className="m-0 text-[13px] leading-relaxed text-text-secondary">{body}</p>}
        </Dialog>
    )
}
