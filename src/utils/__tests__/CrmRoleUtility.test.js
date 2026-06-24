import { describe, expect, it } from 'vitest'

import { canDropPin, canManageCrm } from '../CrmRoleUtility'

describe('CrmRoleUtility', () => {
    it('detects crm.manage', () => {
        expect(canManageCrm(['plan.view', 'crm.manage'])).toBe(true)
        expect(canManageCrm(['plan.view'])).toBe(false)
        expect(canManageCrm(null)).toBe(false)
    })
    it('grants canDropPin to anyone with CRM access (plan.view) or an explicit crm.pins node', () => {
        expect(canDropPin(['plan.view'])).toBe(true)
        expect(canDropPin(['crm.view', 'crm.pins'])).toBe(true)
        expect(canDropPin(['crm.view'])).toBe(false)
        expect(canDropPin([])).toBe(false)
        expect(canDropPin(null)).toBe(false)
        expect(canDropPin(undefined)).toBe(false)
    })
})
