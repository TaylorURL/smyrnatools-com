import React from 'react'

/**
 * One row of a picker list inside a dialog: a name, a line of detail under
 * it, and an optional figure on the right, ruled off from the next row. The
 * current pick is shaded and set in medium weight; a row that can't be
 * picked is dimmed and disabled.
 *
 * `leading` sits before the name (a checkbox, a code column). `indent` lines
 * the row up under an open group. Inside a `role="listbox"` pass
 * `role="option"`, and the current pick is announced as selected rather than
 * as current.
 */
export default function DialogListRow({
    aside,
    current = false,
    detail,
    disabled = false,
    indent = false,
    leading,
    onClick,
    role,
    title
}) {
    const state = current
        ? 'bg-bg-tertiary font-medium'
        : disabled
          ? 'cursor-not-allowed bg-transparent opacity-60'
          : 'cursor-pointer bg-transparent hover:bg-bg-hover'
    const isOption = role === 'option'
    return (
        <button
            type="button"
            role={role}
            onClick={onClick}
            disabled={disabled}
            aria-current={!isOption && current ? 'true' : undefined}
            aria-selected={isOption ? current : undefined}
            className={`flex w-full items-start gap-4 border-0 border-b border-solid border-border-light py-3 pr-6 text-left text-[13px] text-text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent motion-reduce:transition-none ${
                indent ? 'pl-14' : 'pl-6'
            } ${state}`}
        >
            {leading && <span className="flex h-5 shrink-0 items-center gap-3">{leading}</span>}
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
