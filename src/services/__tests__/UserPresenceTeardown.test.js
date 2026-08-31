// The online-users list is reloaded on every presence change the realtime
// channel reports, so reads of `users_presence` keep arriving at a page that is
// already on its way out. A read started then is cancelled at the transport
// instead of answered, and a cancellation is indistinguishable from an outage
// by the time it reaches the error reporter. These tests pin every request the
// presence service makes to a document that is still there to receive it.

const presenceReads = []
const posts = []
const regionLookups = []

vi.mock('../DatabaseService', () => {
    const result = { data: [], error: null }
    const builder = {
        limit: () => Promise.resolve(result),
        or: () => builder,
        order: () => Promise.resolve(result),
        select: () => builder
    }
    return {
        Database: {
            channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
            from: (table) => {
                presenceReads.push(table)
                return builder
            },
            removeChannel: () => {}
        }
    }
})

vi.mock('../UserService', () => ({
    UserService: {
        getAllRoles: async () => [],
        getCurrentUser: async () => null,
        getUserDisplayName: async () => 'Someone',
        getUserProfile: async () => ({ plant_code: 'P1' }),
        getUserRoles: async () => [],
        getUserWeight: async () => 0
    }
}))

vi.mock('../PlantService', () => ({
    PlantService: {
        fetchRegionsByPlantCode: async (plantCode) => {
            regionLookups.push(plantCode)
            return []
        }
    }
}))

vi.mock('../../utils/APIUtility', () => ({
    SESSION_INVALID_EVENT: 'auth:session-invalid',
    default: {
        post: async (path) => {
            posts.push(path)
            return { json: {}, res: { ok: true, status: 200 } }
        }
    }
}))

let UserPresenceService

beforeAll(async () => {
    UserPresenceService = (await import('../UserPresenceService')).UserPresenceService
})

beforeEach(() => {
    presenceReads.length = 0
    posts.length = 0
    regionLookups.length = 0
    UserPresenceService.handlePageShow({ persisted: false })
    UserPresenceService.currentUserId = 'user-1'
    UserPresenceService.lastActivityUpdate = 0
    UserPresenceService._userMetaCache = {}
})

afterEach(() => {
    UserPresenceService._stopPollers()
})

describe('online-users reads around page teardown', () => {
    it('reads while the page is live', async () => {
        await UserPresenceService.refreshOnlineUsers(true)
        expect(presenceReads).toContain('users_presence')
    })

    it('makes no read once the page is going away', async () => {
        UserPresenceService.handlePageHide()
        await UserPresenceService.refreshOnlineUsers(true)
        expect(presenceReads).toEqual([])
    })

    it('reads again for a page the browser hands back', async () => {
        UserPresenceService.handlePageHide()
        UserPresenceService.handlePageShow({ persisted: true })
        await UserPresenceService.refreshOnlineUsers(true)
        expect(presenceReads).toContain('users_presence')
    })
})

describe('activity writes around page teardown', () => {
    it('writes for a click on a live page', () => {
        UserPresenceService.handleUserActivity()
        expect(posts).toContain('/user-presence-service/update-activity')
    })

    it('writes nothing for the click that takes the page away', () => {
        UserPresenceService.handlePageHide()
        UserPresenceService.handleUserActivity()
        expect(posts).toEqual([])
    })
})

describe('region lookups around page teardown', () => {
    it('resolves a region for a live page', async () => {
        await UserPresenceService._fetchAndCacheMeta('user-2')
        expect(regionLookups).toEqual(['P1'])
    })

    it('resolves nothing once the page is going away', async () => {
        UserPresenceService.handlePageHide()
        await UserPresenceService._fetchAndCacheMeta('user-2')
        expect(regionLookups).toEqual([])
    })
})
