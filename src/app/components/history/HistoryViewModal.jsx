import React, { useCallback } from 'react'

import Dialog from '../ui/Dialog'
import TabButton from '../ui/TabButton'

/**
 * The change-history dialog: the record's name under a "Change history"
 * line, underline tabs pinned in the toolbar, and the caller's tab content in
 * the scrolling body. `scrollContainerRef` is pointed at that scrolling body
 * so the timeline tab can watch how far it has been scrolled.
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
    // The Dialog's body is the element that scrolls; this wrapper sits
    // directly inside it, so its parent is the node the ref needs.
    const attachScrollContainer = useCallback(
        (node) => {
            if (scrollContainerRef) scrollContainerRef.current = node ? node.parentElement : null
        },
        [scrollContainerRef]
    )

    return (
        <Dialog
            open
            onClose={onClose}
            size="xl"
            tall
            eyebrow="Change history"
            title={itemName}
            toolbar={
                // Pulled down onto the toolbar's bottom rule (its 16px padding
                // plus the 1px the active tab's bar overlaps) so the 2px bar
                // sits on that rule, as underline tabs do everywhere else.
                <div className="-mb-[17px] flex gap-5 overflow-x-auto pb-px">
                    {tabs.map((tab) => (
                        <TabButton
                            key={tab.id}
                            label={tab.label}
                            isActive={activeTab === tab.id}
                            onClick={() => setActiveTab(tab.id)}
                        />
                    ))}
                </div>
            }
            footer={
                <button type="button" onClick={onClose} className="btn-secondary">
                    Close
                </button>
            }
        >
            <div ref={attachScrollContainer}>{children}</div>
        </Dialog>
    )
}
