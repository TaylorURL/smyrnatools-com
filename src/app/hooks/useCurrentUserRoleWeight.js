import { useEffect, useState } from 'react'

import { UserService } from '../../services/UserService'
import { useAuth } from '../context/AuthContext'

/**
 * Resolves the current user's highest role weight — the integer the rest
 * of the app gates sensitive features on (compensation visibility, admin
 * surfaces, etc.). Returns `0` when signed out or while the underlying
 * fetch is still in flight, so callers can safely render against the
 * worst case (least-privileged view) on first paint.
 *
 * Centralised so every gate reads from a single source — the duplicated
 * "fetch highest role, store weight in local state" pattern across
 * ManagerDetailView / Dashboard / MyAccount stays out of the page files.
 */
export default function useCurrentUserRoleWeight() {
    const { user } = useAuth() || {}
    const [roleWeight, setRoleWeight] = useState(0)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        if (!user?.id) {
            setRoleWeight(0)
            setIsLoading(false)
            return
        }
        setIsLoading(true)
        ;(async () => {
            try {
                const highestRole = await UserService.getHighestRole(user.id)
                if (!cancelled) setRoleWeight(Number(highestRole?.weight) || 0)
            } catch {
                if (!cancelled) setRoleWeight(0)
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [user?.id])

    return { isLoading, roleWeight }
}
