const PLANT_ROLES = new Set(['Plant Manager', 'Backup Plant Manager', 'Plant Manager & Equipment Manager'])
const DISPATCH_ROLES = new Set([
    'Dispatcher',
    'Dispatch Manager',
    'Cement Dispatch Manager',
    'Cement Dispatcher',
    'End Dump Manager'
])

/** Default interaction role-lens for a role name. Weight is org seniority,
 *  not job function, so we map by name; always user-overridable in the UI. */
export function roleLensForRoleName(roleName) {
    if (roleName === 'Sales') return 'sales'
    if (PLANT_ROLES.has(roleName)) return 'plant'
    if (DISPATCH_ROLES.has(roleName)) return 'dispatch'
    return 'general'
}

/** Oversight gate (Team Monitor, reassign owners, bulk assign). */
export function canManageCrm(permissions) {
    return Array.isArray(permissions) && permissions.includes('crm.manage')
}

/** Write gate (log interactions, edit accounts, close opportunities). */
export function canEditCrm(permissions) {
    return Array.isArray(permissions) && permissions.includes('crm.edit')
}

/** Field pin gate — field workers with crm.pins permission can drop GPS pins. */
export function canDropPin(permissions) {
    return Array.isArray(permissions) && permissions.includes('crm.pins')
}
