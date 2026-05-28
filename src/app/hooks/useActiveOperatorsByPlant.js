import { useEffect, useMemo, useState } from 'react'

import { OperatorService } from '../../services/OperatorService'

/**
 * All active operators grouped by their rostered plant code. One fetch,
 * grouped client-side, so the clock-in board can name and order each plant's
 * crew by current weekly hours without a per-plant request. Failures resolve
 * to an empty map so the board falls back to its numbered-slot behaviour.
 */
export default function useActiveOperatorsByPlant() {
    const [operators, setOperators] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        setIsLoading(true)
        OperatorService.fetchActiveOperators()
            .then((rows) => {
                if (!cancelled) setOperators(Array.isArray(rows) ? rows : [])
            })
            .catch(() => {
                if (!cancelled) setOperators([])
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [])

    const operatorsByPlant = useMemo(() => {
        const map = new Map()
        for (const operator of operators) {
            const code = operator?.plantCode
            if (!code) continue
            if (!map.has(code)) map.set(code, [])
            map.get(code).push(operator)
        }
        return map
    }, [operators])

    return { isLoading, operatorsByPlant }
}
