import React from 'react'

import { DIALOG_INPUT } from '../ui/Dialog'

/**
 * The search box a picker puts in its dialog toolbar: a magnifier inside the
 * left edge and, once something is typed, a clear button inside the right.
 * `autoFocus` marks it for Dialog to focus when it opens (React's own
 * `autoFocus` would be undone by Dialog focusing its panel). A field that
 * appears after the dialog has opened takes `inputRef` and is focused by its
 * owner instead.
 */
export default function DialogSearchField({
    autoFocus = false,
    className = '',
    inputRef,
    label,
    onChange,
    placeholder,
    type = 'text',
    value
}) {
    return (
        <div className={`relative ${className}`}>
            <i
                className="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-text-tertiary"
                aria-hidden="true"
            />
            <input
                ref={inputRef}
                type={type}
                placeholder={placeholder}
                aria-label={label}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                data-autofocus={autoFocus ? '' : undefined}
                className={`${DIALOG_INPUT} pl-8 pr-10 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none`}
            />
            {value && (
                <button
                    type="button"
                    onClick={() => onChange('')}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[4px] border-0 bg-transparent text-text-tertiary transition-colors duration-150 hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
                >
                    <i className="fas fa-times text-[11px]" aria-hidden="true" />
                </button>
            )}
        </div>
    )
}
