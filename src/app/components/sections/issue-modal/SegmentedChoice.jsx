import React from 'react'

/**
 * Joined buttons in one outline, the app's switcher: the chosen one is
 * pressed in (darker fill, medium weight). An option may carry a `count`,
 * shown as a plain figure after its label.
 */
export default function SegmentedChoice({ ariaLabel, onChange, options, value }) {
    return (
        <div
            role="group"
            aria-label={ariaLabel}
            className="inline-flex h-9 items-stretch overflow-hidden rounded-[4px] border border-border-medium"
        >
            {options.map((option) => {
                const active = option.id === value
                return (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => onChange(option.id)}
                        aria-pressed={active}
                        className={`inline-flex cursor-pointer items-center gap-2 border-0 border-r border-solid border-border-light px-3 text-[13px] transition-colors duration-150 ease-out last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent motion-reduce:transition-none ${
                            active
                                ? 'bg-bg-tertiary font-medium text-text-primary'
                                : 'bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                        }`}
                    >
                        {option.label}
                        {option.count != null && (
                            <span className="font-normal tabular-nums text-text-tertiary">{option.count}</span>
                        )}
                    </button>
                )
            })}
        </div>
    )
}
