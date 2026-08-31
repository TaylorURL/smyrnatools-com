// The realtime socket asks the client for a token every time it connects, and
// the answer becomes the credential behind every channel on it. Anything but
// the session JWT there — the anon key above all, which RLS grants nothing —
// leaves every postgres_changes subscription refused for the life of the page.
// These tests pin the token the socket ends up holding on the real client.

const SESSION_JWT = 'session-jwt'
const ANON_KEY = 'test-anon-key'

vi.mock('../SessionService', () => ({
    ensureFreshJwt: async () => SESSION_JWT,
    getSessionJwt: () => SESSION_JWT,
    refreshRejectedJwt: async () => SESSION_JWT,
    registerRealtimeAuthApplier: () => {}
}))

let Database

beforeAll(async () => {
    vi.stubEnv('REACT_APP_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('REACT_APP_SUPABASE_ANON_KEY', ANON_KEY)
    Database = (await import('../DatabaseService')).Database
})

afterAll(() => vi.unstubAllEnvs())

describe('realtime authentication', () => {
    it('answers the socket with the session JWT', async () => {
        expect(await Database.realtime.accessToken()).toBe(SESSION_JWT)
    })

    it('keeps the session JWT when the socket re-reads the token on connect', async () => {
        await Database.realtime.setAuth(SESSION_JWT)
        // What RealtimeClient.connect does before it opens the socket.
        await Database.realtime.setAuth()
        expect(Database.realtime.accessTokenValue).toBe(SESSION_JWT)
    })
})
