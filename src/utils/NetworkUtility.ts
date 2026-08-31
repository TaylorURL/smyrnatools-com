/**
 * Browser connectivity detection.
 *
 * Reachability is measured against this origin, not the wider internet: the
 * offline banner exists to say whether the app can talk to its own server, and
 * `/release.json` is the cheapest static file that answers that. A probe of a
 * third-party host would report success while this origin was unreachable,
 * which is the one case the banner has to catch.
 */
const isMobileDevice = (): boolean => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}
// Mobile radios routinely take several seconds to hand a request off, so they
// get a wider window before a slow response counts as unreachable.
const PING_TIMEOUT = isMobileDevice() ? 15000 : 5000
const NetworkUtility = {
    async checkConnection(): Promise<boolean> {
        const controller = new AbortController()
        // Aborting with an explicit reason keeps a timed-out probe
        // distinguishable from a connection the browser dropped on its own.
        const timeoutId = setTimeout(
            () => controller.abort(new DOMException('Connectivity probe timed out', 'TimeoutError')),
            PING_TIMEOUT
        )
        try {
            const res = await fetch(`/release.json?cb=${Date.now()}`, {
                cache: 'reload',
                method: 'GET',
                signal: controller.signal
            })
            return !!res?.ok
        } catch {
            return false
        } finally {
            clearTimeout(timeoutId)
        }
    },
    isMobileDevice(): boolean {
        return isMobileDevice()
    }
}
export default NetworkUtility
export { NetworkUtility }
