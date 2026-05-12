/* eslint-disable react/forbid-dom-props */
import React from 'react'

/** Maps asset type labels to their corresponding embedded view route keys. */
export const getAssetViewType = (assetType) => {
    const viewMap = { Equipment: 'equipment', Mixer: 'mixers', Tractor: 'tractors', Trailer: 'trailers' }
    return viewMap[assetType] || 'equipment'
}

/** Skeleton pulse block — generic loading placeholder with configurable size. */
export const Skeleton = ({ className = '', style }) => (
    <div className={`bg-bg-tertiary rounded-lg animate-pulse ${className}`} style={style} />
)
