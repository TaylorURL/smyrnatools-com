/* eslint-disable react/forbid-dom-props */
import React from 'react'

/** Header strip: order/customer identity on the left, loaded total + close on the right. */
function OrderTicketsHeader({
    accentColor,
    customerLabel,
    homePlantCode,
    homePlantName,
    inline,
    onClose,
    orderNumLabel,
    orderTotal,
    totalLoaded
}) {
    return (
        <div className="flex items-start gap-3 px-5 py-3 border-b border-border-light">
            <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-text-primary"
                style={{ background: `${accentColor}14` }}
            >
                <i className="fas fa-ticket text-[14px]" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold leading-tight text-text-primary">Tickets {orderNumLabel}</div>
                <div className="text-[12px] mt-0.5 truncate text-text-secondary" title={customerLabel}>
                    {customerLabel || '—'}
                    {homePlantCode && (
                        <span className="ml-2 text-text-tertiary">
                            · home plant {homePlantCode}
                            {homePlantName ? ` (${homePlantName})` : ''}
                        </span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                    <div className="text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary">Loaded</div>
                    <div
                        className="font-mono font-bold text-[14px] text-text-primary"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                        {Number.isInteger(totalLoaded) ? totalLoaded : totalLoaded.toFixed(2)}
                        <span className="text-[12px] ml-1 text-text-tertiary">/ {orderTotal || '—'} yd</span>
                    </div>
                </div>
                {!inline && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-md flex items-center justify-center bg-transparent border-0 cursor-pointer text-text-secondary"
                        aria-label="Close"
                        title="Close"
                    >
                        <i className="fas fa-xmark text-[14px]" />
                    </button>
                )}
            </div>
        </div>
    )
}

export default OrderTicketsHeader
