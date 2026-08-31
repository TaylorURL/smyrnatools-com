/* Compatibility barrel so `PlanUtility` imports resolve; getTodayDate is the
 * only helper it exposes. */

export { getTodayDate } from './plan/planTime'
