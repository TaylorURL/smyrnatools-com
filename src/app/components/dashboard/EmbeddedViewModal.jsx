import React, { useCallback, useEffect, useRef } from 'react'

import EquipmentsView from '../../../views/assets/equipment/EquipmentsView'
import MixersView from '../../../views/assets/mixers/MixersView'
import TractorsView from '../../../views/assets/tractors/TractorsView'
import TrailersView from '../../../views/assets/trailers/TrailersView'
import OperatorsView from '../../../views/people/operators/OperatorsView'
import Dialog from '../ui/Dialog'

/** Maps view keys to their component and display title. */
const VIEW_CONFIG = {
    equipment: { component: EquipmentsView, title: 'Equipment' },
    mixers: { component: MixersView, title: 'Mixers' },
    operators: { component: OperatorsView, title: 'Operators' },
    tractors: { component: TractorsView, title: 'Tractors' },
    trailers: { component: TrailersView, title: 'Trailers' }
}

/**
 * A whole list view opened in a dialog from the dashboard, notifications or
 * an asset page, optionally pre-searched. The list brings its own toolbar,
 * so the dialog body is edge to edge on the page surface.
 *
 * It sits on the `z-panel` layer rather than the dialog default so the
 * views it hosts can still open their own dialogs and menus above it.
 *
 * @param {Object} props
 * @param {'equipment'|'mixers'|'operators'|'tractors'|'trailers'} props.embeddedView - Key selecting which view to render.
 * @param {string} [props.embeddedViewSearch] - Initial search string passed to the embedded view.
 * @param {Object} [props.embeddedViewProps] - Extra props for the embedded view.
 * @param {Function} props.onClose - Called by the close button, Escape or the scrim.
 */
export default function EmbeddedViewModal({
    embeddedView,
    embeddedViewSearch,
    embeddedViewProps,
    accentColor: _accentColor,
    onClose
}) {
    // Callers pass an inline close and re-render often (dashboard data, the
    // search the list reports back). The dialog re-runs its focus handling
    // whenever `onClose` changes, which would pull the caret out of the
    // list's search box, so it gets one stable close instead.
    const onCloseRef = useRef(onClose)
    useEffect(() => {
        onCloseRef.current = onClose
    })
    const handleClose = useCallback(() => onCloseRef.current?.(), [])

    const config = VIEW_CONFIG[embeddedView]
    if (!config) return null
    const ViewComponent = config.component
    return (
        <Dialog
            open
            onClose={handleClose}
            size="xl"
            tall
            title={config.title}
            description={embeddedViewSearch ? `Searching for “${embeddedViewSearch}”` : undefined}
            bodyClassName="p-0 bg-bg-secondary"
            zClassName="z-panel"
        >
            <ViewComponent
                embedded={true}
                initialSearch={embeddedViewSearch}
                exactMatch={true}
                {...(embeddedViewProps || {})}
            />
        </Dialog>
    )
}
