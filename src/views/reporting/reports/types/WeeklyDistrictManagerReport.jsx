/* eslint-disable max-lines, react/forbid-dom-props */
import React, { useEffect, useMemo, useState } from 'react'

import { usePreferences } from '../../../../app/context/PreferencesContext'
import { filterMaintenanceItemsByPlant, useAllowedPlantCodes } from '../../../../app/hooks/useReportData'
import { PlanService } from '../../../../services/PlanService'
import { PlantService } from '../../../../services/PlantService'
import { getDistrictPlantCodes, getDistrictsForPlantCode } from '../../../../utils/DistrictUtility'
import FormatUtility from '../../../../utils/FormatUtility'
import { isExcludedOrder } from '../../../../utils/PlanUtility'
import { ReportUtility } from '../../../../utils/ReportUtility'

const SECTION_LABEL_CLASS = 'text-[9.5px] font-semibold uppercase tracking-wider'
const CARD_STYLE = { background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }
const PLAN_META_KEY = '_meta'

const WEEKDAYS = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' }
]

/** ISO date strings (Mon–Sat) for the report's selected week. Mirrors the
 *  Plan-tab Mon–Sat window so the side-column totals line up exactly with
 *  what the Schedule view shows. */
function getWeekDateStrings(weekIso) {
    const { monday } = ReportUtility.getWeekDatesFromIso(weekIso)
    if (!monday) return []
    const out = []
    for (let i = 0; i < 6; i++) {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        out.push(d.toISOString().slice(0, 10))
    }
    return out
}

/** Pull plant production for every Mon–Sat date in the week and return a
 *  `plantCode → totalYards` map. Uses the same shape and filter rules as
 *  PlanScheduleView (`plant_production[code].orders[]`, excluding test +
 *  cancelled sentinels). */
function useWeeklyYardageByPlant(weekIso, allowedCodes) {
    const [yardageByPlant, setYardageByPlant] = useState({})
    const [loading, setLoading] = useState(false)
    useEffect(() => {
        let cancelled = false
        const dates = getWeekDateStrings(weekIso)
        const codes = Array.isArray(allowedCodes) ? allowedCodes : []
        if (dates.length === 0 || codes.length === 0) {
            setYardageByPlant({})
            setLoading(false)
            return undefined
        }
        setLoading(true)
        const allowedSet = new Set(codes)
        Promise.allSettled(dates.map((d) => PlanService.fetchPlan(d))).then((results) => {
            if (cancelled) return
            const totals = {}
            for (const code of codes) totals[code] = 0
            results.forEach((res) => {
                if (res.status !== 'fulfilled' || !res.value?.plant_production) return
                Object.entries(res.value.plant_production).forEach(([code, prod]) => {
                    if (code === PLAN_META_KEY || !allowedSet.has(code)) return
                    const orders = Array.isArray(prod?.orders) ? prod.orders : []
                    orders.forEach((o) => {
                        if (isExcludedOrder(o)) return
                        totals[code] += parseFloat(o?.yardage) || 0
                    })
                })
            })
            setYardageByPlant(totals)
            setLoading(false)
        })
        return () => {
            cancelled = true
        }
    }, [weekIso, allowedCodes])
    return { loading, yardageByPlant }
}

/** Compact card header — icon chip + label/title — matching the look used
 *  by MaintenanceFormReview, NRMCAView, and the Plan-tab toolbars. */
function CardHeader({ icon, label, sub, title }) {
    return (
        <div className="flex items-center gap-2 mb-2">
            <div className="flex h-6 w-6 items-center justify-center rounded shrink-0 bg-bg-tertiary text-text-secondary">
                <i className={`fas ${icon} text-[11px]`} />
            </div>
            <div className="min-w-0 flex-1">
                {label && (
                    <div className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                        {label}
                    </div>
                )}
                <div className="text-[12.5px] font-semibold leading-tight text-text-primary">{title}</div>
                {sub && <div className="text-[10.5px] mt-0.5 text-text-tertiary">{sub}</div>}
            </div>
        </div>
    )
}

