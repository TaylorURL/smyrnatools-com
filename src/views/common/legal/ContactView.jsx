import React from 'react'

import { useDocumentHead } from '../../../app/hooks/useDocumentHead'
import LegalPage, { LegalLink, LegalParagraph, LegalSection } from './LegalPage'

const EFFECTIVE = 'August 2026'

const READY_MIX_URL = 'https://smyrnareadymix.com'
const STATUS_URL = 'https://www.taylorurl.com/status'

/**
 * Public contact page. Smyrna Tools has no support desk of its own, so this
 * routes each kind of request to the channel that actually handles it: the
 * manager chain for access, in-app messaging for faults, and the company site
 * for anything about concrete rather than the software.
 */
function ContactView() {
    useDocumentHead({
        description:
            'Where to take a question about Smyrna Tools: requesting access, reporting a fault in the application, company matters, and checking whether a service is down.',
        path: '/contact',
        title: 'Contact Us'
    })

    return (
        <LegalPage
            title="Contact Us"
            summary="Where to take a question depends on what it is about. These are the routes into Smyrna Ready Mix and into the operations application."
            effective={EFFECTIVE}
        >
            <LegalSection heading="Getting an account">
                <LegalParagraph>
                    Create an account from the sign-in page at the site root. A new account arrives with no permissions
                    and shows Access Pending until an administrator assigns its roles, plant, and regions, so tell your
                    plant or district manager once you have signed up and they will get it set up.
                </LegalParagraph>
            </LegalSection>

            <LegalSection heading="Access you should have but do not">
                <LegalParagraph>
                    A screen that is missing, a plant you cannot see, or a record you cannot edit is almost always a
                    role or region assignment rather than a fault. Your district manager can confirm what your account
                    should cover and have it corrected.
                </LegalParagraph>
            </LegalSection>

            <LegalSection heading="Something in the application is wrong">
                <LegalParagraph>
                    Signed-in staff can raise it from Notifications inside Smyrna Tools, which reaches the people who
                    maintain it. Say which screen you were on and what you expected to happen. Faults are also reported
                    automatically when a screen fails, so a message describing what you were doing is what turns that
                    report into something fixable.
                </LegalParagraph>
            </LegalSection>

            <LegalSection heading="Concrete, plants, and the company">
                <LegalParagraph>
                    Orders, plant locations, services, and careers are handled by Smyrna Ready Mix rather than by this
                    application. Everything on that side lives at{' '}
                    <LegalLink href={READY_MIX_URL}>smyrnareadymix.com</LegalLink>.
                </LegalParagraph>
            </LegalSection>

            <LegalSection heading="Checking whether it is down">
                <LegalParagraph>
                    Current service status is published at <LegalLink href={STATUS_URL}>TaylorURL Status</LegalLink>.
                    Check there before reporting an outage, since a known one is usually already listed.
                </LegalParagraph>
            </LegalSection>

            <LegalSection heading="Privacy and terms">
                <LegalParagraph>
                    What the application records is set out in the <LegalLink to="/privacy">privacy policy</LegalLink>,
                    and the conditions attached to an account are in the <LegalLink to="/terms">terms of use</LegalLink>
                    .
                </LegalParagraph>
            </LegalSection>
        </LegalPage>
    )
}

export default ContactView
