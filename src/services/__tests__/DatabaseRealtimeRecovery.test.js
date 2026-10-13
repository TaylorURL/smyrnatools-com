// A realtime rejoin resumes the stream and nothing else. The server replays no
// backlog, so every row change inside the outage is gone and the view keeps
// rendering what it held when the channel dropped — a fleet that looks current
// and is not. Recovery is the only notice the client gets that it has a hole,
// and these tests pin that notice: once per outage, never on a clean first
// join, and without disturbing the failure report behind it.
//
// They pin what that report says as well. A channel the retries bring back is
// an interruption rather than a failure, and the two are told apart here by
// how long the retries have been running and whether the browser has a
// network at all.

const SESSION_JWT = 'session-jwt'
const ANON_KEY = 'test-anon-key'

// The attempts at which an interruption and then a subscription that is not
// coming back are reported, as DatabaseService counts them.
const FAILURES_BEFORE_REPORT = 4
const FAILURES_BEFORE_ERROR = 12

/** Drives the browser's own view of whether it has a network. */
function setOnline(online) {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online })
}

afterEach(() => {
    delete window.navigator.onLine
})

vi.mock('../SessionService', () => ({
    ensureFreshJwt: async () => SESSION_JWT,
    getSessionJwt: () => SESSION_JWT,
    refreshRejectedJwt: async () => SESSION_JWT,
    registerRealtimeAuthApplier: () => {}
}))

let subscribeRealtimeChannel

