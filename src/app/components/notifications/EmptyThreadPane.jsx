import React from 'react'

/** Shown when no thread is selected in the chat pane — explains where to
 *  click next and offers a Compose shortcut. */
export default function EmptyThreadPane({ onCompose }) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="text-[15px] font-medium text-text-primary">No conversation open</div>
            <div className="text-[13px] mt-1 text-text-secondary">Pick one from the list, or start a new message.</div>
            <button type="button" onClick={onCompose} className="btn-secondary mt-4">
                <i className="fas fa-pen text-[11px]" aria-hidden="true" />
                New message
            </button>
        </div>
    )
}
