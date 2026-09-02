/** URL of the Smyrna Ready Mix mark.
 *
 *  Served from public/ rather than imported through the bundler, so the URL
 *  is fixed at authoring time and index.html can preload the same file the
 *  login screen paints. A bundled import carries a content hash nothing
 *  outside the bundle can name, which leaves the mark undiscoverable until
 *  the bundle has run. */
export const SRM_LOGO_URL = '/srm-logo.svg'

/** The interchangeable clips behind the sign-in screen, one chosen per visit.
 *
 *  Served from public/ for the same reason the mark is. The sign-in screen is
 *  written into index.html at build time, so the video element reaches the
 *  browser with the document; a bundled import would name a hashed file the
 *  document could not spell, and the clip would not be asked for until the
 *  bundle had run. */
export const BACKGROUND_VIDEO_URLS = ['/videos/1.mp4', '/videos/2.mp4', '/videos/3.mp4', '/videos/4.mp4']
