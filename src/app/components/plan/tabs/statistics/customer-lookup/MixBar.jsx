/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { BAD, GOOD, LATE, SLOW } from './customerLookupShared'

/** Stacked horizontal bar: good / late-only / slow-only / both. */
export default function MixBar({ badJobs, goodJobs, jobs, lateJobs, slowJobs }) {
    if (jobs === 0) return null
    const lateOnly = Math.max(0, lateJobs - Math.min(lateJobs, slowJobs))
    const slowOnly = Math.max(0, slowJobs - Math.min(lateJobs, slowJobs))
    const both = Math.max(0, badJobs - lateOnly - slowOnly)
    const seg = (count, color) =>
        count > 0 ? <div style={{ background: color, width: `${(count / jobs) * 100}%` }} /> : null
    return (
        <div className="rounded-sm h-1.5 overflow-hidden flex bg-bg-tertiary">
            {seg(goodJobs, GOOD)}
            {seg(lateOnly, LATE)}
            {seg(slowOnly, SLOW)}
            {seg(both, BAD)}
        </div>
    )
}
