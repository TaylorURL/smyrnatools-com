// A token PostgREST refuses is replaced once, and the record of that one
// attempt is what stops a dropped session minting a token per query. The
// record only means anything when the server actually answered: a mint
// cancelled by a navigation or lost on a flaky connection says nothing about
// the token, and retiring it on one of those left the page holding a
// credential every query was refused for and nothing willing to replace it.
// These tests pin which failures retire a token and which leave it retryable.

const SERVER_REFUSED = { reachedServer: true, refreshed: false }
const NEVER_ARRIVED = { reachedServer: false, refreshed: false }

let session

beforeEach(async () => {
    // Nothing on this path waits on a timer; the clock is faked only so the
    // cooldown can be stepped over without the test sleeping through it.
    vi.useFakeTimers()
    vi.resetModules()
    session = await import('../SessionService')
})

afterEach(() => {
    vi.useRealTimers()
})

const signIn = (jwt) => {
    // An hour of life left, so the clock-driven refresh has no reason to run
    // and this path is the token's only chance of being replaced.
    session.updateSession({ expiresAt: Date.now() + 60 * 60 * 1000, jwt, userId: 'user-1' })
}

describe('replacing a refused JWT', () => {
    it('retires the token when the server answered the mint', async () => {
        const attempts = []
        session.registerJwtRefresher(async () => {
            attempts.push('mint')
            return SERVER_REFUSED
        })
        signIn('dead-jwt')

        await session.refreshRejectedJwt('dead-jwt')
        await session.refreshRejectedJwt('dead-jwt')

        expect(attempts).toHaveLength(1)
    })

    it('keeps the token retryable when the mint never reached the server', async () => {
        const answers = [NEVER_ARRIVED, { reachedServer: true, refreshed: true }]
        const attempts = []
        session.registerJwtRefresher(async () => {
            attempts.push('mint')
            const answer = answers.shift()
            if (answer.refreshed) session.updateSession({ expiresAt: Date.now() + 3600_000, jwt: 'fresh-jwt' })
            return answer
        })
        signIn('dead-jwt')

        expect(await session.refreshRejectedJwt('dead-jwt')).toBe('dead-jwt')
        // Past the cooldown an unreachable mint bought, the same token gets
        // another attempt — the one the old code spent on the failure.
        vi.setSystemTime(Date.now() + 6_000)
        expect(await session.refreshRejectedJwt('dead-jwt')).toBe('fresh-jwt')
        expect(attempts).toHaveLength(2)
    })

    it('waits out a cooldown before retrying an unreachable mint', async () => {
        const attempts = []
        session.registerJwtRefresher(async () => {
            attempts.push('mint')
            return NEVER_ARRIVED
        })
        signIn('dead-jwt')

        await session.refreshRejectedJwt('dead-jwt')
        // What a page does while the connection is down: every query reaches
        // here, and none of them is worth a mint of its own.
        await session.refreshRejectedJwt('dead-jwt')
        await session.refreshRejectedJwt('dead-jwt')

        expect(attempts).toHaveLength(1)
    })

    it('treats a refresher that throws as a mint that never arrived', async () => {
        const attempts = []
        session.registerJwtRefresher(async () => {
            attempts.push('mint')
            throw new Error('Failed to fetch')
        })
        signIn('dead-jwt')

        await session.refreshRejectedJwt('dead-jwt')
        vi.setSystemTime(Date.now() + 6_000)
        await session.refreshRejectedJwt('dead-jwt')

        expect(attempts).toHaveLength(2)
    })

    it('spends no mint on a token the caller no longer holds', async () => {
        const attempts = []
        session.registerJwtRefresher(async () => {
            attempts.push('mint')
            return SERVER_REFUSED
        })
        signIn('current-jwt')

        expect(await session.refreshRejectedJwt('some-older-jwt')).toBe('current-jwt')
        expect(attempts).toHaveLength(0)
    })
})

describe('the refresher contract', () => {
    it('reads a refresher answering nothing as a mint that never arrived', async () => {
        const attempts = []
        session.registerJwtRefresher(async () => {
            attempts.push('mint')
        })
        signIn('dead-jwt')

        await session.refreshRejectedJwt('dead-jwt')
        vi.setSystemTime(Date.now() + 6_000)
        await session.refreshRejectedJwt('dead-jwt')

        expect(attempts).toHaveLength(2)
    })
})
