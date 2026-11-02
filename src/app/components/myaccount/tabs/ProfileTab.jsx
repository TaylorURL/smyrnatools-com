import React from 'react'

import { FIELD_LABEL_CLASS, FieldStyle } from '../../../constants/myAccountConstants'
import Badge from '../../common/Badge'
import UserAvatar from '../../common/UserAvatar'
import { Card, CardHeader, DetailRow, PrimaryButton } from '../MyAccountAtoms'

/** Profile tab body — identity card (name + email + role + form to update
 *  first/last name) and scope card (region picker + plant codes). */
export default function ProfileTab({
    accentColor,
    additionalPlants,
    email,
    firstName,
    getInitials,
    lastName,
    loading,
    onChangeRegion,
    onSubmit,
    permittedRegions,
    plantCode,
    preferences,
    regionsLoaded,
    setFirstName,
    setLastName,
    userRole
}) {
    const initials = getInitials?.()
    return (
        <>
            <section id="identity" className="scroll-mt-4">
                <Card>
                    <div className="flex items-center gap-4 px-5 py-4 border-b border-border-light">
                        <UserAvatar
                            accentColor={accentColor}
                            initials={initials}
                            size={56}
                            rounded="lg"
                            className="text-[18px]"
                        />
                        <div className="min-w-0 flex-1">
                            <div className="text-[16px] font-semibold truncate text-text-primary">
                                {firstName || lastName ? `${firstName || ''} ${lastName || ''}`.trim() : 'My Account'}
                            </div>
                            <div className="text-[12px] truncate mt-0.5 text-text-tertiary">{email || 'No email'}</div>
                            {userRole && (
                                <Badge tone="neutral" size="md" className="mt-2">
                                    {userRole}
                                </Badge>
                            )}
                        </div>
                    </div>
                    <form onSubmit={onSubmit} className="px-5 py-5 flex flex-col gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                    First name
                                </label>
                                <input
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder="Enter first name"
                                    required
                                    className="w-full h-9 rounded-[4px] px-3 text-[14px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent"
                                    style={FieldStyle}
                                />
                            </div>
                            <div>
                                <label className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                    Last name
                                </label>
                                <input
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder="Enter last name"
                                    required
                                    className="w-full h-9 rounded-[4px] px-3 text-[14px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent"
                                    style={FieldStyle}
                                />
                            </div>
                        </div>
                        <div>
                            <PrimaryButton accentColor={accentColor} disabled={loading} icon="fa-save" type="submit">
                                Save changes
                            </PrimaryButton>
                        </div>
                    </form>
                </Card>
            </section>

            <section id="scope" className="scroll-mt-4">
                <Card>
                    <CardHeader title="Scope" description="Region and plant assignments" />
                    <div className="px-5">
                        <DetailRow label="Email" value={email || 'Not set'} />
                        {userRole && <DetailRow label="Role" value={userRole} />}
                        <div className="flex items-center justify-between py-2 border-b border-border-light">
                            <span className="text-[13px] text-text-secondary">Region</span>
                            <div className="relative">
                                <select
                                    value={preferences.selectedRegion?.code || ''}
                                    onChange={onChangeRegion}
                                    disabled={!regionsLoaded}
                                    className="appearance-none h-9 rounded-[4px] pl-3 pr-9 text-[13px] font-medium cursor-pointer outline-none transition-colors duration-150 hover:bg-bg-hover focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                                    style={FieldStyle}
                                >
                                    {permittedRegions.map((r) => (
                                        <option
                                            key={r.regionCode || r.region_code}
                                            value={r.regionCode || r.region_code}
                                        >
                                            {r.regionName || r.region_name || ''}
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                    <i className="fas fa-chevron-down text-[10px] text-text-tertiary" />
                                </div>
                            </div>
                        </div>
                        {plantCode && <DetailRow label="Plant code" value={plantCode} mono />}
                        {additionalPlants.length > 0 && (
                            <div className="flex items-center justify-between gap-4 py-3">
                                <span className="text-[13px] text-text-secondary">Additional plants</span>
                                <span className="font-mono text-[13px] tabular-nums text-text-primary">
                                    {additionalPlants.join(', ')}
                                </span>
                            </div>
                        )}
                    </div>
                </Card>
            </section>
        </>
    )
}
