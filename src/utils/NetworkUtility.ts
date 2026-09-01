/**
 * Browser connectivity detection and the deployed release identity.
 *
 * Reachability is measured against this origin, not the wider internet: the
 * offline banner exists to say whether the app can talk to its own server, and
 * `/release.json` is the cheapest static file that answers that. A probe of a
 * third-party host would report success while this origin was unreachable,
 * which is the one case the banner has to catch.
 *
 * The same file names the deployed version, so the connectivity probe, the
 * update poll, and the footer's version read all want the same bytes and ask
 * for them within a few milliseconds of each other on boot. One request is
 * held open at a time and every caller arriving while it is open joins it, so
 * the three of them cost one round trip rather than three.
 */
interface ReleaseProbe {
    /** Whether the origin answered with a successful response. */
    ok: boolean
    /** The version the file named, or '' when it named none. */
    version: string
}
const isMobileDevice = (): boolean => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}
// Mobile radios routinely take several seconds to hand a request off, so they
// get a wider window before a slow response counts as unreachable.
const PING_TIMEOUT = isMobileDevice() ? 15000 : 5000
let inFlightRelease: Promise<ReleaseProbe> | null = null
/**
 * Reads `/release.json` past every cache, sharing one request between
 * concurrent callers. Never rejects: the outcome is read from `ok`, so a
 * caller that only wants reachability and a caller that only wants the version
 * can sit on the same promise without either one's failure handling standing
 * in for the other's.
 */
const fetchRelease = (): Promise<ReleaseProbe> => {
    if (inFlightRelease) return inFlightRelease
    const controller = new AbortController()
    // Aborting with an explicit reason keeps a timed-out probe
    // distinguishable from a connection the browser dropped on its own.
    const timeoutId = setTimeout(
        () => controller.abort(new DOMException('Connectivity probe timed out', 'TimeoutError')),
        PING_TIMEOUT
    )
    const request = fetch(`/release.json?cb=${Date.now()}`, {
        cache: 'no-store',
        method: 'GET',
        signal: controller.signal
    })
        .then(async (res): Promise<ReleaseProbe> => {
            if (!res?.ok) return { ok: false, version: '' }
            try {
                const body = await res.json()
                return { ok: true, version: typeof body?.version === 'string' ? body.version : '' }
            } catch {
                return { ok: true, version: '' }
            }
        })
        .catch((): ReleaseProbe => ({ ok: false, version: '' }))
        .finally(() => {
            clearTimeout(timeoutId)
            inFlightRelease = null
        })
    inFlightRelease = request
    return request
}
const NetworkUtility = {
    async checkConnection(): Promise<boolean> {
        const { ok } = await fetchRelease()
        return ok
    },
    isMobileDevice(): boolean {
        return isMobileDevice()
    }
}
export default NetworkUtility
export { fetchRelease, NetworkUtility }
export type { ReleaseProbe }
