// The online-users list has no refresh button: it is only ever as current as
// the reads the realtime channel sets off. These tests pin the two ways a
// change could otherwise go missing — arriving while a read is already out,
// and an older read finishing after a newer one.

const pendingReads = []

vi.mock('../DatabaseService', () => {
    const builder = {
        limit: () => Promise.resolve({ data: [], error: null }),
        or: () => builder,
        order: () =>
            new Promise((resolve) => {
                pendingReads.push((rows) => resolve({ data: rows, error: null }))
            }),
        select: () => builder
    }
    return {
        Database: {
            channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
            from: () => builder,
            removeChannel: () => {}
        }
    }
})

vi.mock('../UserService', () => ({
    UserService: {
        getAllRoles: async () => [],
        getCurrentUser: async () => null,
        getUserDisplayName: async (id) => `Name ${id}`,
        getUserProfile: async () => null,
        getUserRoles: async () => [],
        getUserWeight: async () => 0
    }
}))

vi.mock('../PlantService', () => ({
    PlantService: {
        fetchRegionByCode: async () => null,
        fetchRegionsByPlantCode: async () => []
    }
}))

vi.mock('../../utils/APIUtility', () => ({
    SESSION_INVALID_EVENT: 'auth:session-invalid',
    default: { post: async () => ({ json: {}, res: { ok: true, status: 200 } }) }
}))

let UserPresenceService

const row = (id) => ({ is_online: true, last_activity: new Date().toISOString(), user_id: id })
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const shownIds = () => UserPresenceService.getOnlineUsers().map((u) => u.id)

beforeAll(async () => {
    UserPresenceService = (await import('../UserPresenceService')).UserPresenceService
})

beforeEach(() => {
    pendingReads.length = 0
    UserPresenceService.handlePageShow({ persisted: false })
    UserPresenceService.currentUserId = null
    UserPresenceService._userMetaCache = {}
    UserPresenceService._refreshing = false
    UserPresenceService._refreshQueued = false
    UserPresenceService.onlineUsers = []
})

describe('online-users list stays live', () => {
    it('reads again for a change that lands while a read is out', async () => {
        const first = UserPresenceService.refreshOnlineUsers()
        await flush()
        expect(pendingReads).toHaveLength(1)

        UserPresenceService.refreshOnlineUsers()
        expect(pendingReads).toHaveLength(1)

        pendingReads[0]([row('a')])
        await first
        await flush()
        expect(pendingReads).toHaveLength(2)

        pendingReads[1]([row('a'), row('b')])
        await flush()
        await flush()
        expect(shownIds()).toEqual(['a', 'b'])
    })

    it('keeps the newer list when an older read finishes last', async () => {
        const older = UserPresenceService.refreshOnlineUsers(true)
        await flush()
        const newer = UserPresenceService.refreshOnlineUsers(true)
        await flush()
        expect(pendingReads).toHaveLength(2)

        pendingReads[1]([row('a')])
        await newer
        pendingReads[0]([row('a'), row('gone')])
        await older

        expect(shownIds()).toEqual(['a'])
    })
})
