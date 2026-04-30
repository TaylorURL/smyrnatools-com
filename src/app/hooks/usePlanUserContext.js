import { useEffect, useState } from 'react'

import { UserService } from '../../services/UserService'

const EMPTY_CONTEXT = {
    canSeeYourTab: false,
    hasDefaultPlantPermission: false,
    userPlantCode: '',
    userRoleNames: []
}

/**
 * Resolve the signed-in user's plant assignment, role names, and the two
 * Plan-specific permissions the dashboard cares about:
 *
 *  - `plan.yourtab` → unlocks the role-aware "Your Plant / District /
 *    Region" section on the dashboard.
 *  - `plan.defaultplant` → defaults the realtime tab's plant filter to the
 *    user's home plant on first load.
 *
 * All four lookups run in parallel; failures fall back to the empty/false
 * default so a flaky single endpoint can't blank the whole UI.
 *
 * @param {string|null} userId - Authenticated user id, or null while loading.
 * @returns {{ userPlantCode: string, userRoleNames: string[],
 *             canSeeYourTab: boolean, hasDefaultPlantPermission: boolean }}
 */
export function usePlanUserContext(userId) {
    const [context, setContext] = useState(EMPTY_CONTEXT)

    useEffect(() => {
        if (!userId) {
            setContext(EMPTY_CONTEXT)
            return undefined
        }
        let cancelled = false
        Promise.all([
            UserService.getUserPlant(userId).catch(() => null),
            UserService.getUserRoles(userId).catch(() => []),
            UserService.hasPermission(userId, 'plan.yourtab').catch(() => false),
            UserService.hasPermission(userId, 'plan.defaultplant').catch(() => false)
        ]).then(([plantCode, roles, canSee, hasDefaultPlant]) => {
            if (cancelled) return
            setContext({
                canSeeYourTab: !!canSee,
                hasDefaultPlantPermission: !!hasDefaultPlant,
                userPlantCode: plantCode || '',
                userRoleNames: (roles || []).map((r) => r?.name).filter(Boolean)
            })
        })
        return () => {
            cancelled = true
        }
    }, [userId])

    return context
}
