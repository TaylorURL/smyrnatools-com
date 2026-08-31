import APIUtility, { SESSION_INVALID_EVENT } from '../utils/APIUtility'
import { detectDeviceType } from '../utils/DeviceUtility'
import {
    ACTIVITY_THROTTLE_MS,
    buildRoleColorMap,
    CLEANUP_INTERVAL_MS,
    extractRegionCode,
    extractRoleNames,
    getActiveDevices,
    HEARTBEAT_INTERVAL_MS,
    HEARTBEAT_TIMEOUT_MS,
    STALE_THRESHOLD
} from '../utils/UserPresenceUtility'
import { Database } from './DatabaseService'
import { PlantService } from './PlantService'
import { UserService } from './UserService'

const PRESENCE_FUNCTION = '/user-presence-service'

/**
 * POSTs to one presence endpoint and reports whether the write landed.
 *
 * Returns false without making the request while the browser reports no
 * connection. Presence writes are background traffic on a timer, so one sent
 * with the network down can only fail at the transport layer, and the next
 * tick after the connection returns carries the same state.
 */
async function postPresence(endpoint, body = {}, options) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
    const { res } = await APIUtility.post(`${PRESENCE_FUNCTION}${endpoint}`, body, options)
    return res.ok
}

let _hasActiveDevicesCol = null
/** Probes once whether `users_presence` has the `active_devices` column and
 *  caches the answer; device tracking degrades to a no-op where the column
 *  is absent. */
async function checkActiveDevicesCol() {
    if (_hasActiveDevicesCol !== null) return _hasActiveDevicesCol
    try {
        const { error } = await Database.from('users_presence').select('active_devices').limit(0)
        _hasActiveDevicesCol = !error
    } catch (err) {
        console.error('Failed to check active_devices column:', err)
        _hasActiveDevicesCol = false
    }
    return _hasActiveDevicesCol
}

async function mergeActiveDevice(userId, device) {
    const hasCol = await checkActiveDevicesCol()
    if (!hasCol) return
    try {
        await postPresence('/merge-device', { device, userId })
    } catch (err) {
        console.error('Failed to merge active device:', err)
    }
}

/**
 * Unified presence service combining write-side tracking (heartbeats, activity,
 * online/offline status) with read-side online-users list (fetching, caching,
 * role colors, region names).
 */
class UserPresenceService {
    constructor() {
        /* ── Write-side (presence tracking) state ── */
        this.listeners = []
        this.subscriptions = []
        this.isSetup = false
        // True from `pagehide` until a `pageshow` hands the document back: the
        // page is either being torn down or frozen into the back/forward cache,
        // so a request started now cannot finish, and there is nothing left on
        // screen for it to answer.
        this.pageIsGoingAway = false
        this.currentUserId = null
        this.heartbeatInterval = null
        this.cleanupInterval = null
        this.activityRefreshInterval = null
        this.lastActivityUpdate = 0
        this.lastLoginDateWritten = null
        this.onPresenceChange = this.handlePresenceChange.bind(this)
        this.onBeforeUnload = this.handleBeforeUnload.bind(this)
        this.onPageHide = this.handlePageHide.bind(this)
        this.onPageShow = this.handlePageShow.bind(this)
        this.onOnline = this.handleOnlineStatusChange.bind(this, true)
        this.onOffline = this.handleOnlineStatusChange.bind(this, false)
        this.onUserActivity = this.handleUserActivity.bind(this)
        this.onSessionEnd = this.cleanup.bind(this)

        /* ── Read-side (online users list) state ── */
        this.onlineUsers = []
        this.regionNames = {}
        this.roleColorMap = {}
        this.onlineUsersListeners = []
        this.isOnlineUsersInitialized = false
        this.isOnlineUsersLoading = true
        this._refreshing = false
        this._userMetaCache = {}
    }

    /* ════════════════════════════════════════════════════════════════════
     *  Write-side: presence tracking
     * ════════════════════════════════════════════════════════════════════ */

