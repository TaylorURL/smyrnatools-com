import { describe, expect, it } from 'vitest'

import { canDropPin, canEditCrm, canManageCrm, roleLensForRoleName } from '../CrmRoleUtility'

describe('CrmRoleUtility', () => {
    it('maps role names to a default lens', () => {
        expect(roleLensForRoleName('Sales')).toBe('sales')
        expect(roleLensForRoleName('Backup Plant Manager')).toBe('plant')
        expect(roleLensForRoleName('Dispatch Manager')).toBe('dispatch')
        expect(roleLensForRoleName('CEO')).toBe('general')
        expect(roleLensForRoleName(undefined)).toBe('general')
    })
    it('detects crm.manage', () => {
        expect(canManageCrm(['plan.view', 'crm.manage'])).toBe(true)
        expect(canManageCrm(['plan.view'])).toBe(false)
        expect(canManageCrm(null)).toBe(false)
    })
    it('detects crm.edit', () => {
        expect(canEditCrm(['crm.view', 'crm.edit'])).toBe(true)
        expect(canEditCrm(['crm.view'])).toBe(false)
        expect(canEditCrm([])).toBe(false)
        expect(canEditCrm(null)).toBe(false)
        expect(canEditCrm(undefined)).toBe(false)
    })
    it('detects crm.pins via canDropPin', () => {
        expect(canDropPin(['crm.view', 'crm.pins'])).toBe(true)
        expect(canDropPin(['crm.view'])).toBe(false)
        expect(canDropPin([])).toBe(false)
        expect(canDropPin(null)).toBe(false)
        expect(canDropPin(undefined)).toBe(false)
    })
})
