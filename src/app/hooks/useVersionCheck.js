import { useCallback, useEffect, useRef, useState } from 'react'

const VERSION_POLL_INTERVAL = 60 * 1000 // 1 minute
async function fetchDeployedVersion() {
    const res = await fetch('/release.json', { cache: 'no-store' })
    if (!res.ok) throw new Error('Failed to fetch version')
    const data = await res.json()
    return data.version ?? null
}
/**
 * Polls the deployed `/release.json` once a minute and flags when the server
 * is running a newer build than the one this page loaded with. The first
 * successful fetch is taken as the loaded version, so a page opened after a
 * deploy never flags itself. Dismissal is per version: a later deploy raises
 * the flag again.
 *
 * @returns {{ hasUpdate: boolean, dismiss: () => void }}
 */
export function useVersionCheck() {
    const [hasUpdate, setHasUpdate] = useState(false)
    const loadedVersionRef = useRef(null)
    const latestVersionRef = useRef(null)
    const dismissedVersionRef = useRef(null)
    const check = useCallback(async () => {
        try {
            const version = await fetchDeployedVersion()
            if (loadedVersionRef.current === null) {
                loadedVersionRef.current = version
            } else if (version && version !== loadedVersionRef.current) {
                latestVersionRef.current = version
                if (version !== dismissedVersionRef.current) {
                    setHasUpdate(true)
                }
            }
        } catch {
            // Ignore fetch failures; the next poll retries.
        }
    }, [])
    useEffect(() => {
        check()
        const interval = setInterval(check, VERSION_POLL_INTERVAL)
        return () => clearInterval(interval)
    }, [check])
    const dismiss = useCallback(() => {
        dismissedVersionRef.current = latestVersionRef.current
        setHasUpdate(false)
    }, [])
    return { dismiss, hasUpdate }
}
