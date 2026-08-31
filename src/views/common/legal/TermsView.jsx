import React from 'react'

import { useDocumentHead } from '../../../app/hooks/useDocumentHead'
import LegalPage, { LegalLink, LegalParagraph, LegalSection } from './LegalPage'

const EFFECTIVE = 'August 2026'

/**
 * Public terms page. States the conditions attached to a Smyrna Tools account:
 * who may hold one, what the records inside are for, and how access ends.
 */
function TermsView() {
    useDocumentHead({
        description:
            'The terms for using Smyrna Tools: how accounts are granted, what each role may do, the accuracy expected of fleet records, and how access ends.',
        path: '/terms',
        title: 'Terms of Use'
    })

    return (
        <LegalPage
            title="Terms of Use"
            summary="Smyrna Tools is a Smyrna Ready Mix system. Holding an account means agreeing to the conditions on this page."
            effective={EFFECTIVE}
        >
            <LegalSection heading="What Smyrna Tools is for">
                <LegalParagraph>
                    Smyrna Tools runs the day-to-day operation of Smyrna Ready Mix: plants, mixer and tractor fleets,
                    trailers, pickup trucks, heavy equipment, the people assigned to them, and the productivity records
                    that come out of all of it. It is a company system, provided for company work.
                </LegalParagraph>
            </LegalSection>

            <LegalSection heading="Your account">
                <LegalParagraph>
                    An account belongs to one person. Do not share your password and do not let anyone else work under
                    your sign-in. Everything done in the application is attributed to the account that did it, so an
                    account someone else is using is a record with the wrong name on it.
                </LegalParagraph>
                <LegalParagraph>
                    Creating an account does not grant access. A new account waits with no permissions until an
                    administrator assigns its roles, plant, and regions.
                </LegalParagraph>
            </LegalSection>

            <LegalSection heading="What your roles allow">
                <LegalParagraph>
                    Roles and region assignments decide which screens an account reaches and which records it can
                    change. Those limits describe the work the account is there to do. Trying to work around them, or to
                    reach records outside them, is misuse of the system.
                </LegalParagraph>
            </LegalSection>

            <LegalSection heading="The records you enter">
                <LegalParagraph>
                    Entries about plants, assets, and personnel are business records. Dispatch, scheduling, maintenance,
                    and reporting all run off them, so enter what is actually true and correct an entry as soon as you
                    know it is wrong. A stale status on a mixer is a truck somebody counted on.
                </LegalParagraph>
            </LegalSection>

            <LegalSection heading="Exports and company data">
                <LegalParagraph>
                    The application can export operational data to spreadsheets. An export is still Smyrna Ready Mix
                    data: keep it on company systems and do not pass it to anyone outside the company.
                </LegalParagraph>
            </LegalSection>

            <LegalSection heading="Availability and changes">
                <LegalParagraph>
                    Smyrna Tools is updated regularly and screens can change as the operation changes. It is provided as
                    it stands, without a guarantee of uninterrupted service. Where a fault affects work, report it
                    rather than working around it.
                </LegalParagraph>
            </LegalSection>

            <LegalSection heading="Ownership">
                <LegalParagraph>
                    The application, its design, and the records held in it belong to Smyrna Ready Mix. Nothing about
                    holding an account transfers any of that.
                </LegalParagraph>
            </LegalSection>

            <LegalSection heading="Ending access">
                <LegalParagraph>
                    Smyrna Ready Mix can change, suspend, or withdraw access at any time, including where an account is
                    being misused. Access ends when employment or the contract ends, and the entries the account made
                    stay with the records they belong to.
                </LegalParagraph>
            </LegalSection>

            <LegalSection heading="How your data is handled">
                <LegalParagraph>
                    What the application records about you, and who can see it, is set out in the{' '}
                    <LegalLink to="/privacy">privacy policy</LegalLink>. Questions about either page go through the{' '}
                    <LegalLink to="/contact">contact page</LegalLink>.
                </LegalParagraph>
            </LegalSection>
        </LegalPage>
    )
}

export default TermsView