beforeAll(async () => {
    vi.stubEnv('REACT_APP_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('REACT_APP_SUPABASE_ANON_KEY', ANON_KEY)
    subscribeRealtimeChannel = (await import('../DatabaseService')).subscribeRealtimeChannel
})

afterAll(() => vi.unstubAllEnvs())

/** A channel that hands the test the status callback the client would drive. */
function fakeChannel() {
    const channel = {
        emit: null,
        subscribe(callback) {
            channel.emit = callback
            return channel
        }
    }
    return channel
}

describe('realtime recovery', () => {
    it('does not re-read the list when the first join succeeds', () => {
        const onResubscribe = vi.fn()
        const channel = fakeChannel()
        subscribeRealtimeChannel(channel, undefined, onResubscribe)

        channel.emit('SUBSCRIBED')

        expect(onResubscribe).not.toHaveBeenCalled()
    })

    it('re-reads the list when a channel rejoins after a timeout', () => {
        const onResubscribe = vi.fn()
        const channel = fakeChannel()
        subscribeRealtimeChannel(channel, undefined, onResubscribe)

        channel.emit('SUBSCRIBED')
        channel.emit('TIMED_OUT')
        channel.emit('SUBSCRIBED')

        expect(onResubscribe).toHaveBeenCalledTimes(1)
    })

    it('re-reads the list once per outage rather than once per failed attempt', () => {
        const onResubscribe = vi.fn()
        const channel = fakeChannel()
        subscribeRealtimeChannel(channel, undefined, onResubscribe)

        channel.emit('CHANNEL_ERROR')
        channel.emit('TIMED_OUT')
        channel.emit('CHANNEL_ERROR')
        channel.emit('SUBSCRIBED')
        channel.emit('SUBSCRIBED')

        expect(onResubscribe).toHaveBeenCalledTimes(1)
    })

    it('re-reads the list again on a second outage', () => {
        const onResubscribe = vi.fn()
        const channel = fakeChannel()
        subscribeRealtimeChannel(channel, undefined, onResubscribe)

        channel.emit('TIMED_OUT')
        channel.emit('SUBSCRIBED')
        channel.emit('TIMED_OUT')
        channel.emit('SUBSCRIBED')

        expect(onResubscribe).toHaveBeenCalledTimes(2)
    })

    it('reports an outage the retries are still working on as recovering', () => {
        const onFailure = vi.fn()
        const channel = fakeChannel()
        subscribeRealtimeChannel(channel, onFailure, vi.fn())

        for (let attempt = 0; attempt < FAILURES_BEFORE_REPORT; attempt += 1) {
            channel.emit('TIMED_OUT')
        }

        expect(onFailure).toHaveBeenCalledTimes(1)
        expect(onFailure).toHaveBeenCalledWith('TIMED_OUT', { recovering: true })
    })

    it('reports an interruption once rather than once per failed attempt', () => {
        const onFailure = vi.fn()
        const channel = fakeChannel()
        subscribeRealtimeChannel(channel, onFailure, vi.fn())

        for (let attempt = 0; attempt < FAILURES_BEFORE_ERROR - 1; attempt += 1) {
            channel.emit('CHANNEL_ERROR', new Error('heartbeat timeout'))
        }

        expect(onFailure).toHaveBeenCalledTimes(1)
        expect(onFailure).toHaveBeenCalledWith('heartbeat timeout', { recovering: true })
    })

    it('reports a subscription that never rejoins as a failure', () => {
        const onFailure = vi.fn()
        const channel = fakeChannel()
        subscribeRealtimeChannel(channel, onFailure, vi.fn())

        for (let attempt = 0; attempt < FAILURES_BEFORE_ERROR; attempt += 1) {
            channel.emit('TIMED_OUT')
        }

        expect(onFailure).toHaveBeenCalledTimes(2)
        expect(onFailure).toHaveBeenLastCalledWith('TIMED_OUT', { recovering: false })
    })

    it('reports the failure once however long the subscription stays down', () => {
        const onFailure = vi.fn()
        const channel = fakeChannel()
        subscribeRealtimeChannel(channel, onFailure, vi.fn())

        for (let attempt = 0; attempt < FAILURES_BEFORE_ERROR * 3; attempt += 1) {
            channel.emit('TIMED_OUT')
        }

        expect(onFailure).toHaveBeenCalledTimes(2)
    })

    it('does not report a failure while the browser has no network', () => {
        setOnline(false)
        const onFailure = vi.fn()
        const channel = fakeChannel()
        subscribeRealtimeChannel(channel, onFailure, vi.fn())

        for (let attempt = 0; attempt < FAILURES_BEFORE_ERROR * 2; attempt += 1) {
            channel.emit('TIMED_OUT')
        }

        expect(onFailure).toHaveBeenCalledTimes(1)
        expect(onFailure).toHaveBeenCalledWith('TIMED_OUT', { recovering: true })
    })

    it('reports a failure on the first attempt after the network comes back', () => {
        setOnline(false)
        const onFailure = vi.fn()
        const channel = fakeChannel()
        subscribeRealtimeChannel(channel, onFailure, vi.fn())

        for (let attempt = 0; attempt < FAILURES_BEFORE_ERROR * 2; attempt += 1) {
            channel.emit('TIMED_OUT')
        }
        setOnline(true)
        channel.emit('TIMED_OUT')

        expect(onFailure).toHaveBeenCalledTimes(2)
        expect(onFailure).toHaveBeenLastCalledWith('TIMED_OUT', { recovering: false })
    })

    it('reports a later outage after a rejoin has cleared the first', () => {
        const onFailure = vi.fn()
        const channel = fakeChannel()
        subscribeRealtimeChannel(channel, onFailure, vi.fn())

        for (let attempt = 0; attempt < FAILURES_BEFORE_ERROR; attempt += 1) {
            channel.emit('TIMED_OUT')
        }
        channel.emit('SUBSCRIBED')
        for (let attempt = 0; attempt < FAILURES_BEFORE_REPORT; attempt += 1) {
            channel.emit('TIMED_OUT')
        }

        expect(onFailure).toHaveBeenCalledTimes(3)
        expect(onFailure).toHaveBeenLastCalledWith('TIMED_OUT', { recovering: true })
    })

    it('ignores a status that is neither a join nor a failure', () => {
        const onFailure = vi.fn()
        const onResubscribe = vi.fn()
        const channel = fakeChannel()
        subscribeRealtimeChannel(channel, onFailure, onResubscribe)

        channel.emit('CLOSED')
        channel.emit('SUBSCRIBED')

        expect(onFailure).not.toHaveBeenCalled()
        expect(onResubscribe).not.toHaveBeenCalled()
    })
})
