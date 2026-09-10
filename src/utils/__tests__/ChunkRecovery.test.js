import { importChunk, recoverStaleDocument } from '../ChunkRecovery'

describe('recoverStaleDocument', () => {
    afterEach(() => {
        delete window.__recoverStaleShell
    })

    it('reports false when the shell is not on the page', () => {
        expect(recoverStaleDocument()).toBe(false)
    })

    it('reports what the shell answered', () => {
        window.__recoverStaleShell = () => true
        expect(recoverStaleDocument()).toBe(true)
        window.__recoverStaleShell = () => false
        expect(recoverStaleDocument()).toBe(false)
    })

    it('reports false when the shell throws', () => {
        window.__recoverStaleShell = () => {
            throw new Error('storage denied')
        }
        expect(recoverStaleDocument()).toBe(false)
    })
})

describe('importChunk', () => {
    afterEach(() => {
        delete window.__recoverStaleShell
    })

    it('passes a module that arrives straight through', async () => {
        await expect(importChunk(() => Promise.resolve({ value: 1 }))).resolves.toEqual({ value: 1 })
    })

    it('asks for the document once, rather than asking for the chunk again', async () => {
        let asked = 0
        let recoveries = 0
        window.__recoverStaleShell = () => {
            recoveries += 1
            return true
        }
        let settled = false
        importChunk(() => {
            asked += 1
            return Promise.reject(new Error('Failed to fetch dynamically imported module'))
        }).then(
            () => {
                settled = true
            },
            () => {
                settled = true
            }
        )
        await new Promise((resolve) => setTimeout(resolve, 10))
        expect(asked).toBe(1)
        expect(recoveries).toBe(1)
        // The document is being replaced, so nothing downstream is told the
        // chunk failed and no error screen is put in front of the reader.
        expect(settled).toBe(false)
    })

    it('passes the failure on when the shell declines, so the caller can answer it', async () => {
        window.__recoverStaleShell = () => false
        await expect(importChunk(() => Promise.reject(new Error('gone')))).rejects.toThrow('gone')
    })
})
