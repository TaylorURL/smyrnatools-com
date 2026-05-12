import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { usePreferences } from '../../context/PreferencesContext'
import { useIsMobile } from '../../hooks/useIsMobile'
import PlantDropdownModal from '../common/PlantDropdownModal'
import PlantFilterButton from '../ui/PlantFilterButton'

/** Default column header labels for asset list views. */
const DEFAULT_LIST_LABELS = ['Plant', 'Truck #', 'Status', 'Operator', 'Cleanliness', 'VIN', 'Verified', 'More']
/** Default column widths matching DEFAULT_LIST_LABELS. */
const DEFAULT_COL_WIDTHS = ['10%', '12%', '12%', '18%', '12%', '18%', '10%', '8%']

/* ── Visual atoms — flat, Plan-tab aesthetic ────────────────────────── */

const BADGE_PILL_TINTS = {
    Active: '#16a34a',
    'Due Soon': '#d97706',
    OK: '#16a34a',
    Overdue: '#dc2626',
    Shop: '#dc2626',
    Spare: '#7c3aed',
    Total: '#475569',
    Unassigned: '#a16207'
}

/** Inline badge — parses "X Label · Y Label" into a row of compact pills. */
const Badge = ({ children, onClick, onPillClick, accentColor }) => {
    const text = typeof children === 'string' ? children : ''
    const parts = text.split('·').map((s) => s.trim())
    const parsed = parts
        .map((p) => {
            const match = p.match(/^(\d+)\s+(.+)$/)
            return match ? { count: match[1], label: match[2] } : null
        })
        .filter(Boolean)

    if (parsed.length >= 2) {
        return (
            <div className="flex items-center gap-1 flex-wrap">
                {parsed.map(({ count, label }) => {
                    const tint = BADGE_PILL_TINTS[label]
                    if (!tint) return null
                    const num = parseInt(count, 10)
                    const isZeroVariant = label === 'Unassigned' && num === 0
                    const color = isZeroVariant ? '#64748b' : tint
                    const clickHandler = onPillClick ? () => onPillClick(label) : onClick
                    const Tag = clickHandler ? 'button' : 'span'
                    const clickProps = clickHandler ? { onClick: clickHandler, type: 'button' } : {}
                    return (
                        <Tag
                            key={label}
                            className={`inline-flex items-center gap-1 rounded text-[11px] font-semibold px-1.5 py-0.5${
                                clickHandler ? ' border-none cursor-pointer hover:brightness-95' : ''
                            }`}
                            style={{ background: `${color}14`, border: `1px solid ${color}30`, color }}
                            {...clickProps}
                        >
                            <span className="font-mono tabular-nums">{count}</span>
                            <span>{label}</span>
                        </Tag>
                    )
                })}
            </div>
        )
    }

    const Wrapper = onClick ? 'button' : 'span'
    const wrapperProps = onClick
        ? {
              className: 'border-none bg-transparent p-0 cursor-pointer',
              onClick,
              type: 'button'
          }
        : {}
    return (
        <Wrapper {...wrapperProps}>
            <span
                className="inline-flex items-center gap-1 rounded text-[11px] font-semibold px-1.5 py-0.5"
                style={{ background: `${accentColor}14`, border: `1px solid ${accentColor}30`, color: accentColor }}
            >
                {children}
            </span>
        </Wrapper>
    )
}

/** Search input — flat, single-row, matches Plan-tab filter styling. */
const SearchInput = ({ value, onChange, onClear, placeholder, className = '' }) => (
    <div className={`relative ${className}`} role="search">
        <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-text-tertiary" />
        <input
            type="text"
            className="w-full text-[12.5px] outline-none rounded py-1.5 pl-8 pr-7 bg-bg-secondary border border-border-light text-text-primary"
            placeholder={placeholder}
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            aria-label="Search"
        />
        {value && onClear && (
            <button
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded text-[10px] cursor-pointer border-none bg-bg-tertiary text-text-secondary"
                onClick={onClear}
                type="button"
                aria-label="Clear search"
            >
                <i className="fas fa-times" />
            </button>
        )}
    </div>
)

