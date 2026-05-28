import { useCallback, useState } from 'react'

import { ListService } from '../../services/ListService'
import { UserService } from '../../services/UserService'

/**
 * Owns the multi-select state and every bulk operation (complete, delete,
 * update status, update priority). Mutations fire in parallel via Promise.all
 * so a 20-item bulk action lands as 20 concurrent requests instead of 20
 * sequential ones. Each underlying ListService method already patches the
 * local cache optimistically, so the floating action bar dismisses
 * immediately and rows reflect the new state before the network confirms.
 */
export function useListBulkActions() {
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    const toggleSelect = useCallback(
        (id) =>
            setSelectedIds((prev) => {
                const next = new Set(prev)
                next.has(id) ? next.delete(id) : next.add(id)
                return next
            }),
        []
    )

    const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

    const runForSelected = useCallback(async (ids, runner) => {
        const settled = await Promise.allSettled(Array.from(ids).map(runner))
        return settled.filter((s) => s.status === 'rejected').length
    }, [])

    const bulkToggleCompletion = useCallback(
        async (markComplete) => {
            if (!selectedIds.size) return
            const user = await UserService.getCurrentUser()
            if (!user?.id) return
            const itemsById = new Map(ListService.listItems.map((i) => [i.id, i]))
            const targets = []
            for (const id of selectedIds) {
                const item = itemsById.get(id)
                if (!item) continue
                if (markComplete && item.completed) continue
                if (!markComplete && !item.completed) continue
                targets.push(item)
            }
            setSelectedIds(new Set())
            await runForSelected(
                targets.map((t) => t.id),
                (id) => {
                    const item = itemsById.get(id)
                    return item ? ListService.toggleCompletion(item, user.id).catch(() => null) : null
                }
            )
        },
        [selectedIds, runForSelected]
    )

    const requestBulkDelete = useCallback(() => {
        if (!selectedIds.size) return
        setShowDeleteConfirm(true)
    }, [selectedIds])

    const confirmBulkDelete = useCallback(async () => {
        setShowDeleteConfirm(false)
        const ids = Array.from(selectedIds)
        setSelectedIds(new Set())
        await runForSelected(ids, (id) => ListService.deleteListItem(id).catch(() => null))
    }, [selectedIds, runForSelected])

    const cancelBulkDelete = useCallback(() => setShowDeleteConfirm(false), [])

    const bulkUpdateField = useCallback(
        async (field, newValue) => {
            const itemsById = new Map(ListService.listItems.map((i) => [i.id, i]))
            const targets = []
            for (const id of selectedIds) {
                const item = itemsById.get(id)
                if (!item || item[field] === newValue) continue
                targets.push(item)
            }
            setSelectedIds(new Set())
            await runForSelected(
                targets.map((t) => t.id),
                (id) => {
                    const item = itemsById.get(id)
                    return item ? ListService.updateListItem({ ...item, [field]: newValue }).catch(() => null) : null
                }
            )
        },
        [selectedIds, runForSelected]
    )

    const bulkUpdateStatus = useCallback((newStatus) => bulkUpdateField('status', newStatus), [bulkUpdateField])
    const bulkUpdatePriority = useCallback((newPriority) => bulkUpdateField('priority', newPriority), [bulkUpdateField])

    return {
        bulkToggleCompletion,
        bulkUpdatePriority,
        bulkUpdateStatus,
        cancelBulkDelete,
        clearSelection,
        confirmBulkDelete,
        requestBulkDelete,
        selectedIds,
        showDeleteConfirm,
        toggleSelect
    }
}
