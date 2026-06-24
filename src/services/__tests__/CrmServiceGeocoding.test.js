import { beforeEach, describe, expect, it, vi } from 'vitest'

import APIUtility from '../../utils/APIUtility'
import CrmService from '../CrmService'

vi.mock('../../utils/APIUtility', () => ({ default: { post: vi.fn() } }))

const ok = (data) => ({ json: { data }, res: { ok: true } })
const fail = (error) => ({ json: { error }, res: { ok: false } })

describe('CrmService — geocodeAccounts', () => {
    beforeEach(() => vi.clearAllMocks())

    it('posts to geocode-accounts with the supplied limit', async () => {
        APIUtility.post.mockResolvedValue(ok({ failed: 1, geocoded: 5, remaining: 0 }))

        const result = await CrmService.geocodeAccounts({ limit: 10 })

        expect(APIUtility.post).toHaveBeenCalledWith('/call-list-service/geocode-accounts', { limit: 10 })
        expect(result).toEqual({ failed: 1, geocoded: 5, remaining: 0 })
    })

    it('uses the default limit of 15 when none is provided', async () => {
        APIUtility.post.mockResolvedValue(ok({ failed: 0, geocoded: 3, remaining: 0 }))

        await CrmService.geocodeAccounts()

        expect(APIUtility.post).toHaveBeenCalledWith('/call-list-service/geocode-accounts', { limit: 15 })
    })

    it('returns the data object from the response', async () => {
        const payload = { failed: 2, geocoded: 8, remaining: 4 }
        APIUtility.post.mockResolvedValue(ok(payload))

        const result = await CrmService.geocodeAccounts({ limit: 10 })

        expect(result).toEqual(payload)
    })

    it('throws when the response is not ok', async () => {
        APIUtility.post.mockResolvedValue(fail('Failed to geocode accounts'))

        await expect(CrmService.geocodeAccounts()).rejects.toThrow('Failed to geocode accounts')
    })
})
