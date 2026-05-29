import React from 'react'

import { Panel, StatGroup } from '../ui/Panel'

/**
 * CRM-local wrappers around the shared dashboard primitives that square
 * the corners to `rounded-md` (6px). The shared `Panel` / `StatGroup` use
 * `rounded-card` (12px), which reads too round next to the CRM's
 * `rounded-md` tables and cards — these force the squarer radius via a
 * `!rounded-md` override WITHOUT changing the shared component (so
 * DashboardView and other consumers keep their existing look).
 *
 * Consumers import these aliased as `Panel` / `StatGroup`, so call sites
 * read identically to everywhere else that uses the primitives.
 */
export function CrmPanel({ innerClassName = 'p-3', ...props }) {
    return <Panel innerClassName={`${innerClassName} !rounded-md`} {...props} />
}

export function CrmStatGroup({ className = '', ...props }) {
    return <StatGroup className={`${className} !rounded-md`} {...props} />
}
