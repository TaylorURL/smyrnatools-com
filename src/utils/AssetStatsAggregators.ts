/**
 * Aggregators behind the asset Statistics page, entered through
 * `useAssetStatistics`. Each one is a pure rollup over an already-scoped asset
 * list — no React, no fetches, no side effects — so the hook owns memoization
 * and the math stays testable on plain arrays.
 *
 * Implementations are split across the modules re-exported here, one per
 * section of the page; callers import from this barrel so a function can move
 * between sections without touching an import site.
 */

export * from './AssetStatsFleet'
export * from './AssetStatsOperations'
export * from './AssetStatsScope'
export * from './AssetStatsService'
