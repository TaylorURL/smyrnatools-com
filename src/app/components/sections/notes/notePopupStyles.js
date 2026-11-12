/** A row action in the comment and issue lists: a quiet text button that
 *  takes its colour from the caller. */
export const NOTE_ACTION_CLS =
    'shrink-0 cursor-pointer rounded-[4px] border-none bg-transparent px-1.5 py-1 text-[12px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none'

/** Laid over `DIALOG_TEXTAREA` in the composers, which sit on the footer's
 *  tinted surface and need to stay short enough to keep the list in view. */
export const NOTE_COMPOSER_TEXTAREA = '!min-h-[72px]'
