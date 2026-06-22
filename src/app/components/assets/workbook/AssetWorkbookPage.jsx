import React from 'react'

import useWorkbookData from '../../../hooks/useWorkbookData'
import AssetWorkbookView from './AssetWorkbookView'

export default function AssetWorkbookPage({ columns, config, title }) {
    const { items, loading, lookups } = useWorkbookData({
        config,
        regionPlantCodes: null
    })

    return (
        <AssetWorkbookView
            columns={columns}
            data={items}
            loading={loading}
            lookups={lookups}
            title={title}
        />
    )
}
