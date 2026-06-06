import { describe, expect, it } from 'vitest'

import { PLAN_META_KEY } from '../../app/constants/planConstants'
import { reconcileLoadedProduction } from '../PlanDataUtility'

const meta = { saturdayCounts: { 401: 2 } }
const block = (orders) => ({ firstJobTime: '', lastJobTime: '', orders, totalYardage: '' })
const ids = (production, code) => production[code].orders.map((o) => o.orderId)

describe('reconcileLoadedProduction', () => {
    it('uses the full saved blob before dispatch has synced (initial render / past dates)', () => {
        const loaded = { 401: block([{ orderId: '1' }]), [PLAN_META_KEY]: meta }
        expect(reconcileLoadedProduction(loaded, {}, false)).toEqual(loaded)
    })

    it('keeps live dispatch orders and applies only saved _meta once dispatch has synced', () => {
        // Dispatch is authoritative and has order 2 only; the saved row still
        // carries phantom order 1 (a job since moved to another day).
        const current = { 401: block([{ orderId: '2' }]) }
        const loaded = { 401: block([{ orderId: '1' }, { orderId: '2' }]), [PLAN_META_KEY]: meta }

        const result = reconcileLoadedProduction(loaded, current, true)

        expect(ids(result, '401')).toEqual(['2']) // phantom 1 NOT reintroduced
        expect(result[PLAN_META_KEY]).toEqual(meta) // saved _meta applied over live orders
    })

    it('drops _meta when the saved row has none (dispatch synced)', () => {
        const current = { 401: block([{ orderId: '2' }]), [PLAN_META_KEY]: { stale: true } }
        const loaded = { 401: block([{ orderId: '1' }]) }

        const result = reconcileLoadedProduction(loaded, current, true)

        expect(result[PLAN_META_KEY]).toBeUndefined()
        expect(ids(result, '401')).toEqual(['2'])
    })

    it('tolerates nullish inputs', () => {
        expect(reconcileLoadedProduction(null, null, false)).toEqual({})
        expect(reconcileLoadedProduction(undefined, { 401: block([]) }, true)).toEqual({ 401: block([]) })
    })
})
