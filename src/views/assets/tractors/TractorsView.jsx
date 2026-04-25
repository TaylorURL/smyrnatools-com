import React from 'react'

import AssetView from '../AssetView'
import tractorConfig from '../configs/tractorConfig'

function TractorsView({
    title = 'Tractor Fleet',
    setSelectedView,
    embedded = false,
    initialSearch = '',
    exactMatch = false
}) {
    return (
        <AssetView
            config={tractorConfig}
            title={title}
            setSelectedView={setSelectedView}
            embedded={embedded}
            initialSearch={initialSearch}
            exactMatch={exactMatch}
        />
    )
}

export default TractorsView
