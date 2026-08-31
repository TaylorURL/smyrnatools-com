import React from 'react'
import { Link } from 'react-router-dom'

import AppFooter from '../../../app/components/common/AppFooter'
import { SRM_LOGO_URL } from '../../../app/constants/assetUrls'

/**
 * Shared chrome for the three public pages — privacy, terms, and contact.
 * These sit outside the signed-in shell, so they carry their own header and
 * take their ink from the theme tokens: a visitor arriving cold reads them on
 * the light palette, and someone stepping out of the app keeps whichever
 * theme they were already in.
 */
function LegalPage({ title, summary, effective, children }) {
    return (
        <div className="flex h-full w-full flex-col overflow-y-auto bg-bg-secondary font-sans">
            <header className="shrink-0 border-b border-border-light bg-bg-primary">
                <div className="mx-auto flex w-full max-w-3xl items-center px-5 py-3 sm:px-8">
                    <Link
                        to="/"
                        className="group flex min-w-0 items-center gap-3 rounded-md transition-opacity duration-150 ease-out hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary motion-reduce:transition-none"
                    >
                        <img
                            src={SRM_LOGO_URL}
                            alt=""
                            aria-hidden="true"
                            width={28}
                            height={28}
                            className="h-7 w-7 shrink-0"
                        />
                        <span className="flex min-w-0 flex-col leading-tight">
                            <span className="font-heading text-[15px] font-bold tracking-tight text-text-primary">
                                Smyrna Tools
                            </span>
                            <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                Operations · Fleet · Concrete
                            </span>
                        </span>
                    </Link>
                </div>
            </header>
            <main className="flex-1">
                <article className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
                    <h1 className="m-0 font-heading text-[30px] font-bold leading-tight tracking-tight text-text-primary sm:text-[36px]">
                        {title}
                    </h1>
                    <p className="mb-0 mt-3 text-[15px] leading-relaxed text-text-secondary">{summary}</p>
                    <p className="mb-0 mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                        In effect {effective}
                    </p>
                    <div className="mt-9 flex flex-col gap-8">{children}</div>
                </article>
            </main>
            <AppFooter />
        </div>
    )
}

/** One titled block of a legal page. */
export function LegalSection({ heading, children }) {
    return (
        <section className="flex flex-col gap-3">
            <h2 className="m-0 font-heading text-[19px] font-bold tracking-tight text-text-primary">{heading}</h2>
            {children}
        </section>
    )
}

/** Body paragraph, sized and spaced to read as running prose. */
export function LegalParagraph({ children }) {
    return <p className="m-0 text-[14.5px] leading-[1.7] text-text-secondary">{children}</p>
}

const LINK_CLASS =
    'font-semibold text-accent underline underline-offset-2 transition-opacity duration-150 ease-out hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-secondary motion-reduce:transition-none'

/** Inline link inside legal prose. `to` routes internally, `href` leaves the site. */
export function LegalLink({ to, href, children }) {
    if (href) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                {children}
            </a>
        )
    }
    return (
        <Link to={to} className={LINK_CLASS}>
            {children}
        </Link>
    )
}

/** Bulleted list for the places a section enumerates rather than explains. */
export function LegalList({ items }) {
    return (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {items.map((item) => (
                <li key={item.term} className="flex gap-3 text-[14.5px] leading-[1.7] text-text-secondary">
                    <span aria-hidden="true" className="mt-[0.7em] h-1 w-1 shrink-0 rounded-full bg-accent" />
                    <span>
                        <strong className="font-semibold text-text-primary">{item.term}</strong> {item.detail}
                    </span>
                </li>
            ))}
        </ul>
    )
}

export default LegalPage