/** Action button — flat. `primary` is the accent-color CTA, `subtle` is bg-secondary. */
const ActionButton = ({ icon, label, onClick, variant = 'subtle', accentColor }) => {
    const isPrimary = variant === 'primary'
    return (
        <button
            type="button"
            className="flex items-center gap-1.5 rounded text-[12px] font-semibold px-2.5 py-1.5 cursor-pointer border-none"
            style={{
                background: isPrimary ? accentColor : 'var(--bg-secondary)',
                border: isPrimary ? `1px solid ${accentColor}` : '1px solid var(--border-light)',
                color: isPrimary ? '#fff' : 'var(--text-primary)'
            }}
            onClick={onClick}
            aria-label={label}
        >
            {icon && <i className={`fas ${icon}`} />}
            {label && <span>{label}</span>}
        </button>
    )
}

/** Two-button list/grid view toggle — flat, no slate-100 frame. */
const ViewToggle = ({ viewMode, onChange, accentColor }) => (
    <div
        className="inline-flex items-center rounded overflow-hidden border border-border-light"
        role="group"
        aria-label="View mode"
    >
        {['list', 'grid'].map((mode) => {
            const isActive = viewMode === mode
            return (
                <button
                    key={mode}
                    type="button"
                    className="flex items-center justify-center w-7 h-7 text-[12px] cursor-pointer border-none"
                    style={{
                        background: isActive ? accentColor : 'var(--bg-secondary)',
                        color: isActive ? '#fff' : 'var(--text-secondary)'
                    }}
                    onClick={() => onChange?.(mode)}
                    aria-pressed={isActive}
                    aria-label={`${mode} view`}
                >
                    <i className={`fas ${mode === 'list' ? 'fa-list' : 'fa-th-large'}`} />
                </button>
            )
        })}
    </div>
)

/** Standard select — uses native browser chrome with var(--bg-secondary) styling. */
const FilterSelect = ({ value, options, onChange, ariaLabel, className = '' }) => (
    <select
        className={`text-[12px] cursor-pointer font-medium rounded py-1.5 pl-2 pr-7 ${className} bg-bg-secondary border border-border-light text-text-primary`}
        style={{ minWidth: 130 }}
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label={ariaLabel}
    >
        {options.map((opt) => (
            <option key={opt} value={opt === 'All Positions' || opt === 'All Freight' ? '' : opt}>
                {opt}
            </option>
        ))}
    </select>
)

// Trigger button extracted to `app/components/ui/PlantFilterButton` so all
// surfaces (TopSection, Reports, Plan tabs) render the exact same chip.

/** Reset filters button — square, flat. */
const ResetButton = ({ onClick }) => (
    <button
        type="button"
        className="flex items-center justify-center w-7 h-7 rounded text-[12px] cursor-pointer border-none bg-bg-secondary border border-border-light text-text-secondary"
        onClick={onClick}
        aria-label="Reset filters"
        title="Reset filters"
    >
        <i className="fas fa-undo" />
    </button>
)

/** List column header row — bg-tertiary, 10.5px uppercase tracked-wider, mono sort caret. */
const ListHeader = ({ labels, colWidths, sortKey, sortDirection, onHeaderClick, accentColor }) => (
    <div className="flex items-center -mx-4 px-4 mt-3 -mb-3 bg-bg-tertiary border-t border-border-light border-b border-border-light">
        {labels.map((label, index) => {
            const colWidth = colWidths[index] || 'auto'
            const isFlex = colWidth === 'flex' || colWidth === 'auto'
            const isActive = sortKey === label
            return (
                <button
                    key={label}
                    type="button"
                    className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider py-2 px-2 cursor-pointer select-none border-none bg-transparent"
                    style={{
                        ...(isFlex ? { flex: 1, minWidth: 0 } : { flexShrink: 0, width: colWidth }),
                        color: isActive ? accentColor : 'var(--text-secondary)',
                        textAlign: 'left'
                    }}
                    onClick={() => onHeaderClick?.(label)}
                >
                    <span>{label}</span>
                    {isActive && (
                        <i
                            className={`fas fa-sort-${sortDirection === 'asc' ? 'up' : 'down'} text-[9px]`}
                            style={{ color: accentColor }}
                        />
                    )}
                </button>
            )
        })}
    </div>
)

