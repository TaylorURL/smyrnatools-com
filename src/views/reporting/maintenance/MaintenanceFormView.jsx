import React from 'react'

import { useAccentColor } from '../../../app/hooks/useAccentColor'
import { useFormLoader } from '../../../app/hooks/useFormLoader'
import { LoadingShell } from './form-view/atoms'
import { ReviewMode } from './form-view/ReviewMode'
import { SubmitMode } from './form-view/SubmitMode'
import { ViewOnlyMode } from './form-view/ViewOnlyMode'

export default function MaintenanceFormView({ item, onBack, onSubmitted }) {
    const accentColor = useAccentColor()
    const isReview = !!item?.isReview
    const isViewOnly = !!item?.isViewOnly
    const submissionId = item?.submission_id || (isReview || isViewOnly ? item?.id : null)
    const { formObj, loading, submission } = useFormLoader(item, submissionId)

    if (loading) {
        const label = isReview ? 'Form review' : isViewOnly ? 'Submission' : 'Maintenance form'
        return <LoadingShell accentColor={accentColor} label={label} onBack={onBack} title={formObj?.title} />
    }

    if (isReview) {
        return (
            <ReviewMode
                accentColor={accentColor}
                formObj={formObj}
                item={item}
                onBack={onBack}
                onSubmitted={onSubmitted}
                submission={submission}
            />
        )
    }
    if (isViewOnly) {
        return (
            <ViewOnlyMode
                accentColor={accentColor}
                formObj={formObj}
                item={item}
                onBack={onBack}
                submission={submission}
            />
        )
    }
    return (
        <SubmitMode
            accentColor={accentColor}
            dueDate={item?.due_date}
            formObj={formObj}
            item={item}
            onBack={onBack}
            onSubmitted={onSubmitted}
            plantCode={item?.plant_code}
        />
    )
}
