/** Oversight gate (Team Monitor, reassign owners, bulk assign). */
export function canManageCrm(permissions) {
    return Array.isArray(permissions) && permissions.includes('crm.manage')
}

/** Field pin gate — anyone with CRM access (`plan.view`, the same permission
 *  that makes the CRM visible) can drop a GPS pin; an explicit `crm.pins`
 *  grant also qualifies. Dropping a pin + note is a low-risk field action, so
 *  it rides the same visibility as the CRM itself rather than a separately
 *  granted node (which was never seeded, hiding the button from everyone). */
export function canDropPin(permissions) {
    return Array.isArray(permissions) && (permissions.includes('plan.view') || permissions.includes('crm.pins'))
}
