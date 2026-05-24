import L from 'leaflet'

export const TENNESSEE_CENTER = [35.86, -86.66]
export const DEFAULT_ZOOM = 8

export const PLANT_RADIUS_MIN = 34
export const PLANT_RADIUS_MAX = 56

export const NEEDS_HELP_COLOR = '#dc2626'
export const LEAVE_OFF_COLOR = '#d97706'
export const PICKING_COLOR = '#f59e0b'

/* Basemap tiles — CartoDB's Positron / Dark Matter sets. Vastly less
 * busy than the default OSM raster (no shaded relief, muted road
 * hierarchy, fewer minor labels) so the plant pins and animated routes
 * stay the visual focus. */
export const CARTO_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; ' +
    '<a href="https://carto.com/attributions">CARTO</a>'
export const CARTO_LIGHT_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
export const CARTO_DARK_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

/* Autoplay timing — how fast the cycle ticks through the day. 5-minute
 * steps every 240ms gives a ~70-second full-day loop, half the original
 * 35-second pace so a dispatcher can read the chrome (route activity,
 * pin counts, arrow positions) without feeling rushed. Same per-tick
 * fidelity as before — the slowdown comes from the tick interval, not
 * a coarser step. */
export const AUTOPLAY_STEP_MINUTES = 5
export const AUTOPLAY_TICK_MS = 240
export const MINUTES_IN_DAY = 24 * 60

export const REGION_STATE_HINTS = {
    AGG: 'Tennessee',
    TN: 'Tennessee'
}

const HTML_ESCAPES = { '"': '&quot;', '&': '&amp;', "'": '&#39;', '<': '&lt;', '>': '&gt;' }
/** Escape a free-form string for embedding inside a Leaflet tooltip's
 *  HTML payload. Order matters in `HTML_ESCAPES`: `&` first prevents
 *  double-escaping the entity sequences we then insert. */
export function escapeTooltip(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c])
}

/* Geocoding sanity checks — drive times over 2 hours from the destination
 * plant are not real concrete deliveries; concrete sets in roughly 90
 * minutes from water contact, so anything that far away is a Nominatim
 * misfire ("Memphis, TN" geocoding to Memphis, NY). The straight-line cap
 * is a cheap pre-filter applied at geocode time; the drive-time cap is
 * the precise check applied after OSRM resolves the actual route. */
export const MAX_JOB_STRAIGHT_LINE_MILES = 120
export const MAX_JOB_DRIVE_SECONDS = 2 * 60 * 60
const EARTH_RADIUS_MILES = 3958.8
const US_STATE_CODE_REGEX = /,\s*([A-Z]{2})\b/

/** Great-circle distance between two `{ lat, lng }` points in miles. */
export function haversineMiles(a, b) {
    if (
        !a ||
        !b ||
        !Number.isFinite(a.lat) ||
        !Number.isFinite(a.lng) ||
        !Number.isFinite(b.lat) ||
        !Number.isFinite(b.lng)
    ) {
        return Infinity
    }
    const toRad = (degrees) => (degrees * Math.PI) / 180
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
    return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h))
}

/** Pull a two-letter state code out of a plant's address string so we can
 *  hint the geocoder with the correct state per plant — Tennessee is the
 *  app's default but Texas / others bleed in for districts whose plant
 *  addresses sit elsewhere. Returns null when the address lacks a clean
 *  ", XX" segment. */
export function inferStateCodeFromAddress(address) {
    if (!address) return null
    const match = String(address).toUpperCase().match(US_STATE_CODE_REGEX)
    return match ? match[1] : null
}

export function resolveStateHint(region) {
    if (!region) return 'Tennessee'
    if (region.state) return region.state
    if (region.code && REGION_STATE_HINTS[region.code]) return REGION_STATE_HINTS[region.code]
    return 'Tennessee'
}

/** Route-leg color tokens. Outbound (going to help) is green, return
 *  (heading home) is orange. Slate is the at-rest base used when a leg's
 *  drivers haven't started moving on it yet. */
export const ROUTE_OUTBOUND_COLOR = '#16a34a'
export const ROUTE_RETURN_COLOR = '#f97316'
export const ROUTE_IDLE_COLOR = '#0f172a'

/** Minutes a direct-load driver holds at the job site before turning to
 *  their return plant. Real pours land somewhere between 30 and 90
 *  minutes; an hour is a sensible average that lines up with how
 *  dispatchers verbally estimate "pour out" on the radio. Only used
 *  when the assignment is loading-direct for a specific order — the
 *  per-driver `leaveTime` field is the leave time for the destination
 *  PLANT (the help-the-plant flow), not the leave time for a job. */
export const DIRECT_LOAD_HOLD_MINUTES = 60

/** Reads the current theme directly off the `<html>` class list — the
 *  same source the app uses to flip `--bg-*` tokens — so the basemap
 *  matches the active theme without a separate context dependency. */
export function isDarkTheme() {
    if (typeof document === 'undefined') return false
    return document.documentElement.classList.contains('dark')
}

export function buildTileLayer() {
    return L.tileLayer(isDarkTheme() ? CARTO_DARK_URL : CARTO_LIGHT_URL, {
        attribution: CARTO_ATTRIBUTION,
        maxZoom: 19,
        subdomains: 'abcd'
    })
}