function DailyRecapSection({ form, handleChange, readOnly }) {
    return (
        <div className="rounded p-3" style={CARD_STYLE}>
            <CardHeader
                icon="fa-clipboard-list"
                label="Recap"
                title="Daily Activity Recaps"
                sub="Activities, meetings, issues, and accomplishments per day."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {WEEKDAYS.map((day) => {
                    const value = form[day.key] ?? ''
                    return (
                        <div
                            key={day.key}
                            className="rounded p-2.5 flex flex-col gap-1.5 bg-bg-secondary border border-border-light"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <i className="fas fa-calendar-day text-[10px] text-text-tertiary" />
                                    <span className="text-[11.5px] font-semibold text-text-primary">{day.label}</span>
                                    {!readOnly && <span className="text-red-600">*</span>}
                                </div>
                                <span className="text-[10px] tabular-nums text-text-tertiary">{value.length}</span>
                            </div>
                            <textarea
                                value={value}
                                onChange={(e) => handleChange(e, day.key)}
                                placeholder={readOnly ? '—' : `Notes for ${day.label.toLowerCase()}…`}
                                required={!readOnly}
                                disabled={readOnly}
                                rows={5}
                                className="w-full rounded px-2 py-1.5 text-[12px] outline-none resize-y min-h-[88px] disabled:opacity-90 bg-bg-primary border border-border-light text-text-primary"
                            />
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

/** Inline pill stat — same compact style as the Plan-tab KPI badges. */
function StatPill({ accent = 'var(--text-secondary)', icon, label, value }) {
    return (
        <div className="flex items-center gap-2 rounded px-2.5 py-1.5 bg-bg-secondary border border-border-light">
            <i className={`fas ${icon} text-[11px]`} style={{ color: accent }} />
            <div className="flex items-baseline gap-1.5">
                <span className="text-[15px] font-bold leading-none tabular-nums text-text-primary">{value}</span>
                <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                    {label}
                </span>
            </div>
        </div>
    )
}

const ITEM_ICON_CLASSES = {
    completed: { color: '#16a34a', icon: 'fa-circle-check' },
    overdue: { color: '#dc2626', icon: 'fa-triangle-exclamation' },
    pending: { color: '#d97706', icon: 'fa-clock' }
}

function getItemIcon(item) {
    if (item.completed) return ITEM_ICON_CLASSES.completed
    if (item.isOverdue) return ITEM_ICON_CLASSES.overdue
    return ITEM_ICON_CLASSES.pending
}

const truncateText = (text, maxLength) => FormatUtility.truncateText(text, maxLength)

function MaintenanceItemsTable({ items, plants }) {
    const getPlantName = (plantCode) => {
        const plant = plants?.find((p) => (p.plant_code || p.code) === plantCode)
        return plant?.name || plantCode || ''
    }
    if (items.length === 0) {
        return (
            <div className="rounded p-6 text-center flex flex-col items-center gap-1.5" style={CARD_STYLE}>
                <i className="fas fa-clipboard-check text-[20px] text-text-tertiary" />
                <p className="text-[12px] m-0 text-text-secondary">No maintenance items were completed this week.</p>
            </div>
        )
    }
    return (
        <div className="rounded overflow-hidden" style={CARD_STYLE}>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            {['Description', 'Plant', 'Deadline', 'Completed'].map((header) => (
                                <th
                                    key={header}
                                    className={`${SECTION_LABEL_CLASS} text-left px-3 py-2 whitespace-nowrap bg-bg-tertiary text-text-tertiary border-b border-border-light`}
                                >
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => {
                            const { color, icon } = getItemIcon(item)
                            return (
                                <tr
                                    className="border-t border-border-light"
                                    key={item.id}
                                    style={{ background: item.isOverdue ? 'rgba(220, 38, 38, 0.04)' : undefined }}
                                >
                                    <td className="px-3 py-2 align-top">
                                        <div className="flex items-start gap-2">
                                            <i
                                                className={`fas ${icon} text-[12px] mt-0.5 shrink-0`}
                                                style={{ color }}
                                            />
                                            <span
                                                className="text-[12px] leading-snug text-text-primary"
                                                title={item.description}
                                            >
                                                {truncateText(item.description, 80)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 align-top whitespace-nowrap">
                                        <span
                                            className="inline-flex items-center rounded px-2 py-0.5 text-[10.5px] font-semibold bg-bg-tertiary text-text-secondary border border-border-light"
                                            title={getPlantName(item.plant_code)}
                                        >
                                            {truncateText(getPlantName(item.plant_code), 25)}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 align-top whitespace-nowrap text-[12px] tabular-nums text-text-secondary">
                                        {item.deadline ? ReportUtility.formatDate(item.deadline) : '—'}
                                    </td>
                                    <td className="px-3 py-2 align-top whitespace-nowrap">
                                        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] font-semibold tabular-nums bg-[rgba(22,_163,_74,_0.12)] text-green-700">
                                            <i className="fas fa-check text-[9px]" />
                                            {item.completed_at ? ReportUtility.formatDate(item.completed_at) : '—'}
                                        </span>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

/** Side column listing the user's district plants with weekly yardage
 *  pulled from `plant_production` (same source the Schedule view reads).
 *  Sorted highest-to-lowest with a horizontal bar so dispatch / DM can
 *  eyeball who's pulling the volume. Sticky on desktop so it stays in
 *  view while the recap section scrolls. */
function DistrictYardageRail({ districtNames, loading, plants, weekIso, yardageByPlant }) {
    const total = Object.values(yardageByPlant).reduce((sum, v) => sum + (v || 0), 0)
    const max = Object.values(yardageByPlant).reduce((m, v) => Math.max(m, v || 0), 0)
    const rows = Object.entries(yardageByPlant).sort(([, a], [, b]) => b - a)
    const weekRange = ReportUtility.getWeekVerbose(weekIso)
    const districtLabel =
        Array.isArray(districtNames) && districtNames.length
            ? districtNames.length === 1
                ? districtNames[0]
                : `${districtNames.length} districts`
            : 'Your district'
    return (
        <div className="rounded p-3 flex flex-col gap-3" style={CARD_STYLE}>
            <CardHeader icon="fa-cubes" label="District yardage" title={districtLabel} sub={weekRange || 'This week'} />

            <div className="flex items-baseline justify-between rounded px-2.5 py-2 bg-bg-secondary border border-border-light">
                <span className={SECTION_LABEL_CLASS} style={{ color: 'var(--text-tertiary)' }}>
                    Total
                </span>
                <span className="font-mono tabular-nums text-text-primary">
                    <span className="text-[18px] font-bold">{Math.round(total).toLocaleString()}</span>
                    <span className="ml-1 text-[10.5px] text-text-tertiary">yd</span>
                </span>
            </div>

            {loading && rows.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-6 text-[11.5px] text-text-tertiary">
                    <i className="fas fa-circle-notch fa-spin text-[11px]" />
                    Loading week…
                </div>
            ) : rows.length === 0 ? (
                <div className="text-[11.5px] text-center py-4 text-text-tertiary">No district plants found.</div>
            ) : (
                <div className="flex flex-col gap-1.5">
                    {rows.map(([code, value]) => {
                        const plant = plants?.find((p) => (p.plant_code || p.code) === code)
                        const name = plant?.name || ''
                        const pct = max > 0 ? (value / max) * 100 : 0
                        const valRounded = Math.round(value)
                        return (
                            <div
                                key={code}
                                className="rounded px-2 py-1.5 bg-bg-secondary border border-border-light"
                                title={name ? `${code} · ${name}` : code}
                            >
                                <div className="flex items-baseline justify-between gap-2 mb-1">
                                    <div className="min-w-0 flex items-baseline gap-1.5">
                                        <span className="text-[12.5px] font-bold tabular-nums text-text-primary">
                                            {code}
                                        </span>
                                        {name && (
                                            <span className="text-[10.5px] truncate text-text-tertiary">{name}</span>
                                        )}
                                    </div>
                                    <span className="font-mono text-[12px] font-semibold tabular-nums shrink-0 text-text-primary">
                                        {valRounded.toLocaleString()}
                                        <span className="ml-0.5 text-[10px] text-text-tertiary">yd</span>
                                    </span>
                                </div>
                                <div className="h-1 rounded-full overflow-hidden bg-bg-tertiary">
                                    <div
                                        className="h-full rounded-full"
                                        style={{
                                            background: value > 0 ? 'var(--accent, #1e3a5f)' : 'var(--border-light)',
                                            width: `${pct}%`
                                        }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

function DistrictManagerPlugin({
    form,
    maintenanceItems,
    plants,
    readOnly,
    setForm,
    user,
    userPlantCode: userPlantCodeProp,
    weekIso
}) {
    const { preferences } = usePreferences()
    const regionCode = preferences?.selectedRegion?.code || ''
    const allowedCodes = useAllowedPlantCodes(regionCode, PlantService)
    const filteredItems = filterMaintenanceItemsByPlant(maintenanceItems, plants, allowedCodes)
    const completedCount = filteredItems.length
    const overdueCount = filteredItems.filter((item) => item.isOverdue).length

    /* District plant scope — derived from the user's home plant + region
     * plant memberships (each plant carries a `districts` list). Falls back
     * to all region-allowed plants when district info isn't available so the
     * rail still shows something useful. */
    const userPlantCode = userPlantCodeProp || user?.plant_code || user?.plantCode || ''
    const [regionPlants, setRegionPlants] = useState([])
    useEffect(() => {
        let cancelled = false
        if (!regionCode) {
            setRegionPlants([])
            return undefined
        }
        PlantService.fetchRegionPlants(regionCode).then((rows) => {
            if (!cancelled) setRegionPlants(rows || [])
        })
        return () => {
            cancelled = true
        }
    }, [regionCode])
    const districtPlantCodes = useMemo(() => {
        if (!userPlantCode || regionPlants.length === 0) return []
        const codes = getDistrictPlantCodes(userPlantCode, regionPlants)
        return codes.length ? codes.sort() : []
    }, [userPlantCode, regionPlants])
    const districtNames = useMemo(
        () => (userPlantCode && regionPlants.length ? getDistrictsForPlantCode(userPlantCode, regionPlants) : []),
        [userPlantCode, regionPlants]
    )
    const yardageScopeCodes = useMemo(() => {
        if (districtPlantCodes.length > 0) return districtPlantCodes
        return Array.isArray(allowedCodes) ? allowedCodes : []
    }, [districtPlantCodes, allowedCodes])
    const { loading: yardageLoading, yardageByPlant } = useWeeklyYardageByPlant(weekIso, yardageScopeCodes)

    const handleChange = (e, name) => {
        if (setForm) setForm((prev) => ({ ...prev, [name]: e.target.value }))
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-2.5 items-start">
            <div className="flex flex-col gap-2.5 min-w-0">
                <DailyRecapSection form={form} handleChange={handleChange} readOnly={readOnly} />

                <div className="rounded p-3" style={CARD_STYLE}>
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                        <CardHeader
                            icon="fa-screwdriver-wrench"
                            label="Maintenance"
                            title="Weekly Completed Items"
                            sub="Maintenance items closed during this reporting week."
                        />
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <StatPill
                                accent="#16a34a"
                                icon="fa-circle-check"
                                label="Completed"
                                value={completedCount}
                            />
                            {overdueCount > 0 && (
                                <StatPill
                                    accent="#dc2626"
                                    icon="fa-triangle-exclamation"
                                    label="Were Overdue"
                                    value={overdueCount}
                                />
                            )}
                        </div>
                    </div>
                    <MaintenanceItemsTable items={filteredItems} plants={plants} />
                </div>
            </div>

            <div className="lg:sticky lg:top-3 self-start min-w-0">
                <DistrictYardageRail
                    districtNames={districtNames}
                    loading={yardageLoading}
                    plants={plants}
                    weekIso={weekIso}
                    yardageByPlant={yardageByPlant}
                />
            </div>
        </div>
    )
}

/** Submit-mode wrapper for the District Manager report plugin. */
export function DistrictManagerSubmitPlugin(props) {
    return <DistrictManagerPlugin {...props} />
}

/** Review-mode wrapper for the District Manager report plugin (read-only). */
export function DistrictManagerReviewPlugin({ form, maintenanceItems, plants, user, weekIso }) {
    return (
        <DistrictManagerPlugin
            form={form}
            maintenanceItems={maintenanceItems}
            plants={plants}
            readOnly
            user={user}
            weekIso={weekIso}
        />
    )
}
