// A heartbeat carries nothing but the moment it was sent, so a stalled one is
// worth less than the tick behind it. These tests pin the request policy that
// keeps a slow connection from stacking pings for the same user.

import { HEARTBEAT_INTERVAL_MS } from '../../utils/UserPresenceUtility'

const posts = []

vi.mock('../DatabaseService', () => ({
    Database: {
        channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
        from: () => ({ limit: () => Promise.resolve({ data: [], error: null }), select: () => ({}) }),
        removeChannel: () => {}
    }
}))

vi.mock('../UserService', () => ({ UserService: { getAllRoles: async () => [], getCurrentUser: async () => null } }))

vi.mock('../PlantService', () => ({ PlantService: {} }))

vi.mock('../../utils/APIUtility', () => ({
    SESSION_INVALID_EVENT: 'auth:session-invalid',
    default: {
        post: async (path, body, options) => {
            posts.push({ body, options, path })
            return { json: {}, res: { ok: true, status: 200 } }
        }
    }
}))

let UserPresenceService

beforeAll(async () => {
    UserPresenceService = (await import('../UserPresenceService')).UserPresenceService
})

beforeEach(() => {
    posts.length = 0
    UserPresenceService.currentUserId = 'user-1'
})

describe('heartbeat request policy', () => {
    it('abandons a stalled ping inside its own interval', async () => {
        await UserPresenceService.updateHeartbeat()
        expect(posts).toHaveLength(1)
        expect(posts[0].options.timeout).toBeLessThan(HEARTBEAT_INTERVAL_MS)
    })

    it('does not retry', async () => {
        await UserPresenceService.updateHeartbeat()
        expect(posts[0].options.maxRetries).toBe(0)
    })

    it('sends the ping with keepalive so an unload cannot cut it short', async () => {
        await UserPresenceService.updateHeartbeat()
        expect(posts[0].options.keepalive).toBe(true)
    })
})
