/* eslint-disable max-lines, react/forbid-dom-props */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom'

import { Database } from '../../../services/DatabaseService'
import { OperatorService } from '../../../services/OperatorService'
import { UserService } from '../../../services/UserService'
import { usePreferences } from '../../context/PreferencesContext'
import { useIsMobile } from '../../hooks/useIsMobile'

/**
 * Floating recap button and modal showing recent mixer and operator history changes.
 * Displays net change metrics (runnable, down, operators, transfers) and an expandable
 * timeline of individual asset/operator modifications filtered by date range.
 */
function RecapModalSection({
    plantCode,
    plantName,
    mixers,
    operators = [],
    isAllPlants = false,
    mixersLoaded = true,
    isLoading: externalLoading = false,
    isOpen: externalIsOpen,
    onClose
}) {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'
    const controlled = externalIsOpen !== undefined
    const [internalOpen, setInternalOpen] = useState(false)
    const isOpen = controlled ? externalIsOpen : internalOpen
    const setIsOpen = controlled
        ? (v) => {
              if (!v && onClose) onClose()
          }
        : setInternalOpen
    const [isLoading, setIsLoading] = useState(false)
    const [mixerHistory, setMixerHistory] = useState([])
    const [operatorHistory, setOperatorHistory] = useState([])
    const [userNames, setUserNames] = useState({})
    const [operatorNames, setOperatorNames] = useState({})
    const [dateFilter, setDateFilter] = useState('week')
    const [expandedAssets, setExpandedAssets] = useState({})
    const [isTabVisible, setIsTabVisible] = useState(false)
    const isMobile = useIsMobile()
    const mixerIds = useMemo(() => {
        if (!mixers || !Array.isArray(mixers)) return []
        return mixers.map((m) => m.id).filter(Boolean)
    }, [mixers])
    const operatorIds = useMemo(() => {
        if (!operators || !Array.isArray(operators)) return []
        return operators.map((o) => o.employeeId || o.employee_id).filter(Boolean)
    }, [operators])
    const changeMetrics = useMemo(() => {
        const allHistory = [...mixerHistory, ...operatorHistory]
        if (!allHistory || allHistory.length === 0) {
            return {
                downNet: 0,
                operatorsNet: 0,
                runnableNet: 0,
                transfersNet: 0
            }
        }
        let operatorsNet = 0
        let runnableNet = 0
        let downNet = 0
        let transfersNet = 0
        const INACTIVE_STATUSES = ['terminated', 'do not hire']
        const isActiveStatus = (s) => s && !INACTIVE_STATUSES.includes(s.toLowerCase())
        const isInactiveStatus = (s) => s && INACTIVE_STATUSES.includes(s.toLowerCase())
        operatorHistory.forEach((h) => {
            if (h.field_name === 'status') {
                const wasActive = isActiveStatus(h.old_value)
                const nowActive = isActiveStatus(h.new_value)
                const wasInactive = isInactiveStatus(h.old_value)
                const nowInactive = isInactiveStatus(h.new_value)
                if (wasActive && nowInactive) operatorsNet--
                else if (wasInactive && nowActive) operatorsNet++
            }
        })
        mixerHistory.forEach((h) => {
            if (h.field_name === 'status') {
                const oldStatus = (h.old_value || '').toLowerCase()
                const newStatus = (h.new_value || '').toLowerCase()
                const wasDown = oldStatus === 'in shop'
                const isDown = newStatus === 'in shop'
                if (!wasDown && isDown) downNet++
                else if (wasDown && !isDown) downNet--
            }
            if (h.field_name === 'assigned_plant') {
                if (isAllPlants) {
                    transfersNet++
                } else {
                    const oldPlant = h.old_value
                    const newPlant = h.new_value
                    const wasAtThisPlant = oldPlant === plantCode
                    const isAtThisPlant = newPlant === plantCode
                    if (!wasAtThisPlant && isAtThisPlant) {
                        runnableNet++
                        transfersNet++
                    } else if (wasAtThisPlant && !isAtThisPlant) {
                        runnableNet--
                        transfersNet++
                    }
                }
            }
        })
        return {
            downNet,
            operatorsNet,
            runnableNet,
            transfersNet
        }
    }, [mixerHistory, operatorHistory, plantCode, isAllPlants])
    const mixerLookup = useMemo(() => {
        const lookup = {}
        if (mixers && Array.isArray(mixers)) {
            mixers.forEach((m) => {
                if (m.id) lookup[m.id] = m
            })
        }
        return lookup
    }, [mixers])
    const operatorLookup = useMemo(() => {
        const lookup = {}
        if (operators && Array.isArray(operators)) {
            operators.forEach((o) => {
                const employeeId = o.employeeId || o.employee_id
                const id = o.id
                if (employeeId) lookup[employeeId] = o
                if (id) lookup[id] = o
            })
        }
        return lookup
    }, [operators])
    const groupedHistory = useMemo(() => {
        const allHistory = [...mixerHistory, ...operatorHistory]
        if (!allHistory || allHistory.length === 0) return []
        const groups = {}
        mixerHistory.forEach((entry) => {
            const mixerId = entry.mixer_id
            const key = `mixer_${mixerId}`
            if (!groups[key]) {
                groups[key] = {
                    changes: [],
                    id: mixerId,
                    name: null,
                    type: 'mixer'
                }
            }
            groups[key].changes.push(entry)
        })
        operatorHistory.forEach((entry) => {
            const operatorId = entry.operator_id
            const key = `operator_${operatorId}`
            if (!groups[key]) {
                groups[key] = {
                    changes: [],
                    id: operatorId,
                    name: null,
                    type: 'operator'
                }
            }
            groups[key].changes.push(entry)
        })
        Object.values(groups).forEach((group) => {
            if (group.type === 'mixer') {
                const mixer = mixerLookup[group.id]
                if (mixer) {
                    group.name = mixer.truckNumber || mixer.truck_number || 'Unknown'
                } else {
                    const truckNumberChange = group.changes.find((c) => c.field_name === 'truck_number')
                    if (truckNumberChange) {
                        group.name = truckNumberChange.new_value || truckNumberChange.old_value || 'Unknown'
                    } else {
                        group.name = 'Unknown'
                    }
                }
            } else if (group.type === 'operator') {
                const operator = operatorLookup[group.id]
                if (operator) {
                    group.name = operator.name || 'Unknown Operator'
                    group.status = operator.status || 'Unknown'
                } else {
                    const nameChange = group.changes.find((c) => c.field_name === 'name')
                    if (nameChange) {
                        group.name = nameChange.new_value || nameChange.old_value || 'Unknown Operator'
                    } else {
                        group.name = 'Unknown Operator'
                    }
                    group.status = 'Unknown'
                }
            }
            group.changes.sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at))
        })
        return Object.values(groups).sort((a, b) => {
            const aLatest = a.changes[0]?.changed_at || ''
            const bLatest = b.changes[0]?.changed_at || ''
            return new Date(bLatest) - new Date(aLatest)
        })
    }, [mixerHistory, operatorHistory, mixerLookup, operatorLookup])
    const userNamesRef = useRef(userNames)
    userNamesRef.current = userNames
    const operatorNamesRef = useRef(operatorNames)
    operatorNamesRef.current = operatorNames
    const fetchHistory = useCallback(async () => {
        if (mixerIds.length === 0 && operatorIds.length === 0) return
        setIsLoading(true)
        try {
            let startDate = new Date()
            if (dateFilter === 'day') {
                startDate.setDate(startDate.getDate() - 1)
            } else if (dateFilter === 'week') {
                startDate.setDate(startDate.getDate() - 7)
            } else if (dateFilter === 'month') {
                startDate.setMonth(startDate.getMonth() - 1)
            } else if (dateFilter === 'all') {
                startDate = new Date('2020-01-01')
            }
            const [mixerResult, operatorResult] = await Promise.all([
                mixerIds.length > 0
                    ? Database.from('mixers_history')
                          .select('id,mixer_id,field_name,old_value,new_value,changed_at,changed_by')
                          .in('mixer_id', mixerIds)
                          .gte('changed_at', startDate.toISOString())
                          .order('changed_at', { ascending: false })
                          .limit(500)
                    : Promise.resolve({ data: [], error: null }),
                operatorIds.length > 0
                    ? Database.from('operators_history')
                          .select('id,operator_id,field_name,old_value,new_value,changed_at,changed_by')
                          .in('operator_id', operatorIds)
                          .gte('changed_at', startDate.toISOString())
                          .order('changed_at', { ascending: false })
                          .limit(500)
                    : Promise.resolve({ data: [], error: null })
            ])
            const mixerData = !mixerResult.error ? mixerResult.data || [] : []
            const operatorData = !operatorResult.error ? operatorResult.data || [] : []
            const filterHistory = (entries) => {
                return (entries || []).filter((entry) => {
                    const oldVal = entry.old_value
                    const newVal = entry.new_value
                    if (oldVal === newVal) return false
                    if (!oldVal && !newVal) return false
                    if (oldVal === 'null' && !newVal) return false
                    if (!oldVal && newVal === 'null') return false
                    return true
                })
            }
            const filteredMixerHistory = filterHistory(mixerData)
            const filteredOperatorHistory = filterHistory(operatorData)
            setMixerHistory(filteredMixerHistory)
            setOperatorHistory(filteredOperatorHistory)
            const allHistory = [...filteredMixerHistory, ...filteredOperatorHistory]
            const userIds = new Set()
            const opIdsForNames = new Set()
            allHistory.forEach((entry) => {
                if (entry.changed_by) userIds.add(entry.changed_by)
                if (entry.field_name === 'assigned_operator') {
                    if (
                        entry.old_value &&
                        entry.old_value !== 'null' &&
                        entry.old_value !== '' &&
                        entry.old_value !== '0'
                    ) {
                        opIdsForNames.add(entry.old_value)
                    }
                    if (
                        entry.new_value &&
                        entry.new_value !== 'null' &&
                        entry.new_value !== '' &&
                        entry.new_value !== '0'
                    ) {
                        opIdsForNames.add(entry.new_value)
                    }
                }
            })
            const cachedUserNames = userNamesRef.current
            const cachedOpNames = operatorNamesRef.current
            const userIdsToFetch = [...userIds].filter((id) => !cachedUserNames[id])
            const opIdsToFetch = [...opIdsForNames].filter((id) => !cachedOpNames[id])
            const [userNamesResults, opNamesResults] = await Promise.all([
                Promise.all(
                    userIdsToFetch.map(async (userId) => {
                        try {
                            const displayName = await UserService.getUserDisplayName(userId)
                            return { id: userId, name: displayName || 'Unknown' }
                        } catch {
                            return { id: userId, name: 'Unknown' }
                        }
                    })
                ),
                Promise.all(
                    opIdsToFetch.map(async (opId) => {
                        try {
                            const operator = await OperatorService.getOperatorById(opId)
                            return {
                                data: {
                                    name: operator?.name || 'Unknown Operator',
                                    status: operator?.status || 'Unknown'
                                },
                                id: opId
                            }
                        } catch {
                            return {
                                data: {
                                    name: 'Unknown Operator',
                                    status: 'Unknown'
                                },
                                id: opId
                            }
                        }
                    })
                )
            ])
            if (userNamesResults.length > 0) {
                setUserNames((prev) => {
                    const next = { ...prev }
                    userNamesResults.forEach((r) => {
                        next[r.id] = r.name
                    })
                    return next
                })
            }
            if (opNamesResults.length > 0) {
                setOperatorNames((prev) => {
                    const next = { ...prev }
                    opNamesResults.forEach((r) => {
                        next[r.id] = r.data
                    })
                    return next
                })
            }
        } catch (err) {
        } finally {
            setIsLoading(false)
        }
    }, [mixerIds, operatorIds, dateFilter])
    useEffect(() => {
        if (isOpen && (mixerIds.length > 0 || operatorIds.length > 0)) {
            fetchHistory()
        }
    }, [isOpen, mixerIds, operatorIds, dateFilter, fetchHistory])
    useEffect(() => {
        if (!mixersLoaded || externalLoading) {
            setIsTabVisible(false)
            return
        }
        const timer = setTimeout(() => {
            setIsTabVisible(true)
        }, 2000)
        return () => clearTimeout(timer)
    }, [mixersLoaded, externalLoading])
    const formatFieldName = (fieldName) => {
        if (!fieldName) return 'Unknown Field'
        const mappings = {
            assigned_operator: 'Assigned Operator',
            assigned_plant: 'Assigned Plant',
            assigned_trainer: 'Assigned Trainer',
            automatic_restriction: 'Automatic Restriction',
            cleanliness_rating: 'Cleanliness',
            condition_rating: 'Condition',
            down_in_yard: 'Down In Yard',
            is_trainer: 'Trainer',
            last_chip_date: 'Last Chip Date',
            last_service_date: 'Last Service Date',
            make: 'Make',
            model: 'Model',
            name: 'Name',
            pending_start_date: 'Pending Start Date',
            phone: 'Phone',
            plant_code: 'Plant',
            position: 'Position',
            rating: 'Rating',
            smyrna_id: 'Smyrna ID',
            status: 'Status',
            truck_number: 'Truck Number',
            verified: 'Verified',
            vin: 'VIN',
            year: 'Year'
        }
        return mappings[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    }
    const formatValue = (value, fieldName) => {
        if (value === null || value === undefined || value === '' || value === 'null') return 'None'
        if (fieldName === 'assigned_operator') {
            if (value === '0') return 'None'
            const opData = operatorNames[value]
            if (opData) {
                const isTerminated = opData.status === 'Terminated'
                if (isTerminated) {
                    return (
                        <span className="operator-terminated">
                            <span className="operator-name-strikethrough">{opData.name}</span>
                            <span className="terminated-badge">Terminated</span>
                        </span>
                    )
                }
                return opData.name
            }
            return value
        }
        if (fieldName === 'cleanliness_rating' || fieldName === 'condition_rating') {
            const num = parseInt(value)
            if (!isNaN(num)) return `${num} Star${num !== 1 ? 's' : ''}`
        }
        if (fieldName === 'last_service_date' || fieldName === 'last_chip_date') {
            try {
                return new Date(value).toLocaleDateString()
            } catch {
                return value
            }
        }
        if (fieldName === 'down_in_yard' || fieldName === 'is_trainer' || fieldName === 'automatic_restriction') {
            return value === 'true' || value === true ? 'Yes' : 'No'
        }
        if (fieldName === 'rating') {
            const num = parseFloat(value)
            if (!isNaN(num)) return num.toFixed(1)
        }
        if (fieldName === 'pending_start_date') {
            try {
                return new Date(value).toLocaleDateString()
            } catch {
                return value
            }
        }
        return String(value)
    }
    const formatDate = (dateStr) => {
        try {
            const date = new Date(dateStr)
            const now = new Date()
            const diff = now - date
            const mins = Math.floor(diff / 60000)
            const hours = Math.floor(diff / 3600000)
            const days = Math.floor(diff / 86400000)
            if (mins < 1) return 'Just now'
            if (mins < 60) return `${mins}m ago`
            if (hours < 24) return `${hours}h ago`
            if (days < 7) return `${days}d ago`
            return date.toLocaleDateString('en-US', {
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                month: 'short'
            })
        } catch {
            return dateStr
        }
    }
    const getChangeIcon = (fieldName) => {
        const iconMap = {
            assigned_operator: 'fa-solid fa-user',
            assigned_plant: 'fa-solid fa-industry',
            assigned_trainer: 'fa-solid fa-user-graduate',
            automatic_restriction: 'fa-solid fa-car-side',
            cleanliness_rating: 'fa-solid fa-sparkles',
            down_in_yard: 'fa-solid fa-parking',
            is_trainer: 'fa-solid fa-chalkboard-teacher',
            last_chip_date: 'fa-solid fa-hammer',
            last_service_date: 'fa-solid fa-wrench',
            make: 'fa-solid fa-car',
            model: 'fa-solid fa-tag',
            name: 'fa-solid fa-id-card',
            pending_start_date: 'fa-solid fa-calendar-plus',
            phone: 'fa-solid fa-phone',
            plant_code: 'fa-solid fa-industry',
            position: 'fa-solid fa-briefcase',
            rating: 'fa-solid fa-star',
            smyrna_id: 'fa-solid fa-hashtag',
            status: 'fa-solid fa-circle-dot',
            truck_number: 'fa-solid fa-truck',
            vin: 'fa-solid fa-barcode',
            year: 'fa-solid fa-calendar'
        }
        return iconMap[fieldName] || 'fa-solid fa-pen'
    }
    const handleToggle = () => {
        setIsOpen(!isOpen)
    }
    const toggleAssetExpanded = (assetKey) => {
        setExpandedAssets((prev) => ({
            ...prev,
            [assetKey]: !prev[assetKey]
        }))
    }
    const [searchQuery, setSearchQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState('all')
    const [fieldFilter, setFieldFilter] = useState('all')
    const availableFields = useMemo(() => {
        const fields = new Set()
        groupedHistory.forEach((g) => g.changes.forEach((c) => fields.add(c.field_name)))
        return [...fields].sort()
    }, [groupedHistory])
    const isTerminatedGroup = (group) => {
        if (group.type !== 'operator') return false
        const status = (group.status || '').toLowerCase()
        if (status === 'terminated' || status === 'do not hire') return true
        return group.changes.some((c) => {
            if (c.field_name !== 'status') return false
            const val = (c.new_value || '').toLowerCase()
            return val === 'terminated' || val === 'do not hire'
        })
    }
    const filteredHistory = useMemo(() => {
        return groupedHistory.filter((group) => {
            if (typeFilter === 'mixers' && group.type !== 'mixer') return false
            if (typeFilter === 'operators' && group.type !== 'operator') return false
            if (typeFilter === 'terminated' && !isTerminatedGroup(group)) return false
            if (searchQuery) {
                const q = searchQuery.toLowerCase()
                if (!group.name?.toLowerCase().includes(q)) return false
            }
            if (fieldFilter !== 'all') {
                const hasField = group.changes.some((c) => c.field_name === fieldFilter)
                if (!hasField) return false
            }
            return true
        })
    }, [groupedHistory, typeFilter, searchQuery, fieldFilter])
    const filteredChangesForGroup = (group) => {
        if (fieldFilter === 'all') return group.changes
        return group.changes.filter((c) => c.field_name === fieldFilter)
    }
    if (!plantCode && !isAllPlants) return null
    const displayTitle = isAllPlants ? 'All Plants Recap' : `Plant ${plantCode} Recap`
    const displaySubtitle = isAllPlants ? 'All Fleet Changes' : plantName || 'Changes History'

    const tab = !controlled ? (
        <div
            className={`fixed left-0 top-1/2 -translate-y-1/2 z-30 flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-all duration-300 hover:pl-3 ${isTabVisible ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'} text-white`}
            style={{ background: accentColor, borderBottomRightRadius: 4, borderTopRightRadius: 4 }}
            onClick={handleToggle}
        >
            <i className="fa-solid fa-clock-rotate-left text-[11px]" />
            <span className="text-[10.5px] font-semibold uppercase tracking-wider">Recap</span>
        </div>
    ) : null

    const filteredTotal = filteredHistory.reduce((sum, g) => sum + filteredChangesForGroup(g).length, 0)
    const DATE_OPTIONS = [
        { id: 'day', label: '24h' },
        { id: 'week', label: '7d' },
        { id: 'month', label: '30d' },
        { id: 'all', label: 'All' }
    ]
    const TYPE_OPTIONS = [
        { id: 'all', label: 'All' },
        { id: 'mixers', label: 'Mixers' },
        { id: 'operators', label: 'Operators' },
        { id: 'terminated', label: 'Terminated' }
    ]

    const MetricCell = ({ value, label, icon, iconBg, iconFg, positive, last }) => {
        const valueColor =
            value > 0
                ? positive
                    ? '#16a34a'
                    : '#dc2626'
                : value < 0
                  ? positive
                      ? '#dc2626'
                      : '#16a34a'
                  : 'var(--text-primary)'
        return (
            <div
                className="flex items-center gap-2 px-3 py-2 bg-bg-primary flex-1 min-w-0"
                style={{ borderRight: last ? 'none' : '1px solid var(--border-light)' }}
            >
                <div
                    className="flex h-6 w-6 items-center justify-center rounded shrink-0"
                    style={{ background: iconBg, color: iconFg }}
                >
                    <i className={`fa-solid ${icon} text-[10px]`} />
                </div>
                <div className="flex flex-col min-w-0">
                    <span
                        className="text-[14px] font-semibold leading-tight font-mono tabular-nums"
                        style={{ color: valueColor }}
                    >
                        {value === 0 ? '0' : `${value > 0 ? '+' : ''}${value}`}
                    </span>
                    <span className="text-[9.5px] font-semibold uppercase tracking-wider leading-tight text-text-tertiary">
                        {label}
                    </span>
                </div>
            </div>
        )
    }

    const FilterPill = ({ active, label, onClick }) => (
        <button
            type="button"
            onClick={onClick}
            className="rounded text-[10.5px] font-semibold uppercase tracking-wider px-2 py-1 transition-colors"
            style={{
                background: active ? accentColor : 'var(--bg-secondary)',
                border: active ? `1px solid ${accentColor}` : '1px solid var(--border-light)',
                color: active ? '#fff' : 'var(--text-secondary)'
            }}
        >
            {label}
        </button>
    )

    const modal = isOpen ? (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(15,_23,_42,_0.65)]"
            onClick={() => setIsOpen(false)}
        >
            <div
                className="rounded w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden bg-bg-primary border border-border-light"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between gap-2.5 px-3 py-2 shrink-0 bg-bg-primary border-b border-border-light">
                    <div className="flex items-center gap-2 min-w-0">
                        <div
                            className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary"
                            style={{ color: accentColor }}
                        >
                            <i className="fa-solid fa-clock-rotate-left text-[11px]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[9.5px] font-semibold uppercase tracking-wider text-text-secondary">
                                {displayTitle}
                            </div>
                            <div className="text-[10.5px] truncate text-text-tertiary">{displaySubtitle}</div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-bg-tertiary border-none cursor-pointer text-text-secondary"
                        aria-label="Close"
                    >
                        <i className="fa-solid fa-xmark text-[11px]" />
                    </button>
                </div>

                {/* Filters toolbar */}
                <div className="px-3 py-2 shrink-0 flex flex-col gap-2 bg-bg-secondary border-b border-border-light">
                    {/* Search */}
                    <div className="relative">
                        <i className="fa-solid fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-text-tertiary" />
                        <input
                            type="text"
                            placeholder="Search by name…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-7 pr-7 py-1.5 text-[12.5px] rounded outline-none bg-bg-primary border border-border-light text-text-primary"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 border-none bg-transparent cursor-pointer text-text-tertiary"
                            >
                                <i className="fa-solid fa-xmark text-[10px]" />
                            </button>
                        )}
                    </div>

                    {/* Filter row */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1">
                            {DATE_OPTIONS.map((d) => (
                                <FilterPill
                                    key={d.id}
                                    active={dateFilter === d.id}
                                    label={d.label}
                                    onClick={() => setDateFilter(d.id)}
                                />
                            ))}
                        </div>
                        <span className="w-px h-4 bg-[var(--border-light)]" />
                        <div className="flex items-center gap-1">
                            {TYPE_OPTIONS.map((t) => (
                                <FilterPill
                                    key={t.id}
                                    active={typeFilter === t.id}
                                    label={t.label}
                                    onClick={() => setTypeFilter(t.id)}
                                />
                            ))}
                        </div>
                        {availableFields.length > 1 && (
                            <>
                                <span className="w-px h-4 bg-[var(--border-light)]" />
                                <select
                                    value={fieldFilter}
                                    onChange={(e) => setFieldFilter(e.target.value)}
                                    className="rounded text-[11px] cursor-pointer font-medium px-2 py-1 outline-none bg-bg-primary border border-border-light text-text-primary"
                                >
                                    <option value="all">All fields</option>
                                    {availableFields.map((f) => (
                                        <option key={f} value={f}>
                                            {formatFieldName(f)}
                                        </option>
                                    ))}
                                </select>
                            </>
                        )}
                    </div>

                    {/* Metrics row */}
                    <div className="grid grid-cols-4 rounded overflow-hidden bg-bg-primary border border-border-light">
                        <MetricCell
                            value={changeMetrics.operatorsNet}
                            label="Operators"
                            icon="fa-user"
                            iconBg="#dbeafe"
                            iconFg="#1e40af"
                            positive
                        />
                        <MetricCell
                            value={changeMetrics.runnableNet}
                            label="Runnable"
                            icon="fa-truck"
                            iconBg="#dcfce7"
                            iconFg="#166534"
                            positive
                        />
                        <MetricCell
                            value={changeMetrics.downNet}
                            label="Down"
                            icon="fa-wrench"
                            iconBg="#fef3c7"
                            iconFg="#92400e"
                            positive={false}
                        />
                        <MetricCell
                            value={changeMetrics.transfersNet}
                            label="Transfers"
                            icon="fa-right-left"
                            iconBg="#ede9fe"
                            iconFg="#6d28d9"
                            positive
                            last
                        />
                    </div>
                </div>

                {/* Results count */}
                <div className="px-3 py-1.5 flex items-center justify-between shrink-0 border-b border-border-light">
                    <span className="text-[10.5px] font-mono tabular-nums text-text-tertiary">
                        {filteredHistory.length} asset{filteredHistory.length !== 1 ? 's' : ''} · {filteredTotal} change
                        {filteredTotal !== 1 ? 's' : ''}
                    </span>
                    {(searchQuery || typeFilter !== 'all' || fieldFilter !== 'all') && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery('')
                                setTypeFilter('all')
                                setFieldFilter('all')
                            }}
                            className="text-[10.5px] font-semibold uppercase tracking-wider border-none bg-transparent cursor-pointer"
                            style={{ color: accentColor }}
                        >
                            Clear filters
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="px-3 py-2">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
                                <i className="fa-solid fa-spinner fa-spin text-lg mb-2" />
                                <span className="text-[12px]">Loading history…</span>
                            </div>
                        ) : filteredHistory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
                                <i className="fa-solid fa-filter-circle-xmark text-2xl mb-2" />
                                <p className="text-[12.5px] font-semibold m-0 text-text-primary">No changes found</p>
                                <p className="text-[11px] mt-0.5 m-0">Try adjusting your filters</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                {filteredHistory.map((group, groupIndex) => {
                                    const assetKey = `${group.type}_${group.id}`
                                    const isExpanded = expandedAssets[assetKey] || false
                                    const isMixer = group.type === 'mixer'
                                    const isTerminated = group.type === 'operator' && group.status === 'Terminated'
                                    const changes = filteredChangesForGroup(group)
                                    const tile = isMixer
                                        ? { bg: '#dbeafe', fg: '#1e40af', icon: 'fa-truck' }
                                        : { bg: '#fef3c7', fg: '#92400e', icon: 'fa-hard-hat' }
                                    return (
                                        <div
                                            key={assetKey || groupIndex}
                                            className="rounded overflow-hidden bg-bg-primary border border-border-light"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => toggleAssetExpanded(assetKey)}
                                                className="flex w-full items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors hover:bg-bg-tertiary border-none text-left bg-transparent"
                                            >
                                                <div
                                                    className="flex h-6 w-6 items-center justify-center rounded shrink-0"
                                                    style={{ background: tile.bg, color: tile.fg }}
                                                >
                                                    <i className={`fa-solid ${tile.icon} text-[10px]`} />
                                                </div>
                                                {isTerminated ? (
                                                    <span className="flex items-center gap-1.5 flex-1 min-w-0">
                                                        <span className="line-through text-[12px] truncate text-text-secondary">
                                                            {group.name}
                                                        </span>
                                                        <span className="px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider rounded shrink-0 bg-red-100 text-red-700">
                                                            Terminated
                                                        </span>
                                                    </span>
                                                ) : (
                                                    <span className="flex-1 text-[12px] font-semibold truncate text-text-primary">
                                                        {group.name}
                                                    </span>
                                                )}
                                                <span className="font-mono tabular-nums rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider bg-bg-tertiary text-text-secondary">
                                                    {changes.length}
                                                </span>
                                                <i
                                                    className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} text-text-tertiary`}
                                                />
                                            </button>
                                            {isExpanded && (
                                                <div className="border-t border-border-light">
                                                    {changes.map((entry, index) => (
                                                        <div
                                                            key={entry.id || index}
                                                            className="flex gap-2 px-3 py-2"
                                                            style={{
                                                                borderBottom:
                                                                    index < changes.length - 1
                                                                        ? '1px solid var(--border-light)'
                                                                        : 'none'
                                                            }}
                                                        >
                                                            <div className="flex h-6 w-6 items-center justify-center rounded shrink-0 mt-0.5 bg-bg-tertiary text-text-secondary">
                                                                <i
                                                                    className={`${getChangeIcon(entry.field_name)} text-[10px]`}
                                                                />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                                                                        {formatFieldName(entry.field_name)}
                                                                    </span>
                                                                    <span className="text-[10px] font-mono tabular-nums shrink-0 text-text-tertiary">
                                                                        {formatDate(entry.changed_at)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                                                                    <span className="px-1.5 py-0.5 rounded truncate max-w-[130px] font-mono tabular-nums bg-red-100 text-red-700">
                                                                        {formatValue(entry.old_value, entry.field_name)}
                                                                    </span>
                                                                    <i className="fa-solid fa-arrow-right text-[8px] shrink-0 text-text-tertiary" />
                                                                    <span className="px-1.5 py-0.5 rounded truncate max-w-[130px] font-mono tabular-nums bg-green-100 text-[#166534]">
                                                                        {formatValue(entry.new_value, entry.field_name)}
                                                                    </span>
                                                                </div>
                                                                {entry.changed_by && userNames[entry.changed_by] && (
                                                                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-text-tertiary">
                                                                        <i className="fa-solid fa-user-pen text-[8px]" />
                                                                        <span>{userNames[entry.changed_by]}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    ) : null
    return (
        <>
            {!isMobile && tab}
            {modal && ReactDOM.createPortal(modal, document.body)}
        </>
    )
}
export default RecapModalSection
