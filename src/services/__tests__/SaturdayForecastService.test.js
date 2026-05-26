/**
 * SaturdayForecastService rides on APIUtility — every method round-trips
 * through `/saturday-forecast-service/<action>` and asserts `success === true`
 * on the response. Mock APIUtility.post at the module level so the tests
 * never touch the network.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import APIUtility from '../../utils/APIUtility'
import { SaturdayForecastService } from '../SaturdayForecastService'

vi.mock('../../utils/APIUtility', () => ({
    __esModule: true,
    default: { post: vi.fn() }
}))

const okResponse = (body) => ({ json: { success: true, ...body }, res: { ok: true } })
const failResponse = (body = {}) => ({ json: { success: false, ...body }, res: { ok: false } })

describe('SaturdayForecastService', () => {
    afterEach(() => vi.clearAllMocks())

    describe('fetchPendingForUser', () => {
        it('returns the normalized payload on success', async () => {
            APIUtility.post.mockResolvedValue(
                okResponse({
                    pendingPlants: [{ plantCode: '101', plantName: 'North' }],
                    saturdayDate: '2026-05-30',
                    submittedPlants: [{ operatorCount: 3, plantCode: '202' }],
                    weekIso: '2026-W22'
                })
            )

            const result = await SaturdayForecastService.fetchPendingForUser()

            expect(APIUtility.post).toHaveBeenCalledWith('/saturday-forecast-service/fetch-pending-for-user', {})
            expect(result).toEqual({
                pendingPlants: [{ plantCode: '101', plantName: 'North' }],
                saturdayDate: '2026-05-30',
                submittedPlants: [{ operatorCount: 3, plantCode: '202' }],
                weekIso: '2026-W22'
            })
        })

        it('coerces missing arrays / strings to safe defaults', async () => {
            APIUtility.post.mockResolvedValue(okResponse({}))

            const result = await SaturdayForecastService.fetchPendingForUser()

            expect(result).toEqual({
                pendingPlants: [],
                saturdayDate: '',
                submittedPlants: [],
                weekIso: ''
            })
        })

        it('throws when the API surfaces an error', async () => {
            APIUtility.post.mockResolvedValue(failResponse({ error: 'session expired' }))

            await expect(SaturdayForecastService.fetchPendingForUser()).rejects.toThrow('session expired')
        })

        it('throws a generic message when the API fails silently', async () => {
            APIUtility.post.mockResolvedValue({ json: {}, res: { ok: false } })

            await expect(SaturdayForecastService.fetchPendingForUser()).rejects.toThrow(
                'Failed to fetch pending forecasts'
            )
        })
    })

    describe('fetchForWeek', () => {
        it('throws synchronously when saturdayDate is missing', async () => {
            await expect(SaturdayForecastService.fetchForWeek()).rejects.toThrow('saturdayDate is required')
            expect(APIUtility.post).not.toHaveBeenCalled()
        })

        it('posts without plantCodes when none are provided', async () => {
            APIUtility.post.mockResolvedValue(okResponse({ forecastsByPlant: { 101: { operatorCount: 4 } } }))

            const result = await SaturdayForecastService.fetchForWeek('2026-05-30')

            expect(APIUtility.post).toHaveBeenCalledWith('/saturday-forecast-service/fetch-for-week', {
                saturdayDate: '2026-05-30'
            })
            expect(result).toEqual({ 101: { operatorCount: 4 } })
        })

        it('forwards plantCodes when provided as a non-empty array', async () => {
            APIUtility.post.mockResolvedValue(okResponse({ forecastsByPlant: {} }))

            await SaturdayForecastService.fetchForWeek('2026-05-30', ['101', '202'])

            expect(APIUtility.post).toHaveBeenCalledWith('/saturday-forecast-service/fetch-for-week', {
                plantCodes: ['101', '202'],
                saturdayDate: '2026-05-30'
            })
        })

        it('omits plantCodes when it is an empty array', async () => {
            APIUtility.post.mockResolvedValue(okResponse({ forecastsByPlant: {} }))

            await SaturdayForecastService.fetchForWeek('2026-05-30', [])

            expect(APIUtility.post).toHaveBeenCalledWith('/saturday-forecast-service/fetch-for-week', {
                saturdayDate: '2026-05-30'
            })
        })

        it('returns an empty object when the API omits forecastsByPlant', async () => {
            APIUtility.post.mockResolvedValue(okResponse({}))

            const result = await SaturdayForecastService.fetchForWeek('2026-05-30')

            expect(result).toEqual({})
        })

        it('throws when the API responds with success:false', async () => {
            APIUtility.post.mockResolvedValue(failResponse({ error: 'forbidden' }))

            await expect(SaturdayForecastService.fetchForWeek('2026-05-30')).rejects.toThrow('forbidden')
        })
    })

    describe('submitForecast', () => {
        it('throws when plantCode is missing', async () => {
            await expect(SaturdayForecastService.submitForecast('', '2026-05-30', 5)).rejects.toThrow(
                'plantCode is required'
            )
            expect(APIUtility.post).not.toHaveBeenCalled()
        })

        it('throws when saturdayDate is missing', async () => {
            await expect(SaturdayForecastService.submitForecast('101', '', 5)).rejects.toThrow(
                'saturdayDate is required'
            )
            expect(APIUtility.post).not.toHaveBeenCalled()
        })

        it('throws when operatorCount is not a non-negative number', async () => {
            await expect(SaturdayForecastService.submitForecast('101', '2026-05-30', -1)).rejects.toThrow(
                'operatorCount must be a non-negative number'
            )
            await expect(SaturdayForecastService.submitForecast('101', '2026-05-30', 'nope')).rejects.toThrow(
                'operatorCount must be a non-negative number'
            )
            expect(APIUtility.post).not.toHaveBeenCalled()
        })

        it('coerces a numeric string and returns the forecast on success', async () => {
            const forecast = {
                operatorCount: 7,
                plantCode: '101',
                saturdayDate: '2026-05-30',
                submittedAt: '2026-05-26T15:00:00Z'
            }
            APIUtility.post.mockResolvedValue(okResponse({ forecast }))

            const result = await SaturdayForecastService.submitForecast('101', '2026-05-30', '7')

            expect(APIUtility.post).toHaveBeenCalledWith('/saturday-forecast-service/submit-forecast', {
                operatorCount: 7,
                plantCode: '101',
                saturdayDate: '2026-05-30'
            })
            expect(result).toEqual(forecast)
        })

        it('throws when the API rejects the submission', async () => {
            APIUtility.post.mockResolvedValue(failResponse({ error: 'not a manager of this plant' }))

            await expect(SaturdayForecastService.submitForecast('101', '2026-05-30', 5)).rejects.toThrow(
                'not a manager of this plant'
            )
        })
    })

    describe('submitBulk', () => {
        it('throws when saturdayDate is missing', async () => {
            await expect(
                SaturdayForecastService.submitBulk('', [{ operatorCount: 1, plantCode: '101' }])
            ).rejects.toThrow('saturdayDate is required')
            expect(APIUtility.post).not.toHaveBeenCalled()
        })

        it('throws when entries is not a non-empty array', async () => {
            await expect(SaturdayForecastService.submitBulk('2026-05-30', [])).rejects.toThrow(
                'entries must be a non-empty array'
            )
            await expect(SaturdayForecastService.submitBulk('2026-05-30', null)).rejects.toThrow(
                'entries must be a non-empty array'
            )
            expect(APIUtility.post).not.toHaveBeenCalled()
        })

        it('returns the saved count on success', async () => {
            APIUtility.post.mockResolvedValue(okResponse({ savedCount: 3 }))

            const entries = [
                { operatorCount: 1, plantCode: '101' },
                { operatorCount: 2, plantCode: '202' },
                { operatorCount: 3, plantCode: '303' }
            ]
            const result = await SaturdayForecastService.submitBulk('2026-05-30', entries)

            expect(APIUtility.post).toHaveBeenCalledWith('/saturday-forecast-service/submit-bulk', {
                entries,
                saturdayDate: '2026-05-30'
            })
            expect(result).toBe(3)
        })

        it('coerces a non-numeric savedCount to zero', async () => {
            APIUtility.post.mockResolvedValue(okResponse({ savedCount: 'oops' }))

            const result = await SaturdayForecastService.submitBulk('2026-05-30', [
                { operatorCount: 1, plantCode: '101' }
            ])

            expect(result).toBe(0)
        })

        it('throws when the bulk submit fails', async () => {
            APIUtility.post.mockResolvedValue(failResponse({ error: 'transaction rolled back' }))

            await expect(
                SaturdayForecastService.submitBulk('2026-05-30', [{ operatorCount: 1, plantCode: '101' }])
            ).rejects.toThrow('transaction rolled back')
        })
    })
})
