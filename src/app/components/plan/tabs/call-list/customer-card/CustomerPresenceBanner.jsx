/* eslint-disable react/forbid-dom-props */
import React from 'react'

import Badge from '../../../../common/Badge'

/** Live "X is also viewing this customer" warning. Hidden when no
 *  other dispatcher is on the same customer detail. Renders an amber
 *  banner with the other viewers' names and roles so the dispatcher
 *  can coordinate before dialling. Driven by
 *  `useCallListCustomerPresence` — purely ephemeral, no DB writes. */
export function CustomerPresenceBanner({ viewers }) {
    if (!viewers || viewers.length === 0) return null
    const names = viewers.map((v) => v.name)
    const message =
        viewers.length === 1
            ? `${names[0]} is also viewing this customer`
            : viewers.length === 2
              ? `${names[0]} and ${names[1]} are also viewing this customer`
              : `${names[0]} and ${viewers.length - 1} others are also viewing this customer`
    return (
        <div
            className="rounded-md flex items-start gap-3 px-3 py-2.5"
            style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)'
            }}
            role="status"
        >
            <i className="fas fa-triangle-exclamation text-[14px] mt-0.5" style={{ color: 'var(--text-primary)' }} />
            <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {message}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Coordinate before calling so this customer isn&apos;t dialled twice.
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {viewers.map((v) => (
                        <Badge
                            key={v.userId}
                            tone="warning"
                            size="md"
                            weight="semibold"
                            uppercase={false}
                            icon="circle"
                            title={v.role || undefined}
                        >
                            {v.name}
                            {v.role && <span className="opacity-70"> · {v.role}</span>}
                        </Badge>
                    ))}
                </div>
            </div>
        </div>
    )
}
