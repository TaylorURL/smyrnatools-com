import React from 'react'

import { formatCentralDateTime } from '../../../utils/PlanUtility'
import { Tractor } from '../../models/tractors/Tractor'
import DetailViewSection from '../sections/DetailViewSection'
import VerificationCardSection from '../sections/VerificationCardSection'

/** Builds the two-row "Verified" + "Verified By" items rendered under the verification card. */
function buildVerificationItems(tractor, updatedByEmail) {
    const isVerified = Tractor.ensureInstance(tractor).isVerified()
    const isUpdatedAfterLast = tractor.updatedLast && new Date(tractor.updatedAt) > new Date(tractor.updatedLast)

    // Never verified, and edited since the last verification, are both
    // failures. A verification that only lapsed with the turn of the week is
    // a warning: nothing is wrong with the tractor, it is just due again.
    const verifiedColor = !tractor.updatedLast
        ? 'var(--danger)'
        : isVerified
          ? 'var(--success)'
          : isUpdatedAfterLast
            ? 'var(--danger)'
            : 'var(--warning)'

    const verifiedValueColor = !tractor.updatedLast
        ? 'var(--danger)'
        : isVerified
          ? 'inherit'
          : isUpdatedAfterLast
            ? 'var(--danger)'
            : 'var(--warning)'

    const verifiedSuffix = !isVerified ? (isUpdatedAfterLast ? ' (Changes have been made)' : ' (It is a new week)') : ''

    return [
        {
            icon: 'fas fa-calendar-check',
            iconStyle: { color: verifiedColor },
            label: 'Verified',
            value: tractor.updatedLast
                ? `${formatCentralDateTime(tractor.updatedLast)}${verifiedSuffix}`
                : 'Never verified',
            valueStyle: { color: verifiedValueColor }
        },
        {
            icon: 'fas fa-user-check',
            iconStyle: { color: tractor.updatedBy ? 'var(--success)' : 'var(--danger)' },
            label: 'Verified By',
            title: `Last Updated: ${formatCentralDateTime(tractor.updatedAt)}`,
            value: tractor.updatedBy ? updatedByEmail || 'Unknown User' : 'No verification record',
            valueStyle: { color: tractor.updatedBy ? 'inherit' : 'var(--danger)' }
        }
    ]
}

/** "Verification" tab on the tractor detail view: status + verify CTA. */
function TractorVerificationSection({ canEditTractor, handleVerifyTractor, tractor, tractorId, updatedByEmail }) {
    const verificationItems = buildVerificationItems(tractor, updatedByEmail)
    return (
        <DetailViewSection.Section id="verification" title="Verification" icon="fas fa-clipboard-check">
            <DetailViewSection.Card>
                <VerificationCardSection
                    isVerified={Tractor.ensureInstance(tractor).isVerified()}
                    verificationLabel={
                        !tractor.updatedLast || !tractor.updatedBy ? 'Needs Verification' : 'Verification Outdated'
                    }
                    verificationItems={verificationItems}
                    onVerify={handleVerifyTractor}
                    canEdit={canEditTractor}
                    lastVerifiedDate={tractor.updatedLast}
                    lastChangedDate={tractor.updatedAt}
                    assetId={tractorId}
                    assetType="tractor"
                />
            </DetailViewSection.Card>
        </DetailViewSection.Section>
    )
}

export default TractorVerificationSection
