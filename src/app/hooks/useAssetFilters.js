import { useEffect, useMemo, useState } from 'react'

/** Creates a debounced wrapper that delays invocation until after `delay` ms of inactivity. */
function debounce(fn, delay) {
    let timer = null
    return (...args) => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => fn(...args), delay)
    }
}

/**
 * Owns the filter, sort, and search state for AssetView. Applying it to the
 * data is useAssetFilteredResult's job.
 *
 * Filters seed from the user's persisted preferences, except when `embedded`:
 * an asset list rendered inside another view starts from a clean slate so it
 * shows the set its host asked for rather than whatever the user last left on
 * the standalone page. Sort state is per-visit either way.
 */
export default function useAssetFilters({
    config,
    embedded,
    initialSearch,
    preferences,
    savedFilters,
    updateFilterRef
}) {
    const [extraTypeFilter, setExtraTypeFilter] = useState(() => {
        if (embedded) return ''
        return savedFilters?.equipmentTypeFilter || savedFilters?.typeFilter || ''
    })
    const [freightFilter, setFreightFilter] = useState(() => {
        if (embedded) return ''
        return savedFilters?.freightFilter || ''
    })
    const [searchInput, setSearchInput] = useState(() => {
        if (initialSearch) return initialSearch
        if (embedded) return ''
        return savedFilters?.searchText || ''
    })
    const [searchText, setSearchText] = useState(() => {
        if (initialSearch) return initialSearch
        if (embedded) return ''
        return savedFilters?.searchText || ''
    })
    const [selectedPlant, setSelectedPlant] = useState(() => {
        if (embedded) return ''
        return savedFilters?.selectedPlant || ''
    })
    const [sortDirection, setSortDirection] = useState('asc')
    const [sortKey, setSortKey] = useState('')
    const [statusFilter, setStatusFilter] = useState(() => {
        if (embedded) return ''
        return savedFilters?.statusFilter || ''
    })
    const [viewMode, setViewMode] = useState(() => {
        if (embedded) return 'list'
        if (savedFilters?.viewMode != null) return savedFilters.viewMode
        if (preferences.defaultViewMode != null) return preferences.defaultViewMode
        return localStorage.getItem(config.viewModeStorageKey) || 'grid'
    })

    // A search handed in by the host wins over the seeded state, and it can
    // arrive after mount, so it is re-applied whenever it changes rather than
    // only in the initializers above.
    useEffect(() => {
        if (!initialSearch) return
        const timer = setTimeout(() => {
            setSearchText(initialSearch)
            setSearchInput(initialSearch)
        }, 100)
        return () => clearTimeout(timer)
    }, [initialSearch])

    // The debounced setter must keep its identity for the lifetime of the
    // hook: the pending timer lives inside the closure, so rebuilding it would
    // drop the keystroke that is still waiting to commit and persist.
    const debouncedSetSearchText = useMemo(
        () =>
            debounce((value) => {
                setSearchText(value)
                updateFilterRef.current?.('searchText', value)
            }, 300),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    )

    function handleViewModeChange(mode) {
        if (viewMode === mode) return
        setViewMode(mode)
        updateFilterRef.current?.('viewMode', mode)
        localStorage.setItem(config.viewModeStorageKey, mode)
    }

    function handleHeaderClick(label) {
        if (sortKey === label) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
        } else {
            setSortKey(label)
            setSortDirection('asc')
        }
    }

    const showReset =
        searchText ||
        selectedPlant ||
        (statusFilter && statusFilter !== 'All Statuses' && statusFilter !== '') ||
        freightFilter ||
        extraTypeFilter

    return {
        debouncedSetSearchText,
        extraTypeFilter,
        freightFilter,
        handleHeaderClick,
        handleViewModeChange,
        searchInput,
        searchText,
        selectedPlant,
        setExtraTypeFilter,
        setFreightFilter,
        setSearchInput,
        setSearchText,
        setSelectedPlant,
        setStatusFilter,
        setViewMode,
        showReset,
        sortDirection,
        sortKey,
        statusFilter,
        viewMode
    }
}
