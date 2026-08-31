import { useEffect } from 'react'

const SITE = 'https://www.smyrnatools.com'
const SITE_NAME = 'Smyrna Tools'

/** Reads a meta or link element by its selector, creating it if the document
 *  carries none. The static head covers the entry document, so a route that
 *  sets its own is editing what is already there rather than adding a second. */
function element(selector, create) {
    const found = document.head.querySelector(selector)
    if (found) return found
    const made = create()
    document.head.appendChild(made)
    return made
}

function setMeta(attribute, name, content) {
    const node = element(`meta[${attribute}="${name}"]`, () => {
        const made = document.createElement('meta')
        made.setAttribute(attribute, name)
        return made
    })
    node.setAttribute('content', content)
}

/**
 * Gives a route its own title, description, canonical and share card.
 *
 * A single-page app serves every route from one document, so without this each
 * one inherits the entry document's head and the whole site competes for a
 * ranking under one name and one URL. The values are restored on unmount, which
 * is what keeps a visit to a public page from leaving its title on the app the
 * reader returns to.
 */
export function useDocumentHead({ title, description, path }) {
    useEffect(() => {
        const url = `${SITE}${path}`
        const full = `${title} | ${SITE_NAME}`
        const previous = {
            canonical: document.head.querySelector('link[rel="canonical"]')?.href,
            description: document.head.querySelector('meta[name="description"]')?.content,
            ogDescription: document.head.querySelector('meta[property="og:description"]')?.content,
            ogTitle: document.head.querySelector('meta[property="og:title"]')?.content,
            ogUrl: document.head.querySelector('meta[property="og:url"]')?.content,
            title: document.title
        }

        document.title = full
        setMeta('name', 'description', description)
        setMeta('property', 'og:title', full)
        setMeta('property', 'og:description', description)
        setMeta('property', 'og:url', url)
        setMeta('property', 'og:type', 'website')
        setMeta('name', 'twitter:title', full)
        setMeta('name', 'twitter:description', description)
        element('link[rel="canonical"]', () => {
            const made = document.createElement('link')
            made.setAttribute('rel', 'canonical')
            return made
        }).setAttribute('href', url)

        return () => {
            document.title = previous.title
            if (previous.description) setMeta('name', 'description', previous.description)
            if (previous.ogTitle) setMeta('property', 'og:title', previous.ogTitle)
            if (previous.ogDescription) setMeta('property', 'og:description', previous.ogDescription)
            if (previous.ogUrl) setMeta('property', 'og:url', previous.ogUrl)
            if (previous.canonical) {
                document.head.querySelector('link[rel="canonical"]')?.setAttribute('href', previous.canonical)
            }
        }
    }, [title, description, path])
}
