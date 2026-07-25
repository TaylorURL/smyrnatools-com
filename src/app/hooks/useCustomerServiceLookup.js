import { useEffect, useState } from 'react'

/* Deliberate no-op: there is no data source behind per-customer service
 * verdicts right now. It returns the empty shape <CustomerServiceContext>
 * expects, so the Call List card falls through to its "No measured service
 * history" state instead of erroring. Wire a real source in here when one
 * exists — no caller needs to change. */

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
