import React from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

import { PreferencesProvider } from './app/context/PreferencesContext'
import FrontDoor from './app/FrontDoor'

export { BACKGROUND_VIDEO_URLS } from './app/constants/assetUrls'

/**
 * Draws the signed-out front door for the build to write into index.html.
 *
 * The browser is handed a document that already contains the screen rather than
 * an empty root and a bundle to build it from, so the first paint owes the
 * bundle nothing. Only two things wrap the screen: a router, because the footer
 * links out to the legal routes, and the preferences provider, because the
 * accent colour behind the video reads from it. Both render their defaults
 * here, which are the values the browser starts from as well, so the markup
 * this returns is the markup React draws a moment later.
 */
export function render() {
    return renderToString(
        <MemoryRouter initialEntries={['/']}>
            <PreferencesProvider>
                <FrontDoor />
            </PreferencesProvider>
        </MemoryRouter>
    )
}
