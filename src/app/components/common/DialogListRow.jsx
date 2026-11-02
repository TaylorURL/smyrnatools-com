import React from 'react'

/**
 * One row of a picker list inside a dialog: a name, a line of detail under
 * it, and an optional figure on the right, ruled off from the next row. The
 * current pick is shaded and set in medium weight; a row that can't be
 * picked is dimmed and disabled.
 */
export default function DialogListRow({ aside, current = false, detail, disabled = false, onClick, title }) {
    const state = current
        ? 'bg-bg-tertiary font-medium'
        : disabled
          ? 'cursor-not-allowed bg-transparent opacity-60'
          : 'cursor-pointer bg-transparent hover:bg-bg-hover'
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-current={current ? 'true' : undefined}
            className={`flex w-full items-start gap-4 border-0 border-b border-solid border-border-light px-6 py-3 text-left text-[13px] text-text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent motion-reduce:transition-none ${state}`}
        >
            <span className="min-w-0 flex-1">
                <span className="block truncate">{title}</span>
                {detail && (
                    <span className="mt-0.5 block truncate text-[12px] font-normal text-text-secondary">{detail}</span>
                )}
            </span>
            {aside && <span className="flex shrink-0 items-center">{aside}</span>}
        </button>
    )
}
