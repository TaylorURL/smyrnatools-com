import { useCallback, useEffect, useRef, useState } from 'react'

import CrmService from '../../services/CrmService'

/** Backs the CRM tab: a scoped account roster plus a lazily-loaded,
 *  per-account interaction cache with optimistic interaction logging. */
export function useCrm({ scope = 'all' } = {}) {
    const [roster, setRoster] = useState([])
    const [interactionsByAccount, setInteractionsByAccount] = useState({})
    const mounted = useRef(true)

    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])

    const loadRoster = useCallback(async () => {
        try {
            const data = await CrmService.fetchRoster({ includeActive: true, scope })
            if (mounted.current) setRoster(data)
        } catch {
            /* roster failures fall back to an empty list — surfaced via the
             * useCrmRoster path which owns user-visible error state. */
        }
    }, [scope])

    useEffect(() => {
        loadRoster()
    }, [loadRoster])

    const loadInteractions = useCallback(
        async (accountId, { force = false } = {}) => {
            if (!accountId || (!force && interactionsByAccount[accountId])) return
            try {
                const data = await CrmService.fetchInteractions({ accountId })
                if (mounted.current) setInteractionsByAccount((p) => ({ ...p, [accountId]: data }))
            } catch {
                if (mounted.current) setInteractionsByAccount((p) => ({ ...p, [accountId]: [] }))
            }
        },
        [interactionsByAccount]
    )

    const logInteraction = useCallback(async (payload) => {
        const saved = await CrmService.logInteraction(payload)
        if (saved && mounted.current) {
            setInteractionsByAccount((p) => ({
                ...p,
                [payload.accountId]: [saved, ...(p[payload.accountId] ?? [])]
            }))
        }
        return saved
    }, [])

    return {
        interactionsByAccount,
        loadInteractions,
        logInteraction,
        roster
    }
}
