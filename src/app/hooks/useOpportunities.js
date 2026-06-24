import { useCallback, useEffect, useRef, useState } from 'react'

import CrmService from '../../services/CrmService'

/**
 * Manages opportunities for a single account (detail view) or the full open
 * pipeline (board mode). Returns stable action callbacks so consumers never
 * need to re-subscribe on every render.
 *
 * @param {object} [options]
 * @param {string} [options.accountId] - Load by account when set.
 * @param {boolean} [options.boardMode] - When true, fetches all open opportunities.
 * @returns {{ opportunities, isLoading, error, reload, save, move, materialize, remove }}
 */
export function useOpportunities({ accountId, boardMode } = {}) {
    const [opportunities, setOpportunities] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const mounted = useRef(true)

    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])

    const load = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const fetchOptions = boardMode ? { openOnly: true } : { accountId }
            const data = await CrmService.fetchOpportunities(fetchOptions)
            if (mounted.current) setOpportunities(data)
        } catch (err) {
            if (mounted.current) setError(err?.message || 'Failed to load opportunities')
        } finally {
            if (mounted.current) setIsLoading(false)
        }
    }, [accountId, boardMode])

    useEffect(() => {
        load()
    }, [load])

    const save = useCallback(
        async (payload) => {
            const saved = await CrmService.saveOpportunity(payload)
            if (mounted.current) load()
            return saved
        },
        [load]
    )

    /**
     * Move an opportunity to a new stage, materializing it first if it is virtual.
     *
     * @param {object} opp - The full opportunity object (virtual or real).
     * @param {string} targetStage - The destination stage id.
     * @param {string} [lostReason] - Required when targetStage is 'lost'.
     */
    const move = useCallback(
        async (opp, targetStage, lostReason) => {
            if (opp.virtual) {
                await CrmService.saveOpportunity({
                    accountId: opp.account_id,
                    ownerUserId: opp.owner_user_id,
                    source: opp.source,
                    stage: targetStage,
                    title: opp.title
                })
            } else {
                await CrmService.moveStage(opp.id, targetStage, lostReason)
            }
            if (mounted.current) load()
        },
        [load]
    )

    /**
     * Materialize a virtual card in place (its current stage), used when the
     * card has no higher stage to move to (e.g. a `won` suggestion).
     *
     * @param {object} opp - The virtual opportunity object.
     */
    const materialize = useCallback(
        async (opp) => {
            await CrmService.saveOpportunity({
                accountId: opp.account_id,
                ownerUserId: opp.owner_user_id,
                source: opp.source,
                stage: opp.stage,
                title: opp.title
            })
            if (mounted.current) load()
        },
        [load]
    )

    return { error, isLoading, materialize, move, opportunities, save }
}
