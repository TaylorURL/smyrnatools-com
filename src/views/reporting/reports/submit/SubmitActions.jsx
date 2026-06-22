import React from 'react'

const FOCUS_RING =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'

const BASE_BUTTON = `inline-flex items-center justify-center gap-2 rounded-md px-4 sm:px-6 py-2.5 sm:py-3 text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${FOCUS_RING}`

/** Footer action row for the Reports Submit form — Cancel, Save Changes, and
 *  Submit. Hidden entirely in read-only mode. The Submit button is suppressed
 *  while a manager is editing on behalf of another user, since that flow
 *  saves a draft rather than producing a final submission. */
const SubmitActions = ({ isPlantProduction, managerEditUser, onCancel, onSaveDraft, savingDraft, submitting }) => (
    <div className="mt-4 flex flex-col items-stretch justify-end gap-2 border-t border-border-light pt-4 sm:mt-6 sm:flex-row sm:items-center sm:gap-3 sm:pt-6">
        <button type="button"
            className={`${BASE_BUTTON} order-3 border border-border-light bg-bg-primary text-text-secondary hover:bg-bg-hover hover:text-text-primary sm:order-1`}
            onClick={onCancel}
            disabled={submitting || savingDraft}
        >
            Cancel
        </button>
        <button type="button"
            className={`${BASE_BUTTON} order-2 border border-border-light bg-bg-secondary text-text-primary hover:bg-bg-hover`}
            onClick={onSaveDraft}
            disabled={submitting || savingDraft}
        >
            {savingDraft ? (
                <>
                    <i className="fas fa-circle-notch fa-spin" aria-hidden="true" />
                    Saving...
                </>
            ) : (
                'Save Changes'
            )}
        </button>
        {!managerEditUser && (
            <button type="button"
                type="submit"
                className={`${BASE_BUTTON} order-1 bg-accent text-white shadow-sm hover:bg-accent-hover sm:order-3`}
                disabled={submitting || savingDraft}
            >
                {submitting ? (
                    <>
                        <i className="fas fa-circle-notch fa-spin" aria-hidden="true" />
                        {isPlantProduction ? 'Validating...' : 'Submitting...'}
                    </>
                ) : (
                    'Submit'
                )}
            </button>
        )}
    </div>
)

export default SubmitActions
