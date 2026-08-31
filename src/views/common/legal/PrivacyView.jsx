import React from 'react'

import { useDocumentHead } from '../../../app/hooks/useDocumentHead'
import LegalPage, { LegalLink, LegalList, LegalParagraph, LegalSection } from './LegalPage'

const EFFECTIVE = 'August 2026'

const RECORDED = [
    {
        detail: 'The name and work email address used to sign in, plus the roles, plant, and regions assigned to the account.',
        term: 'Account details.'
    },
    {
        detail: 'Entries about plants, mixers, tractors, trailers, pickup trucks, heavy equipment, operators, and managers, together with which account made each entry and when.',
        term: 'Operational records.'
    },
    {
        detail: 'Conversations, notifications, and comments left on the records they belong to.',
        term: 'Messages and comments.'
    },
    {
        detail: 'A sign-in session, the display settings chosen on that device such as theme and start page, and an analytics identifier.',
        term: 'Browser storage.'
    }
]

/**
 * Public privacy page. Describes what the operations application records about
 * the people using it, where that data sits, and who inside Smyrna Ready Mix
 * can reach it.
 */
function PrivacyView() {
    useDocumentHead({
        description:
            'What Smyrna Tools records about an account and the fleet it manages, who can see it, how long it is held, and which processors it passes through.',
        path: '/privacy',
        title: 'Privacy Policy'
    })

    return (
        <LegalPage
            title="Privacy Policy"
            summary="Smyrna Tools is the internal operations application of Smyrna Ready Mix. This page sets out what it records about the people who use it, where that data is held, and who can see it."
            effective={EFFECTIVE}
        >
            <LegalSection heading="Who this applies to">
                <LegalParagraph>
                    Smyrna Tools is for Smyrna Ready Mix staff and contractors. Every screen holding plant, fleet, or
                    personnel data sits behind sign-in; only the sign-in page and the public pages it links to,
                    including this one, are reachable without an account.
                </LegalParagraph>
            </LegalSection>

            <LegalSection heading="What the application records">
                <LegalList items={RECORDED} />
            </LegalSection>

            <LegalSection heading="Diagnostics">
                <LegalParagraph>
                    When a screen fails, the application sends a diagnostic report so the fault can be traced and fixed.
                    Email address, username, and IP address are stripped from that report in the browser before it is
                    sent. The account identifier stays on it, which is what ties a fault to the session that hit it.
                </LegalParagraph>
            </LegalSection>

            <LegalSection heading="Traffic analytics">
                <LegalParagraph>
                    Smyrna Tools records which pages are opened, how long each stays on screen, and where a visit
                    arrived from. An identifier is stored on the device so repeat visits are counted once rather than as
                    new people each time.
                </LegalParagraph>
                <LegalParagraph>
                    Analytics is collected by the team that maintains Smyrna Tools rather than by an advertising
                    network. The application carries no advertising, nothing recorded here is sold, and none of it is
                    shared for marketing.
                </LegalParagraph>
            </LegalSection>

            <LegalSection heading="Where the data is held">
                <LegalParagraph>
                    Operational records live in the application database, hosted by Supabase, and the application is
                    served by Vercel. Both act on behalf of Smyrna Ready Mix and hold the data only to run this system.
                </LegalParagraph>
            </LegalSection>

            <LegalSection heading="Who can see it">
                <LegalParagraph>
                    Visibility follows the roles and regions on an account. An operator sees the plants and equipment
                    their work covers; a manager sees the region they are responsible for; administrators can reach all
                    of it in order to run the system. Entries are attributed, so the account that made a change is
                    visible to anyone who can see the record.
                </LegalParagraph>
            </LegalSection>

            <LegalSection heading="How long it is kept">
                <LegalParagraph>
                    Operational records are business records of Smyrna Ready Mix and are kept for as long as the company
                    needs them. Access ends when employment ends: an account marked terminated can no longer sign in,
                    while the entries it made stay attached to the plant, asset, or person they describe.
                </LegalParagraph>
            </LegalSection>

            <LegalSection heading="Correcting your details">
                <LegalParagraph>
                    Name and display settings can be changed from My Account inside the application. To correct a role,
                    plant, or region assignment, or to ask what is held against your account, use the routes on the{' '}
                    <LegalLink to="/contact">contact page</LegalLink>.
                </LegalParagraph>
            </LegalSection>
        </LegalPage>
    )
}

export default PrivacyView
