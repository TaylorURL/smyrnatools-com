import { useCallback, useState } from 'react'

import { ListService } from '../../services/ListService'
import { UserService } from '../../services/UserService'

/**
 * Owns the multi-select state and every bulk operation (complete, delete,
 * update status, update priority). Each action mutates via ListService and
 * clears the selection on completion so the floating action bar dismisses.
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

    const bulkToggleCompletion = useCallback(
        async (markComplete) => {
            if (!selectedIds.size) return
            const user = await UserService.getCurrentUser()
            if (!user?.id) return
            const itemsById = new Map(ListService.listItems.map((i) => [i.id, i]))
            for (const id of selectedIds) {
                const item = itemsById.get(id)
                if (!item || (markComplete ? item.completed : !item.completed)) continue
                try {
                    await ListService.toggleCompletion(item, user.id)
                } catch {}
            }
            setSelectedIds(new Set())
        },
        [selectedIds]
    )

    const requestBulkDelete = useCallback(() => {
        if (!selectedIds.size) return
        setShowDeleteConfirm(true)
    }, [selectedIds])

    const confirmBulkDelete = useCallback(async () => {
        setShowDeleteConfirm(false)
        for (const id of selectedIds) {
            try {
                await ListService.deleteListItem(id)
            } catch {}
        }
        setSelectedIds(new Set())
    }, [selectedIds])

    const cancelBulkDelete = useCallback(() => setShowDeleteConfirm(false), [])

    const bulkUpdateStatus = useCallback(
        async (newStatus) => {
            const itemsById = new Map(ListService.listItems.map((i) => [i.id, i]))
            for (const id of selectedIds) {
                const item = itemsById.get(id)
                if (!item || item.status === newStatus) continue
                try {
                    await ListService.updateListItem({ ...item, status: newStatus })
                } catch {}
            }
            setSelectedIds(new Set())
        },
        [selectedIds]
    )

    const bulkUpdatePriority = useCallback(
        async (newPriority) => {
            const itemsById = new Map(ListService.listItems.map((i) => [i.id, i]))
            for (const id of selectedIds) {
                const item = itemsById.get(id)
                if (!item || item.priority === newPriority) continue
                try {
                    await ListService.updateListItem({ ...item, priority: newPriority })
                } catch {}
            }
            setSelectedIds(new Set())
        },
        [selectedIds]
    )

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
