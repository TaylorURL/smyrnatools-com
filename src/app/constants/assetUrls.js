/** URL of the Smyrna Ready Mix mark.
 *
 *  Served from public/ rather than imported through the bundler, so the URL
 *  is fixed at authoring time and index.html can preload the same file the
 *  login screen paints. A bundled import carries a content hash nothing
 *  outside the bundle can name, which leaves the mark undiscoverable until
 *  the bundle has run. */
export const SRM_LOGO_URL = '/srm-logo.svg'
