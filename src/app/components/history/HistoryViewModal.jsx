import React from 'react'
import ReactDOM from 'react-dom'

import TabButton from '../ui/TabButton'

/**
 * Portal-mounted full-screen modal shell that hosts the change history UI. Owns
 * the header, tab strip, scroll body, and footer chrome; child content is
 * supplied by the caller and renders inside the scrollable body.
 */
export default function HistoryViewModal({
    activeTab,
    children,
    itemName,
    onClose,
    scrollContainerRef,
    setActiveTab,
    tabs
}) {
    if (typeof document === 'undefined' || !document.body) return null
    return ReactDOM.createPortal(
        <div className="fixed inset-0 flex items-center justify-center z-[2000] p-4 bg-[rgba(15,_23,_42,_0.65)]">
            <div className="flex flex-col max-w-[900px] w-full max-h-[85vh] rounded overflow-hidden bg-bg-primary border border-border-light">
                <div className="flex justify-between items-center px-4 py-3 border-b border-border-light">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded flex items-center justify-center shrink-0 bg-bg-tertiary text-text-secondary">
                            <i className="fas fa-history text-[12px]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                                Change History
                            </div>
                            <h2 className="text-[14px] font-semibold m-0 truncate text-text-primary">{itemName}</h2>
                        </div>
                    </div>
                    <button
                        className="w-7 h-7 flex items-center justify-center rounded transition-colors bg-transparent text-text-secondary"
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={onClose}
                    >
                        <i className="fas fa-times text-[12px]" />
                    </button>
                </div>
                <div className="flex gap-1.5 px-4 py-2 overflow-x-auto shrink-0 bg-bg-secondary border-b border-border-light">
                    {tabs.map((tab) => (
                        <TabButton
                            key={tab.id}
                            label={tab.label}
                            isActive={activeTab === tab.id}
                            onClick={() => setActiveTab(tab.id)}
                        />
                    ))}
                </div>
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-3 min-h-0 bg-bg-primary">
                    {children}
                </div>
                <div className="px-4 py-2.5 flex justify-end bg-bg-secondary border-t border-border-light">
                    <button
                        className="rounded px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider transition-colors bg-bg-primary border border-border-light text-text-primary"
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-primary)')}
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
