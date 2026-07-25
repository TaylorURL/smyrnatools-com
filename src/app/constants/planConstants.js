/* Smyrna's operations run on Central time regardless of where the
 * dispatcher (or developer) is sitting, so every "today" decision anchors
 * here — UTC may already be tomorrow while CST is still today. */
export const PLAN_TIME_ZONE = 'America/Chicago'
