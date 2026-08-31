import { Mixer } from '../../models/mixers/Mixer'

/**
 * Builds the verification items list for the mixer detail
 * VerificationCardSection, centralizing the verified/outdated/changed
 * color logic away from the orchestrating JSX.
 */
export function buildMixerVerificationItems(mixer, updatedByEmail) {
    const instance = Mixer.ensureInstance(mixer)
    const isVerified = instance.isVerified()
    const hasUpdatedLast = Boolean(mixer.updatedLast)
    const changesAfterVerification = hasUpdatedLast && new Date(mixer.updatedAt) > new Date(mixer.updatedLast)

    // Color encodes the verification state: green when verified and current,
    // amber when a new week has started without re-verification, red when
    // edits landed after the last verification or there is no record at all.
    const verifiedColor = hasUpdatedLast
        ? isVerified
            ? 'var(--success)'
            : changesAfterVerification
              ? 'var(--danger)'
              : 'var(--warning)'
        : 'var(--danger)'

    const verifiedValueColor = hasUpdatedLast
        ? isVerified
            ? 'inherit'
            : changesAfterVerification
              ? 'var(--danger)'
              : 'var(--warning)'
        : 'var(--danger)'

    const verifiedSuffix =
        hasUpdatedLast && !isVerified
            ? changesAfterVerification
                ? ' (Changes have been made)'
                : ' (It is a new week)'
            : ''

    return [
        {
            icon: 'fas fa-calendar-check',
            iconStyle: { color: verifiedColor },
            label: 'Verified',
            style: { color: verifiedColor },
            value: hasUpdatedLast
                ? `${new Date(mixer.updatedLast).toLocaleString()}${verifiedSuffix}`
                : 'Never verified',
            valueStyle: { color: verifiedValueColor }
        },
        {
            icon: 'fas fa-user-check',
            iconStyle: { color: mixer.updatedBy ? 'var(--success)' : 'var(--danger)' },
            label: 'Verified By',
            title: `Last Updated: ${new Date(mixer.updatedAt).toLocaleString()}`,
            value: mixer.updatedBy ? updatedByEmail || 'Unknown User' : 'No verification record',
            valueStyle: { color: mixer.updatedBy ? 'inherit' : 'var(--danger)' }
        }
    ]
}
