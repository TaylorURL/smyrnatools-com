/**
 * Extracts browser, OS, and device type from the user-agent string.
 * Shared across auth session creation and account management.
 */

export function getBrowserName(userAgent) {
    if (userAgent.includes('Firefox')) return 'Firefox'
    if (userAgent.includes('Edg')) return 'Edge'
    if (userAgent.includes('OPR') || userAgent.includes('Opera')) return 'Opera'
    if (userAgent.includes('Chrome')) return 'Chrome'
    if (userAgent.includes('Safari')) return 'Safari'
    return 'Unknown Browser'
}

export function getOSName(userAgent) {
    if (userAgent.includes('Windows')) return 'Windows'
    if (userAgent.includes('Mac')) return 'macOS'
    if (userAgent.includes('Android')) return 'Android'
    if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS'
    if (userAgent.includes('Linux')) return 'Linux'
    return 'Unknown OS'
}

export function getDeviceType(userAgent) {
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) return 'Mobile'
    if (userAgent.includes('iPad') || userAgent.includes('Tablet')) return 'Tablet'
    return 'Desktop'
}

/** Convenience bundle for session-row writes — browser/os/device + raw UA. */
export function getBrowserMetadata() {
    const userAgent = navigator.userAgent
    return {
        browser: getBrowserName(userAgent),
        device: getDeviceType(userAgent),
        os: getOSName(userAgent),
        userAgent
    }
}
