import { HistoryUtility } from '../HistoryUtility'

describe('HistoryUtility', () => {
    describe('resolveItemName', () => {
        it('titles equipment by its identifying number', () => {
            expect(HistoryUtility.resolveItemName('equipment', { identifyingNumber: 'LDR-10' })).toBe('LDR-10')
        })

        it('titles a trailer by its trailer number', () => {
            expect(HistoryUtility.resolveItemName('trailer', { trailerNumber: '512' })).toBe('Trailer #512')
        })

        it('titles mixers and tractors by truck number', () => {
            expect(HistoryUtility.resolveItemName('mixer', { truckNumber: '2208' })).toBe('Truck #2208')
            expect(HistoryUtility.resolveItemName('tractor', { truckNumber: '41' })).toBe('Truck #41')
        })

        it('titles an operator by name', () => {
            expect(HistoryUtility.resolveItemName('operator', { name: 'Jordan Reyes' })).toBe('Jordan Reyes')
        })

        it('falls back to "Item" when the record carries nothing to title it by', () => {
            expect(HistoryUtility.resolveItemName('equipment', {})).toBe('Item')
            expect(HistoryUtility.resolveItemName('trailer', {})).toBe('Item')
        })
    })
})
