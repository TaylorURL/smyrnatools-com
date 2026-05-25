/* eslint-disable react/forbid-dom-props */
import React from 'react'

/** Footer action row for the Reports Submit form — Cancel, Save Changes, and
 *  Submit. Hidden entirely in read-only mode. The Submit button is suppressed
 *  while a manager is editing on behalf of another user, since that flow
 *  saves a draft rather than producing a final submission. */
const SubmitActions = ({
    accentColor,
    isPlantProduction,
    managerEditUser,
    onCancel,
    onSaveDraft,
    savingDraft,
    submitting
}) => (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 sm:pt-6 border-t border-border-light mt-4 sm:mt-6">
        <button
            type="button"
            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors order-3 sm:order-1"
            onClick={onCancel}
            disabled={submitting || savingDraft}
        >
            Cancel
        </button>
        <button
            type="button"
            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-sky-100 text-text-primary rounded-lg text-sm font-semibold hover:bg-sky-200 transition-colors order-2"
            onClick={onSaveDraft}
            disabled={submitting || savingDraft}
        >
            {savingDraft ? 'Saving...' : 'Save Changes'}
        </button>
        {!managerEditUser && (
            <button
                type="submit"
                className="px-4 sm:px-6 py-2.5 sm:py-3 text-white rounded-lg text-sm font-semibold transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed order-1 sm:order-3"
                style={{ background: accentColor }}
                disabled={submitting || savingDraft}
            >
                {submitting ? (isPlantProduction ? 'Validating...' : 'Submitting...') : 'Submit'}
            </button>
        )}
    </div>
)

export default SubmitActions
