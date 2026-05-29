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

/** Field pin gate — anyone with CRM access (`plan.view`, the same permission
 *  that makes the CRM visible) can drop a GPS pin; an explicit `crm.pins`
 *  grant also qualifies. Dropping a pin + note is a low-risk field action, so
 *  it rides the same visibility as the CRM itself rather than a separately
 *  granted node (which was never seeded, hiding the button from everyone). */
export function canDropPin(permissions) {
    return Array.isArray(permissions) && (permissions.includes('plan.view') || permissions.includes('crm.pins'))
}
