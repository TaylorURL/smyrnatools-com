import { useCallback, useState } from 'react'

import { Database } from '../../services/DatabaseService'
import { getDisplayNameFromProfile } from '../../utils/ReportsDataUtility'

/**
 * Owns the `users_profiles` lookup map used to label submitters across the
 * reports view. Exposes `fetchProfilesFor` to lazily hydrate missing ids and
 * `getUserName` for display, plus the underlying `userProfiles` map.
 */
export function useReportsUserProfiles() {
    const [userProfiles, setUserProfiles] = useState({})

    const fetchProfilesFor = useCallback(
        async (userIds) => {
            const missing = userIds.filter((id) => !userProfiles[id])
            if (missing.length === 0) return
            const { data: profiles, error } = await Database.from('users_profiles')
                .select('id, first_name, last_name')
                .in('id', missing)
            if (!error && Array.isArray(profiles)) {
                setUserProfiles((prev) => ({
                    ...prev,
                    ...profiles.reduce((map, p) => ({ ...map, [p.id]: p }), {})
                }))
            }
        },
        [userProfiles]
    )

    const getUserName = useCallback((userId) => getDisplayNameFromProfile(userProfiles[userId], userId), [userProfiles])

    return { fetchProfilesFor, getUserName, userProfiles }
}
