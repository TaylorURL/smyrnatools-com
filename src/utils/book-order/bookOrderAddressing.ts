/* Address-matching helpers — ZIP / state / token extraction and the
 * `scoreProximity` heuristic used to rank plants when no live driving-time
 * lookup is available yet. */

// eslint-disable-next-line security/detect-unsafe-regex -- fixed-length digit match with optional literal-dash suffix; no backtracking risk
const ZIP_REGEX = /\b(\d{5})(?:-\d{4})?\b/
const STATE_REGEX = /\b([A-Z]{2})\b(?=[\s,]*\d{5})?/

const STREET_NOISE = new Set([
    'ave',
    'avenue',
    'blvd',
    'boulevard',
    'dr',
    'drive',
    'rd',
    'road',
    'st',
    'street',
    'ln',
    'lane',
    'ct',
    'court',
    'pkwy',
    'parkway',
    'hwy',
    'highway',
    'us',
    'fm',
    'suite',
    'ste',
    'apt',
    'n',
    's',
    'e',
    'w'
])

/** Pull a 5-digit ZIP out of any address-ish string. */
export const extractZip = (address) => {
    if (!address) return null
    const match = String(address).match(ZIP_REGEX)
    return match ? match[1] : null
}

/** Pull a 2-letter state code, preferring one positioned just before a ZIP. */
export const extractStateCode = (address) => {
    if (!address) return null
    const upper = String(address).toUpperCase()
    const near = upper.match(STATE_REGEX)
    if (near) return near[1]
    const generic = upper.match(/\b([A-Z]{2})\b/)
    return generic ? generic[1] : null
}

/** Lowercased word tokens with the common suffixes / punctuation stripped so
 *  "401 Smyrna Blvd, Houston, TX" overlaps cleanly with "Houston Tx 77002". */
export const tokenizeAddress = (address) => {
    if (!address) return []
    return String(address)
        .toLowerCase()
        .replace(/[.,#]/g, ' ')
        .split(/\s+/)
        .filter((token) => token && !STREET_NOISE.has(token))
}

/** 0..1 proximity score between a job address and a plant address. ZIP
 *  match is the strongest signal (same delivery area); a shared 3-digit
 *  ZIP prefix is a softer regional match; otherwise fall back to shared
 *  city / state tokens. Returns 0 when neither side has usable text. */
export const scoreProximity = (jobAddress, plantAddress) => {
    if (!jobAddress || !plantAddress) return 0
    const jobZip = extractZip(jobAddress)
    const plantZip = extractZip(plantAddress)
    if (jobZip && plantZip) {
        if (jobZip === plantZip) return 1
        if (jobZip.slice(0, 3) === plantZip.slice(0, 3)) return 0.7
    }
    const jobTokens = new Set(tokenizeAddress(jobAddress))
    const plantTokens = new Set(tokenizeAddress(plantAddress))
    if (!jobTokens.size || !plantTokens.size) return 0
    let shared = 0
    for (const token of jobTokens) if (plantTokens.has(token)) shared += 1
    const tokenScore = shared / Math.min(jobTokens.size, plantTokens.size)
    const stateBoost =
        extractStateCode(jobAddress) && extractStateCode(jobAddress) === extractStateCode(plantAddress) ? 0.15 : 0
    return Math.min(1, tokenScore * 0.6 + stateBoost)
}
