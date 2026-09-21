// The online-users list is reloaded on every presence change the realtime
// channel reports, so reads of `users_presence` keep arriving at a page that is
// already on its way out. A read started then is cancelled at the transport
// instead of answered, and a cancellation is indistinguishable from an outage
// by the time it reaches the error reporter. These tests pin every request the
// presence service makes to a document that is still there to receive it.

const presenceReads = []
const posts = []
const postOptions = []
const regionLookups = []
const okResponse = { json: {}, res: { ok: true, status: 200 } }
// What APIUtility hands back for a request that never reached the network: it
// resolves rather than rejecting, so a transport failure arrives here as a
// response that is simply not ok.
const transportFailure = { json: { error: 'Failed to fetch' }, res: { ok: false, status: 0 } }
const unreachable = new Set()

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
        post: async (path, body, options) => {
            posts.push(path)
            postOptions.push({ options, path })
            return [...unreachable].some((suffix) => path.endsWith(suffix)) ? transportFailure : okResponse
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
    postOptions.length = 0
    regionLookups.length = 0
    unreachable.clear()
    UserPresenceService.handlePageShow({ persisted: false })
    UserPresenceService.currentUserId = 'user-1'
    UserPresenceService.lastActivityUpdate = 0
    UserPresenceService.lastLoginDateWritten = null
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

    it('writes nothing for a click that arrives once the teardown is under way', () => {
        UserPresenceService.handlePageHide()
        UserPresenceService.handleUserActivity()
        expect(posts).toEqual([])
    })

    // The click that takes the page away reaches this handler before the
    // browser starts the navigation, so the write is made whatever the flag
    // says and the transport is the only thing standing between it and a
    // cancellation. `keepalive` is what carries it across the teardown.
    it('sends the activity write on a transport the teardown cannot cancel', async () => {
        await UserPresenceService.updateActivity()
        const activity = postOptions.find((call) => call.path.endsWith('/update-activity'))
        expect(activity.options).toMatchObject({ keepalive: true, maxRetries: 0 })
    })

    it('sends the device merge the same way', async () => {
        await UserPresenceService.updateActivity()
        await Promise.resolve()
        const merge = postOptions.find((call) => call.path.endsWith('/merge-device'))
        expect(merge.options).toMatchObject({ keepalive: true, maxRetries: 0 })
    })
})

describe('the day of the last login', () => {
    it('writes it once the activity stamp lands', async () => {
        await UserPresenceService.updateActivity()
        expect(posts).toContain('/user-presence-service/update-last-login')
    })

    it('writes it again after an attempt that did not reach the network', async () => {
        unreachable.add('/update-last-login')
        await UserPresenceService.updateActivity()
        unreachable.clear()
        posts.length = 0
        await UserPresenceService.updateActivity()
        expect(posts).toContain('/user-presence-service/update-last-login')
    })

    it('writes it once for a day it has already recorded', async () => {
        await UserPresenceService.updateActivity()
        posts.length = 0
        await UserPresenceService.updateActivity()
        expect(posts).not.toContain('/user-presence-service/update-last-login')
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
