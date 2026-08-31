import React from 'react'
import ReactDOM from 'react-dom'

/** Bottom-center feedback toast for detail views, portalled to `document.body`.
 *  Success and failure copy arrive through the same props, so the tone comes
 *  from the wording: text mentioning "error" or "cannot" renders red. */
export default function DetailViewMessagePortal({ message, warning }) {
    if (!message && !warning) return null
    const text = message || warning || ''
    const isError = text.toLowerCase().includes('error') || text.toLowerCase().includes('cannot')
    return ReactDOM.createPortal(
        <div
            className={`fixed bottom-6 left-1/2 z-nav flex -translate-x-1/2 items-center gap-2.5 rounded-[10px] px-4 py-3 text-[13px] font-medium text-[color:var(--on-accent)] shadow-modal ${
                isError ? 'bg-[var(--danger)]' : 'bg-[var(--success)]'
            }`}
        >
            <i className={`fas ${isError ? 'fa-times-circle' : 'fa-check-circle'}`}></i>
            {message || warning}
        </div>,
        document.body
    )
}
