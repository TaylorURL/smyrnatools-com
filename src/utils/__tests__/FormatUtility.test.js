import { FormatUtility } from '../FormatUtility'

describe('FormatUtility', () => {
    describe('truncateText', () => {
        it('returns full text when under maxLength', () => {
            expect(FormatUtility.truncateText('hello', 10)).toBe('hello')
        })

        it('truncates by character count and adds ellipsis', () => {
            expect(FormatUtility.truncateText('hello world', 5)).toBe('hello...')
        })

        it('truncates by word count when byWords is true', () => {
            expect(FormatUtility.truncateText('one two three four', 2, true)).toBe('one two...')
        })

        it('does not truncate by words when under limit', () => {
            expect(FormatUtility.truncateText('one two', 5, true)).toBe('one two')
        })

        it('returns empty string for falsy input', () => {
            expect(FormatUtility.truncateText('', 10)).toBe('')
            expect(FormatUtility.truncateText(null, 10)).toBe('')
            expect(FormatUtility.truncateText(undefined, 10)).toBe('')
        })

        it('handles exact-length text without truncation', () => {
            expect(FormatUtility.truncateText('12345', 5)).toBe('12345')
        })
    })
})
