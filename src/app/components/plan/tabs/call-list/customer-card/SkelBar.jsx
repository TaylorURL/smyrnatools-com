/* eslint-disable react/forbid-dom-props */
import React from 'react'

/** Small animated placeholder rectangle reused across the call-list
 *  customer card skeletons. */
export const SkelBar = ({ className = '', style }) => (
    <div className={`rounded animate-pulse ${className}`} style={{ background: 'var(--bg-tertiary)', ...style }} />
)
