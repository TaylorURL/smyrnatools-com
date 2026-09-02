/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { useIsMobile } from '../../hooks/useIsMobile'

const DEFAULT_GRID_COUNT = 8
const DEFAULT_LIST_COUNT = 10
const SKELETON_ROW_WIDTHS = ['60%', '40%', '50%', '70%', '45%']
const MOBILE_DETAIL_ROW_COUNT = 3
const STAGGER_MS = 60

function SkeletonAssetCard({ compact }) {
    const rows = compact ? SKELETON_ROW_WIDTHS.slice(0, MOBILE_DETAIL_ROW_COUNT) : SKELETON_ROW_WIDTHS
    return (
        <div className="relative overflow-hidden rounded-card border border-border-light bg-bg-secondary shadow-sm">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-card bg-bg-tertiary animate-pulse-slow motion-reduce:animate-none" />
            <div className={compact ? 'p-5' : 'p-8'}>
                <div className={`${compact ? 'mb-4 pb-3' : 'mb-7 pb-4'} border-b border-border-light`}>
                    <div
                        className={`${compact ? 'h-5' : 'h-6'} w-3/5 rounded-md bg-bg-tertiary animate-pulse-slow motion-reduce:animate-none mb-2`}
                    />
                    <div
                        className={`${compact ? 'h-3.5' : 'h-4'} w-2/5 rounded-md bg-bg-tertiary animate-pulse-slow motion-reduce:animate-none`}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    {rows.map((width, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between py-2 border-b border-border-light last:border-b-0"
                        >
                            <div className="h-3.5 w-20 rounded-md bg-bg-tertiary animate-pulse-slow motion-reduce:animate-none" />
                            <div
                                className="h-3.5 rounded-md bg-bg-tertiary animate-pulse-slow motion-reduce:animate-none"
                                style={{ width }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function SkeletonAssetRow({ columnCount, isEven, compact }) {
    return (
        <tr className={isEven ? 'bg-bg-primary' : 'bg-bg-secondary'}>
            {Array.from({ length: columnCount }, (_, index) => (
                <td key={index} className={`border-b border-border-light ${compact ? 'px-2 py-2.5' : 'py-5 px-4'}`}>
                    <div
                        className={`${compact ? 'h-3' : 'h-3.5'} rounded-md bg-bg-tertiary animate-pulse-slow motion-reduce:animate-none`}
                        style={{ minWidth: '40px', width: `${45 + ((index * 17) % 40)}%` }}
                    />
                </td>
            ))}
        </tr>
    )
}

/** Placeholder for the asset views, shaped like whichever mode is about to
 *  render: AssetGridCard's proportions in grid mode, the list table's rows in
 *  list mode, down to the same mobile min-width so neither jumps on load. */
export default function AssetListSkeleton({ viewMode, count, columnCount = 8 }) {
    const isMobile = useIsMobile()
    if (viewMode === 'list') {
        const rowCount = count ?? DEFAULT_LIST_COUNT
        return (
            <div
                role="status"
                aria-live="polite"
                aria-busy="true"
                className={`${isMobile ? 'mx-1 mt-3' : 'mx-6 mt-8'} mb-6 overflow-x-auto`}
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                <span className="sr-only">Loading…</span>
                <div
                    className={`overflow-hidden rounded-card border border-border-light bg-bg-primary ${isMobile ? 'min-w-[1100px]' : 'w-full'}`}
                >
                    <table className="w-full border-collapse">
                        <tbody>
                            {Array.from({ length: rowCount }, (_, index) => (
                                <SkeletonAssetRow
                                    key={index}
                                    columnCount={columnCount}
                                    isEven={index % 2 === 0}
                                    compact={isMobile}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }
    const cardCount = count ?? (isMobile ? 4 : DEFAULT_GRID_COUNT)
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="block w-full max-w-[100vw] overflow-auto overflow-x-hidden overscroll-none mb-6 max-h-[calc(100vh-250px)] supports-[height:1dvh]:max-h-[calc(100dvh-250px)]"
        >
            <span className="sr-only">Loading…</span>
            <div
                className={`grid ${isMobile ? 'gap-3 p-3' : 'gap-4 p-4'}`}
                style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '260px' : '300px'}, 1fr))` }}
            >
                {Array.from({ length: cardCount }, (_, index) => (
                    <div key={index} style={{ animationDelay: `${index * STAGGER_MS}ms`, animationFillMode: 'both' }}>
                        <SkeletonAssetCard compact={isMobile} />
                    </div>
                ))}
            </div>
        </div>
    )
}
