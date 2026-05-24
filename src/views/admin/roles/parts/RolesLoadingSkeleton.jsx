import React from 'react'

import Skeleton, { SkeletonStack } from '../../../../app/components/common/Skeleton'

const SKELETON_ROLE_COUNT = 6

/** Initial-load placeholder shown until role data arrives. */
const RolesLoadingSkeleton = () => (
    <div className="min-h-screen bg-slate-50 p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <SkeletonStack count={SKELETON_ROLE_COUNT} gapClassName="gap-3">
            {() => (
                <div className="rounded border border-border-light bg-white p-4">
                    <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10" rounded="rounded" />
                        <div className="flex-1">
                            <Skeleton className="h-4 w-40 mb-1.5" />
                            <div className="flex gap-1.5">
                                <Skeleton className="h-3.5 w-12" rounded="rounded" />
                                <Skeleton className="h-3.5 w-16" rounded="rounded" />
                                <Skeleton className="h-3.5 w-20" rounded="rounded" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </SkeletonStack>
    </div>
)

export default RolesLoadingSkeleton
