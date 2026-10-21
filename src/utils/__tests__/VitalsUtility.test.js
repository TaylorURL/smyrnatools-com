import { afterEach, describe, expect, it, vi } from 'vitest'

// The library arrives as its own chunk, so a document a deploy has replaced
// reaches for a name that is gone and the import rejects.
vi.mock('web-vitals', () => {
    throw new TypeError('Failed to fetch dynamically imported module: /assets/web-vitals-4coL430X.js')
})

const { default: vitalsUtility } = await import('../VitalsUtility')

describe('vitalsUtility', () => {
    const escaped = []
    const collect = (reason) => escaped.push(reason)

    afterEach(() => {
        process.off('unhandledRejection', collect)
        escaped.length = 0
    })

    it('ends a missing library chunk where it happened rather than letting it escape', async () => {
        process.on('unhandledRejection', collect)
        vitalsUtility(() => {})
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(escaped).toEqual([])
    })
})
