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

/** Stand-in for one ruled issue row: severity, author and time, then the text. */
export function IssueRowSkeleton() {
    return (
        <div className="flex items-start gap-3 border-b border-border-light px-6 py-3">
            <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                    <Skeleton className="h-5 w-16" rounded="rounded-[3px]" />
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="mb-1.5 h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
            </div>
            <div className="flex shrink-0 gap-1">
                <Skeleton className="h-8 w-8" rounded="rounded-[4px]" />
                <Skeleton className="h-8 w-8" rounded="rounded-[4px]" />
            </div>
        </div>
    )
}
