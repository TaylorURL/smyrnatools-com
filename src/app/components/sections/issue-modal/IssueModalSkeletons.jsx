import React from 'react'

import Skeleton, { SkeletonStack } from '../../common/Skeleton'

/** Stand-in for the recipient field while the team list loads. */
export function RecipientFieldSkeleton() {
    return (
        <SkeletonStack count={1} gapClassName="gap-0">
            {() => <Skeleton className="h-9 w-full" rounded="rounded-[4px]" />}
        </SkeletonStack>
    )
}

/** Stand-in for one ruled issue row: severity bar, the text, then severity,
 *  author and time, with the row actions on the right. */
export function IssueRowSkeleton() {
    return (
        <div className="flex items-start gap-3 border-b border-border-light px-6 py-3.5">
            <Skeleton className="h-12 w-1 shrink-0" rounded="rounded-[2px]" />
            <div className="min-w-0 flex-1">
                <Skeleton className="mb-1.5 h-3 w-full" />
                <Skeleton className="mb-2 h-3 w-4/5" />
                <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-12" rounded="rounded-[3px]" />
                    <Skeleton className="h-3 w-28" />
                </div>
            </div>
            <div className="flex shrink-0 gap-2">
                <Skeleton className="h-3.5 w-12" />
                <Skeleton className="h-3.5 w-12" />
            </div>
        </div>
    )
}
