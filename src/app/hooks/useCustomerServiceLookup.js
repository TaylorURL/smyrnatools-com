import { useEffect, useState } from 'react'

// No data source backs per-customer service verdicts, so the lookup resolves
// to a fixed empty result: no orders, no aggregate, and never loading or
// failing. Consumers can treat it as a settled lookup that found nothing.

const EMPTY_STATE = {
    aggregate: null,
    error: null,
    isLoading: false,
    orders: []
}

export function useCustomerServiceLookup() {
    const [state] = useState(EMPTY_STATE)
    useEffect(() => {}, [])
    return state
}

export default useCustomerServiceLookup
