import { GM_REQUIRED_FIELD_SUFFIXES } from '../../../../app/constants/reportsSubmitConstants'

export const validateSafetyManager = (form) => {
    const issues = Array.isArray(form.issues) ? form.issues : []
    return issues.some((i) => !i.description || !i.plant || !i.tag)
        ? 'All issues must have a description, plant, and tag.'
        : null
}

export const validateRequiredFields = (form, fields) => {
    for (const field of fields) {
        const val = form[field.name]
        if (
            field.required &&
            (val === undefined || val === null || val === '' || (Array.isArray(val) && !val.length))
        ) {
            return 'Please fill out all required fields before submitting.'
        }
    }
    return null
}

export const validateGMFields = (form, plants) => {
    if (!plants.length) return null
    for (const plant of plants) {
        for (const suffix of GM_REQUIRED_FIELD_SUFFIXES) {
            const val = form[`${suffix}_${plant.plant_code}`]
            if (val === undefined || val === null || val === '') {
                return 'Please fill out all required fields before submitting.'
            }
        }
    }
    return null
}

export const getEditingUserName = (managerEditUser, userProfiles) => {
    if (!managerEditUser) return ''
    const profile = userProfiles?.[managerEditUser]
    return profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : managerEditUser.slice(0, 8)
}

export const getFieldIcon = (fieldName) => {
    const iconMap = { total_hours: 'fa-clock', yardage: 'fa-box' }
    return iconMap[fieldName] || 'fa-recycle'
}