/** Mobile-only stacked view toggle. */
const MobileViewToggle = ({ viewMode, onChange, accentColor }) => (
    <div className="flex gap-2">
        {[
            { icon: 'fa-list', label: 'List', mode: 'list' },
            { icon: 'fa-th-large', label: 'Grid', mode: 'grid' }
        ].map(({ mode, icon, label }) => {
            const isActive = viewMode === mode
            return (
                <button
                    key={mode}
                    type="button"
                    className="flex items-center justify-center gap-1.5 flex-1 rounded text-[12px] font-semibold py-2 cursor-pointer"
                    style={{
                        background: isActive ? `${accentColor}14` : 'var(--bg-secondary)',
                        border: `1px solid ${isActive ? accentColor : 'var(--border-light)'}`,
                        color: isActive ? accentColor : 'var(--text-secondary)'
                    }}
                    onClick={() => onChange?.(mode)}
                    aria-label={`${label} view`}
                >
                    <i className={`fas ${icon}`} />
                    <span>{label}</span>
                </button>
            )
        })}
    </div>
)

const MobileFilterItem = ({ label, children, fullWidth = false }) => (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? 'col-span-2' : ''}`}>
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{label}</span>
        {children}
    </div>
)

/* ── Main ────────────────────────────────────────────────────────────── */

function TopSection({
    title,
    badge,
    onBadgeClick,
    onPillClick,
    onToggleSidebar,
    addButtonLabel,
    onAddClick,
    searchInput,
    onSearchInputChange,
    onClearSearch,
    searchPlaceholder,
    viewMode,
    onViewModeChange,
    plants,
    regionPlantCodes,
    selectedPlant,
    onSelectedPlantChange,
    statusFilter,
    statusOptions,
    onStatusFilterChange,
    freightFilter,
    freightOptions,
    onFreightFilterChange,
    showReset,
    onReset,
    forwardedRef,
    sticky = true,
    tightTop = false,
    positionFilter,
    positionOptions,
    onPositionFilterChange,
    hideViewModeToggle = false,
    listLabels,
    colWidths,
    customFilters,
    hidePlantFilter = false,
    hideSearchBar = false,
    onHeaderClick,
    sortKey,
    sortDirection,
    isOfficeRegion = false,
    customActions = null,
    customBottomContent = null,
    customBottomSkeleton = null,
    isLoading = false,
    userPlantCode = ''
}) {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'
    const isMobile = useIsMobile()
    const [isPlantModalOpen, setIsPlantModalOpen] = useState(false)
    const [showMobileFilters, setShowMobileFilters] = useState(false)
    const safePlants = Array.isArray(plants) ? plants : []
    const safeStatusOptions = Array.isArray(statusOptions) ? statusOptions : []
    const safePositionOptions = Array.isArray(positionOptions) ? positionOptions : []
    const safeFreightOptions = Array.isArray(freightOptions) ? freightOptions : []
    const safeListLabels = Array.isArray(listLabels) && listLabels.length > 0 ? listLabels : DEFAULT_LIST_LABELS
    const safeColWidths = Array.isArray(colWidths) && colWidths.length > 0 ? colWidths : DEFAULT_COL_WIDTHS
    const filteredPlants =
        isOfficeRegion || !regionPlantCodes || regionPlantCodes.size === 0
            ? safePlants
            : safePlants.filter((p) =>
                  regionPlantCodes.has(
                      String(p.plantCode || p.plant_code || '')
                          .trim()
                          .toUpperCase()
                  )
              )
    const selectedPlantObj = safePlants.find((p) => (p.plantCode || p.plant_code) === selectedPlant)
    const plantDisplayText = selectedPlant?.startsWith('DISTRICT:')
        ? selectedPlant.slice(9)
        : selectedPlant && selectedPlantObj
          ? `(${selectedPlantObj.plantCode || selectedPlantObj.plant_code}) ${selectedPlantObj.plantName || selectedPlantObj.plant_name}`
          : 'All Plants'

    useLayoutEffect(() => {
        if (!forwardedRef?.current) return
        const element = forwardedRef.current
        const updateHeight = () => {
            document.documentElement.style.setProperty('--top-section-height', `${element.offsetHeight}px`)
        }
        updateHeight()
        const resizeObserver = new ResizeObserver(updateHeight)
        resizeObserver.observe(element)
        return () => resizeObserver.disconnect()
    }, [forwardedRef])

    const sectionClasses = `${tightTop ? 'px-4 py-3' : 'px-4 lg:px-6 py-3'} ${sticky ? 'sticky top-0 z-50' : ''}`
    const sectionStyle = {
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-light)'
    }
    const wasLoadingRef = useRef(isLoading)
    const hasRevealedRef = useRef(false)
    const [revealControls, setRevealControls] = useState(false)
    const needsRevealRef = useRef(false)
    useEffect(() => {
        if (wasLoadingRef.current && !isLoading && !hasRevealedRef.current) {
            hasRevealedRef.current = true
            needsRevealRef.current = false
            setRevealControls(true)
            const timer = setTimeout(() => setRevealControls(false), 1200)
            return () => clearTimeout(timer)
        }
        if (isLoading && !hasRevealedRef.current) {
            needsRevealRef.current = true
        }
        wasLoadingRef.current = isLoading
    }, [isLoading])
    const hideRealContent = !hasRevealedRef.current && (isLoading || (needsRevealRef.current && !revealControls))

    const skeletonContent = (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
                <div className="h-5 w-40 rounded animate-pulse bg-bg-tertiary" />
                <div className="flex items-center gap-2">
                    <div className="h-7 w-20 rounded animate-pulse bg-bg-tertiary" />
                </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <div
                    className={`${isMobile ? 'flex-1 h-8' : 'h-8 min-w-[220px] max-w-[420px] flex-[0_1_auto]'} rounded animate-pulse bg-bg-tertiary`}
                />
                <div className="flex items-center gap-2 ml-auto">
                    <div className="h-7 w-16 rounded animate-pulse bg-bg-tertiary" />
                    <div className="h-7 w-28 rounded animate-pulse bg-bg-tertiary" />
                    <div className="h-7 w-32 rounded animate-pulse bg-bg-tertiary" />
                </div>
            </div>
            {customBottomSkeleton}
        </div>
    )

    if (isMobile) {
        return (
            <>
                <div
                    ref={forwardedRef}
                    className={sectionClasses}
                    style={sectionStyle}
                    data-section="top"
                    aria-label="Page controls"
                >
                    {hideRealContent && skeletonContent}
                    <div className="flex flex-col gap-3" style={hideRealContent ? { display: 'none' } : undefined}>
                        <div className="flex items-center justify-between gap-2">
                            <div
                                className={`flex items-center gap-2 min-w-0${revealControls ? ' animate-reveal-left' : ''}`}
                            >
                                <h1 className="text-[16px] font-bold m-0 truncate text-text-primary">{title}</h1>
                                {badge && (
                                    <Badge onClick={onBadgeClick} onPillClick={onPillClick} accentColor={accentColor}>
                                        {badge}
                                    </Badge>
                                )}
                            </div>
                            <div className={`flex items-center gap-2${revealControls ? ' animate-reveal-right' : ''}`}>
                                {customActions}
                                {onAddClick && (
                                    <ActionButton
                                        icon="fa-plus"
                                        label={addButtonLabel}
                                        onClick={onAddClick}
                                        variant="primary"
                                        accentColor={accentColor}
                                    />
                                )}
                                {onToggleSidebar && (
                                    <ActionButton
                                        icon="fa-bars"
                                        onClick={onToggleSidebar}
                                        variant="subtle"
                                        accentColor={accentColor}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {!hideSearchBar && (
                                <div className="flex-1">
                                    <SearchInput
                                        value={searchInput}
                                        onChange={onSearchInputChange}
                                        onClear={onClearSearch}
                                        placeholder={searchPlaceholder}
                                        className="w-full"
                                    />
                                </div>
                            )}
                            <button
                                type="button"
                                className="flex items-center justify-center w-8 h-8 rounded text-[12px] cursor-pointer"
                                style={{
                                    background: showMobileFilters ? `${accentColor}14` : 'var(--bg-secondary)',
                                    border: `1px solid ${showMobileFilters ? accentColor : 'var(--border-light)'}`,
                                    color: showMobileFilters ? accentColor : 'var(--text-secondary)'
                                }}
                                onClick={() => setShowMobileFilters(!showMobileFilters)}
                                aria-label="Toggle filters"
                            >
                                <i className="fas fa-filter" />
                            </button>
                        </div>
                        {showMobileFilters && (
                            <div className="rounded p-3 bg-bg-secondary border border-border-light">
                                <div className="grid grid-cols-2 gap-2.5">
                                    {viewMode && !hideViewModeToggle && (
                                        <MobileFilterItem label="View Mode" fullWidth>
                                            <MobileViewToggle
                                                viewMode={viewMode}
                                                onChange={onViewModeChange}
                                                accentColor={accentColor}
                                            />
                                        </MobileFilterItem>
                                    )}
                                    {!hidePlantFilter && (
                                        <MobileFilterItem label="Plant">
                                            <button
                                                type="button"
                                                className="flex items-center justify-between w-full rounded text-[12px] py-2 px-2 cursor-pointer bg-bg-primary border border-border-light text-text-primary"
                                                onClick={() => setIsPlantModalOpen(true)}
                                                aria-label="Filter by plant"
                                            >
                                                <span className="truncate">{plantDisplayText}</span>
                                                <i className="fas fa-chevron-down text-[10px] text-text-tertiary" />
                                            </button>
                                        </MobileFilterItem>
                                    )}
                                    {safeStatusOptions.length > 0 && (
                                        <MobileFilterItem label="Status">
                                            <FilterSelect
                                                value={statusFilter}
                                                options={safeStatusOptions}
                                                onChange={onStatusFilterChange}
                                                ariaLabel="Status filter"
                                                className="w-full"
                                            />
                                        </MobileFilterItem>
                                    )}
                                    {safePositionOptions.length > 0 && (
                                        <MobileFilterItem label="Position">
                                            <FilterSelect
                                                value={positionFilter}
                                                options={safePositionOptions}
                                                onChange={onPositionFilterChange}
                                                ariaLabel="Position filter"
                                                className="w-full"
                                            />
                                        </MobileFilterItem>
                                    )}
                                    {safeFreightOptions.length > 0 && (
                                        <MobileFilterItem label="Freight">
                                            <FilterSelect
                                                value={freightFilter}
                                                options={safeFreightOptions}
                                                onChange={onFreightFilterChange}
                                                ariaLabel="Freight filter"
                                                className="w-full"
                                            />
                                        </MobileFilterItem>
                                    )}
                                    {customFilters}
                                    {showReset && onReset && (
                                        <MobileFilterItem fullWidth>
                                            <button
                                                type="button"
                                                className="flex items-center justify-center gap-2 w-full rounded text-[12px] font-semibold py-2 cursor-pointer bg-bg-primary border border-border-light text-text-secondary"
                                                onClick={onReset}
                                            >
                                                <i className="fas fa-undo" />
                                                Reset Filters
                                            </button>
                                        </MobileFilterItem>
                                    )}
                                </div>
                            </div>
                        )}
                        {customBottomContent && <div>{customBottomContent}</div>}
                    </div>
                </div>
                {isPlantModalOpen && (
                    <PlantDropdownModal
                        isOpen={isPlantModalOpen}
                        onClose={() => setIsPlantModalOpen(false)}
                        plants={filteredPlants}
                        onSelect={onSelectedPlantChange}
                        showAllPlants={true}
                        userPlantCode={userPlantCode}
                    />
                )}
            </>
        )
    }

    return (
        <>
            <div
                ref={forwardedRef}
                className={sectionClasses}
                style={sectionStyle}
                data-section="top"
                aria-label="Page controls"
            >
                {hideRealContent && skeletonContent}
                <div className="flex flex-col gap-3" style={hideRealContent ? { display: 'none' } : undefined}>
                    <div className="flex items-center gap-3 justify-between flex-wrap">
                        <div
                            className={`flex items-center gap-3 min-w-0${revealControls ? ' animate-reveal-left' : ''}`}
                        >
                            <h1 className="text-[18px] font-bold tracking-tight m-0 truncate text-text-primary">
                                {title}
                            </h1>
                            {badge && (
                                <Badge onClick={onBadgeClick} onPillClick={onPillClick} accentColor={accentColor}>
                                    {badge}
                                </Badge>
                            )}
                        </div>
                        <div
                            className={`flex items-center gap-2 ml-auto${revealControls ? ' animate-reveal-right' : ''}`}
                            role="group"
                            aria-label="Primary actions"
                        >
                            {customActions}
                            {onToggleSidebar && (
                                <ActionButton
                                    icon="fa-bars"
                                    label="Menu"
                                    onClick={onToggleSidebar}
                                    variant="subtle"
                                    accentColor={accentColor}
                                />
                            )}
                            {onAddClick && (
                                <ActionButton
                                    icon="fa-plus"
                                    label={addButtonLabel}
                                    onClick={onAddClick}
                                    variant="primary"
                                    accentColor={accentColor}
                                />
                            )}
                        </div>
                    </div>
                    <div
                        className="flex items-center flex-wrap gap-2 justify-between"
                        role="region"
                        aria-label="Search and filters"
                    >
                        {!hideSearchBar && (
                            <div className={revealControls ? 'animate-reveal-left' : ''}>
                                <SearchInput
                                    value={searchInput}
                                    onChange={onSearchInputChange}
                                    onClear={onClearSearch}
                                    placeholder={searchPlaceholder}
                                    className="min-w-[220px] max-w-[420px]"
                                />
                            </div>
                        )}
                        <div
                            className={`flex items-center flex-wrap gap-2 ml-auto${revealControls ? ' animate-reveal-right' : ''}`}
                            role="group"
                            aria-label="Filters and view options"
                        >
                            {viewMode && !hideViewModeToggle && (
                                <ViewToggle viewMode={viewMode} onChange={onViewModeChange} accentColor={accentColor} />
                            )}
                            {!hidePlantFilter && (
                                <PlantFilterButton
                                    displayText={plantDisplayText}
                                    onClick={() => setIsPlantModalOpen(true)}
                                />
                            )}
                            {safeStatusOptions.length > 0 && (
                                <FilterSelect
                                    value={statusFilter}
                                    options={safeStatusOptions}
                                    onChange={onStatusFilterChange}
                                    ariaLabel="Status filter"
                                />
                            )}
                            {safePositionOptions.length > 0 && (
                                <FilterSelect
                                    value={positionFilter}
                                    options={safePositionOptions}
                                    onChange={onPositionFilterChange}
                                    ariaLabel="Position filter"
                                />
                            )}
                            {safeFreightOptions.length > 0 && (
                                <FilterSelect
                                    value={freightFilter}
                                    options={safeFreightOptions}
                                    onChange={onFreightFilterChange}
                                    ariaLabel="Freight filter"
                                />
                            )}
                            {customFilters}
                            {showReset && onReset && <ResetButton onClick={onReset} />}
                        </div>
                    </div>
                    {customBottomContent && <div>{customBottomContent}</div>}
                    {viewMode === 'list' && safeListLabels.length > 0 && (
                        <ListHeader
                            labels={safeListLabels}
                            colWidths={safeColWidths}
                            sortKey={sortKey}
                            sortDirection={sortDirection}
                            onHeaderClick={onHeaderClick}
                            accentColor={accentColor}
                        />
                    )}
                </div>
            </div>
            {isPlantModalOpen && (
                <PlantDropdownModal
                    isOpen={isPlantModalOpen}
                    onClose={() => setIsPlantModalOpen(false)}
                    plants={filteredPlants}
                    onSelect={onSelectedPlantChange}
                    showAllPlants={true}
                    userPlantCode={userPlantCode}
                />
            )}
        </>
    )
}

export default TopSection