    async setup() {
        if (this.isSetup) return true
        // Promise lock: concurrent callers (e.g. React StrictMode double-invoke)
        // share the same in-flight setup so we never subscribe the realtime
        // channel twice, which would throw "cannot add postgres_changes
        // callbacks after subscribe()".
        if (this._setupPromise) return this._setupPromise
        this._setupPromise = (async () => {
            try {
                const user = await UserService.getCurrentUser()
                if (!user?.id) return false
                this.currentUserId = user.id
                const subscription = Database.channel('presence_changes')
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'users_presence'
                        },
                        this.onPresenceChange
                    )
                    .subscribe()
                this.subscriptions.push(subscription)
                await this.setUserOnline(this.currentUserId)
                this._startPollers()
                this.setupActivityTracking()
                window.addEventListener('beforeunload', this.onBeforeUnload)
                window.addEventListener('pagehide', this.onPageHide)
                window.addEventListener('pageshow', this.onPageShow)
                window.addEventListener('online', this.onOnline)
                window.addEventListener('offline', this.onOffline)
                // Presence describes a signed-in user, so it ends when the
                // session does. Without this the pollers outlive sign-out and
                // keep reading `users_presence` for a user who is gone.
                window.addEventListener('authSignOut', this.onSessionEnd)
                window.addEventListener(SESSION_INVALID_EVENT, this.onSessionEnd)
                this.isSetup = true
                return true
            } catch (err) {
                console.error('Failed to setup presence tracking:', err)
                return false
            } finally {
                this._setupPromise = null
            }
        })()
        return this._setupPromise
    }

    setupActivityTracking() {
        document.addEventListener('click', this.onUserActivity)
        document.addEventListener('keydown', this.onUserActivity)
        document.addEventListener('mousemove', this.onUserActivity, { passive: true })
    }

    handlePresenceChange() {
        this.notifyListeners()
    }

    /**
     * Refreshes the activity stamp, at most once per throttle window.
     *
     * The activity listeners sit on the document rather than on a timer, so
     * stopping the pollers does not stop them: a click or a keypress that starts
     * a navigation fires here first, and the last event a page receives is
     * routinely the one that takes the page away. The write that event would
     * send is cancelled part-way through, and it carries nothing the next page's
     * own set-online write does not, so it is dropped rather than sent.
     */
    handleUserActivity() {
        if (this.pageIsGoingAway) return
        const now = Date.now()
        if (now - this.lastActivityUpdate < ACTIVITY_THROTTLE_MS) return
        this.lastActivityUpdate = now
        this.updateActivity()
    }

    async updateActivity() {
        if (!this.currentUserId) return false
        try {
            if (!(await postPresence('/update-activity', { userId: this.currentUserId }))) return false
            mergeActiveDevice(this.currentUserId, detectDeviceType())
            const today = new Date().toISOString().split('T')[0]
            if (this.lastLoginDateWritten !== today) {
                this.lastLoginDateWritten = today
                try {
                    await postPresence('/update-last-login', {
                        date: today,
                        userId: this.currentUserId
                    })
                } catch (err) {
                    console.error('Failed to update last_login_at:', err)
                }
            }
            return true
        } catch (err) {
            console.error('Failed to update activity:', err)
            return false
        }
    }

    startActivityRefresh() {
        this._clearInterval('activityRefreshInterval')
        this.activityRefreshInterval = setInterval(() => {
            this.notifyListeners()
        }, CLEANUP_INTERVAL_MS)
    }

    /**
     * Starts every background poller.
     *
     * The heartbeat, the stale sweep and the activity refresh all describe one
     * thing — a live page belonging to a signed-in user — so they run and stop
     * as a set. Going through this pair is what keeps that true: a teardown
     * path that named the pollers one by one would leave any it forgot ticking
     * against a page that is already unloading, offline, or signed out, and
     * every such tick is a request the transport cannot carry.
     */
    _startPollers() {
        this.startHeartbeat()
        this.startCleanup()
        this.startActivityRefresh()
    }

    _stopPollers() {
        this._clearInterval('heartbeatInterval')
        this._clearInterval('cleanupInterval')
        this._clearInterval('activityRefreshInterval')
    }

    async setUserOnline(userId) {
        if (!userId) return false
        try {
            if (!(await postPresence('/set-online', { userId }))) return false
            mergeActiveDevice(userId, detectDeviceType())
            return true
        } catch (err) {
            console.error('Failed to set user online:', err)
            return false
        }
    }

    async setUserOffline(userId) {
        if (!userId) return false
        try {
            return await postPresence('/set-offline', { userId })
        } catch (err) {
            console.error('Failed to set user offline:', err)
            return false
        }
    }

    /**
     * Refreshes this user's `last_seen` stamp.
     *
     * Sent with `keepalive` because a tick landing in the moment the page goes
     * away is otherwise cancelled part-way through: the interval fires every
     * thirty seconds against a page that can be closed at any point in that
     * window, and stopping the pollers on `pagehide` cannot recall a request
     * already on the wire. The write is safe to let through either way — it
     * touches only `last_seen`, never `is_online`, so one that lands behind
     * the set-offline write cannot put the user back on the online list.
     *
     * A ping that stalls is abandoned rather than retried, and abandoned inside
     * its own interval. The tick carries nothing but the moment it was sent, so
     * a retry re-sends a stamp the next tick is about to replace anyway, and one
     * held open for a full interval leaves two pings racing for the same row —
     * on a connection slow enough to stall repeatedly, more with every tick. The
     * server marks a user offline only after two minutes without a heartbeat, so
     * a dropped ping costs nothing that the next few do not restore.
     */
    async updateHeartbeat() {
        if (!this.currentUserId) return false
        try {
            return await postPresence(
                '/heartbeat',
                { userId: this.currentUserId },
                { keepalive: true, maxRetries: 0, timeout: HEARTBEAT_TIMEOUT_MS }
            )
        } catch (err) {
            console.error('Failed to update heartbeat:', err)
            return false
        }
    }

    startHeartbeat() {
        this._clearInterval('heartbeatInterval')
        this.heartbeatInterval = setInterval(() => this.updateHeartbeat(), HEARTBEAT_INTERVAL_MS)
    }

    startCleanup() {
        this._clearInterval('cleanupInterval')
        this.cleanupInterval = setInterval(async () => {
            try {
                if (!(await postPresence('/cleanup', {}))) return
                this.notifyListeners()
            } catch (err) {
                console.error('Failed to clean up stale presence records:', err)
            }
        }, CLEANUP_INTERVAL_MS)
    }

    /**
     * Marks the user offline as the page is torn down.
     *
     * This is the only write the app makes exclusively at unload, and that is
     * what makes a beacon the right transport for it. Every other presence
     * endpoint is called often enough to keep its CORS preflight warm; this one
     * never is, so a `fetch` here has to negotiate a preflight in the moment the
     * document is being destroyed, and `keepalive` does not carry that
     * negotiation across. A beacon needs no preflight at all. The fetch remains
     * behind it for browsers with no `sendBeacon` and for a beacon the browser
     * declines to queue.
     */
    handleBeforeUnload() {
        if (!this.currentUserId) return
        if (APIUtility.beacon(`${PRESENCE_FUNCTION}/set-offline`, { userId: this.currentUserId })) return
        postPresence('/set-offline', { userId: this.currentUserId }, { keepalive: true, maxRetries: 0 }).catch((err) =>
            console.error('Failed to set offline on beforeunload:', err)
        )
    }

    /**
     * Stops the page's background traffic as it goes away, whether it is being
     * torn down or put into the back/forward cache. A plain interval request
     * that starts while the page is unloading is cancelled by the browser
     * part-way through, so the tick is dropped rather than sent; the set-offline
     * write in `handleBeforeUnload` carries `keepalive` and survives the unload.
     *
     * Stopping the pollers only accounts for the requests a timer starts. The
     * online-users list is reloaded again on every presence change the realtime
     * channel reports, and that channel stays subscribed through the unload, so
     * the flag is what holds those reads back as well.
     */
    handlePageHide() {
        this.pageIsGoingAway = true
        this._stopPollers()
    }

    /**
     * Puts a page the browser has handed back to work again.
     *
     * The document is running either way, so the flag is cleared for any
     * `pageshow`; the pollers are restarted only for a back/forward-cache
     * restore, which resumes a document whose timers were cleared on the way
     * in.
     */
    handlePageShow(event) {
        this.pageIsGoingAway = false
        if (!event?.persisted || !this.currentUserId) return
        this._startPollers()
    }

    /**
     * Follows the browser's connection state. Both pollers stop while the
     * connection is down, since every tick they take then is a request the
     * transport cannot carry; the server's own stale sweep is what marks a
     * disconnected user offline, which is why nothing is written on the way
     * out.
     */
    handleOnlineStatusChange(isOnline) {
        if (!this.currentUserId) return
        if (isOnline) {
            this.setUserOnline(this.currentUserId)
            this._startPollers()
        } else {
            this._stopPollers()
        }
    }

    async getOnlineCount() {
        try {
            const { count, error } = await Database.from('users_presence')
                .select('user_id', { count: 'exact', head: true })
                .eq('is_online', true)
            if (error) return 0
            return count || 0
        } catch (err) {
            console.error('Failed to get online count:', err)
            return 0
        }
    }

    /** Presence-change listeners (write side) */
    addListener(callback) {
        if (typeof callback === 'function') this.listeners.push(callback)
    }

    removeListener(callback) {
        this.listeners = this.listeners.filter((listener) => listener !== callback)
    }

    notifyListeners() {
        this.listeners.forEach((listener) => {
            try {
                listener()
            } catch (err) {
                console.error('Presence listener threw:', err)
            }
        })
    }

    _clearInterval(name) {
        if (this[name]) {
            clearInterval(this[name])
            this[name] = null
        }
    }

    cleanup() {
        this._stopPollers()
        document.removeEventListener('click', this.onUserActivity)
        document.removeEventListener('keydown', this.onUserActivity)
        document.removeEventListener('mousemove', this.onUserActivity)
        window.removeEventListener('beforeunload', this.onBeforeUnload)
        window.removeEventListener('pagehide', this.onPageHide)
        window.removeEventListener('pageshow', this.onPageShow)
        window.removeEventListener('online', this.onOnline)
        window.removeEventListener('offline', this.onOffline)
        window.removeEventListener('authSignOut', this.onSessionEnd)
        window.removeEventListener(SESSION_INVALID_EVENT, this.onSessionEnd)
        for (const sub of this.subscriptions) {
            try {
                Database.removeChannel(sub)
            } catch (err) {
                console.error('Failed to remove presence channel:', err)
            }
        }
        this.subscriptions = []
        this.listeners = []
        this.onlineUsersListeners = []
        this.isSetup = false
        this.currentUserId = null
        // Cleared so a later sign-in runs the full read-side init again
        // instead of taking the early return and leaving the list empty.
        this.isOnlineUsersInitialized = false
        this.isOnlineUsersLoading = true
        this.onlineUsers = []
        this._userMetaCache = {}
    }

    /* ════════════════════════════════════════════════════════════════════
     *  Read-side: online users list
     * ════════════════════════════════════════════════════════════════════ */

    async initOnlineUsers() {
        if (this.isOnlineUsersInitialized) return
        this.isOnlineUsersInitialized = true
        try {
            const [currentUser, allRoles] = await Promise.all([
                UserService.getCurrentUser(),
                UserService.getAllRoles().catch(() => [])
            ])
            this.currentUserId = currentUser?.id || null
            this.roleColorMap = buildRoleColorMap(allRoles)
        } catch (err) {
            console.error('Failed to initialize online users metadata:', err)
        }
        await this.refreshOnlineUsers(true)
        this.addListener(() => this.refreshOnlineUsers())
    }

    /**
     * Reloads the online-users list from `users_presence`.
     *
     * Skips the read while the browser reports no connection, on the same
     * reasoning as the presence writes: this runs on a timer, a read taken
     * with the transport down can only fail at that layer, and the next tick
     * returns the same rows. The cached list stays on screen rather than
     * being replaced by an error state.
     *
     * Dropped outright once the page is going away. Every presence change on
     * the fleet reaches this through the realtime channel, so reads arrive here
     * far more often than the timer alone would bring them, and one started
     * against a document the browser is tearing down is cancelled at the
     * transport rather than answered.
     */
    async refreshOnlineUsers(force = false) {
        if (this.pageIsGoingAway) return
        if (this._refreshing && !force) return
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            this.isOnlineUsersLoading = false
            this._notifyOnlineUsersListeners()
            return
        }
        this._refreshing = true
        try {
            const fiveMinutesAgo = new Date(Date.now() - STALE_THRESHOLD).toISOString()
            const hasDevicesCol = await checkActiveDevicesCol()
            const cols = hasDevicesCol
                ? 'user_id, last_seen, last_activity, is_online, active_devices'
                : 'user_id, last_seen, last_activity, is_online'
            const { data: presences, error } = await Database.from('users_presence')
                .select(cols)
                .or(`is_online.eq.true,last_activity.gte.${fiveMinutesAgo}`)
                .order('last_activity', { ascending: false })
            if (error) {
                this.isOnlineUsersLoading = false
                this._notifyOnlineUsersListeners()
                return
            }
            let presenceList = presences || []
            if (this.currentUserId && !presenceList.some((p) => p.user_id === this.currentUserId)) {
                presenceList = [
                    ...presenceList,
                    {
                        active_devices: { [detectDeviceType()]: new Date().toISOString() },
                        is_online: true,
                        last_activity: new Date().toISOString(),
                        last_seen: new Date().toISOString(),
                        user_id: this.currentUserId
                    }
                ]
            }
            const uncached = presenceList.filter((p) => !this._userMetaCache[p.user_id])
            if (uncached.length > 0) {
                await Promise.all(uncached.map((p) => this._fetchAndCacheMeta(p.user_id)))
            }
            this.onlineUsers = presenceList
                .map((p) => {
                    const meta = this._userMetaCache[p.user_id] || {}
                    const isSelf = p.user_id === this.currentUserId
                    return {
                        activeDevices: getActiveDevices(p.active_devices, isSelf),
                        id: p.user_id,
                        isCurrentUser: isSelf,
                        lastActivity: p.last_activity,
                        lastSeen: p.last_seen,
                        name: meta.name || 'Unknown User',
                        regionCode: meta.regionCode || null,
                        roleWeight: meta.roleWeight || 0,
                        roles: meta.roles || []
                    }
                })
                .sort((a, b) => (b.roleWeight || 0) - (a.roleWeight || 0))
            this.isOnlineUsersLoading = false
            await this._resolveRegionNames(this.onlineUsers)
            this._notifyOnlineUsersListeners()
        } catch (err) {
            console.error('Failed to refresh online users:', err)
            this.isOnlineUsersLoading = false
            this._notifyOnlineUsersListeners()
        } finally {
            this._refreshing = false
        }
    }

    /**
     * Fills the metadata cache for one presence row — name, roles, weight, and
     * the region its plant sits in.
     *
     * Checked against the page state here as well as in the refresh that calls
     * it, because a batch of these runs behind several awaits: the refresh reads
     * the flag once, at a point that can be a whole round trip before the region
     * lookup at the end of this method goes out. Reading it again is what keeps
     * the last request of a refresh from leaving on a document the browser has
     * already begun tearing down.
     */
    async _fetchAndCacheMeta(userId) {
        if (this.pageIsGoingAway) return
        try {
            const [name, rolesData, profile, roleWeight] = await Promise.all([
                UserService.getUserDisplayName(userId),
                UserService.getUserRoles(userId),
                UserService.getUserProfile(userId).catch(() => null),
                UserService.getUserWeight(userId).catch(() => 0)
            ])
            let regionCode = extractRegionCode(profile)
            if (!regionCode && profile?.plant_code && !this.pageIsGoingAway) {
                try {
                    const regions = await PlantService.fetchRegionsByPlantCode(profile.plant_code)
                    if (regions?.length > 0) regionCode = regions[0].regionCode || regions[0].region_code
                } catch (err) {
                    console.error(`Failed to resolve region for plant ${profile.plant_code}:`, err)
                }
            }
            this._userMetaCache[userId] = {
                name,
                regionCode,
                roleWeight: roleWeight || 0,
                roles: extractRoleNames(rolesData)
            }
        } catch (err) {
            console.error(`Failed to fetch metadata for user ${userId}:`, err)
            this._userMetaCache[userId] = { name: 'Unknown User', regionCode: null, roleWeight: 0, roles: [] }
        }
    }

    async _resolveRegionNames(users) {
        const codes = [...new Set(users.map((u) => u.regionCode).filter(Boolean))]
        let changed = false
        for (const code of codes) {
            if (this.pageIsGoingAway) break
            if (this.regionNames[code]) continue
            try {
                const region = await PlantService.fetchRegionByCode(code)
                this.regionNames[code] = region?.regionName || region?.region_name || code
            } catch (err) {
                console.error(`Failed to resolve region name for ${code}:`, err)
                this.regionNames[code] = code
            }
            changed = true
        }
        if (changed) this._notifyOnlineUsersListeners()
    }

    getOnlineUsers() {
        return this.onlineUsers
    }

    getRegionNames() {
        return this.regionNames
    }

    getRoleColorMap() {
        return this.roleColorMap
    }

    getIsLoading() {
        return this.isOnlineUsersLoading
    }

    /** Online-users-list listeners (read side) */
    addOnlineUsersListener(callback) {
        if (typeof callback === 'function') this.onlineUsersListeners.push(callback)
    }

    removeOnlineUsersListener(callback) {
        this.onlineUsersListeners = this.onlineUsersListeners.filter((listener) => listener !== callback)
    }

    _notifyOnlineUsersListeners() {
        const snapshot = {
            isLoading: this.isOnlineUsersLoading,
            regionNames: this.regionNames,
            roleColorMap: this.roleColorMap,
            users: this.onlineUsers
        }
        this.onlineUsersListeners.forEach((callback) => {
            try {
                callback(snapshot)
            } catch (err) {
                console.error('Online users listener threw:', err)
            }
        })
    }
}

const instance = new UserPresenceService()
export { instance as UserPresenceService }
export default instance
