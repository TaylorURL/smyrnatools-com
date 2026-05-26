/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useMemo, useState } from 'react'

import TopSection from '../../../app/components/sections/TopSection'
import { Panel } from '../../../app/components/ui/Panel'
import { useIsMobile } from '../../../app/hooks/useIsMobile'
import { ACI_SLUMP_RANGES } from '../../../utils/CalculatorMath'
import AirContentCalculator from './types/AirContentCalculator'
import CuringScheduleCalculator from './types/CuringScheduleCalculator'
import ProportionsCalculator from './types/ProportionsCalculator'
import RequiredStrengthCalculator from './types/RequiredStrengthCalculator'
import SetTimeCalculator from './types/SetTimeCalculator'
import SlumpAdjustmentCalculator from './types/SlumpAdjustmentCalculator'
import VolumeCalculator from './types/VolumeCalculator'
import WaterCementCalculator from './types/WaterCementCalculator'
import YardagePerHourCalculator from './types/YardagePerHourCalculator'

/* ─── Catalog ───────────────────────────────────────────────────
 *
 * Calculators are grouped by phase of the dispatch / mix-design
 * workflow so the sidebar reads as a workflow checklist instead of an
 * alphabetical pile. Each entry carries a `standard` block surfaced on
 * the right rail when the calculator is active. */

const CALCULATORS = [
    {
        Component: VolumeCalculator,
        category: 'Quantity & Cost',
        description: 'Slab / footing / column / wall volume + waste',
        icon: 'fa-ruler-combined',
        id: 'volume',
        keywords: ['volume', 'slab', 'footing', 'column', 'wall', 'cubic yards', 'order'],
        name: 'Volume',
        standard: {
            body: 'Standard prism / cylinder geometry. ACI 304R recommends a 5–10 % waste factor for slabs and footings, more for irregular forms or pumped concrete. Trucks dispatch in whole 10-yd loads.',
            ref: 'ACI 304R'
        }
    },
    {
        Component: YardagePerHourCalculator,
        category: 'Quantity & Cost',
        description: 'Live / completed production rate',
        icon: 'fa-tachometer-alt',
        id: 'yardage-hour',
        keywords: ['yardage', 'hour', 'rate', 'production', 'pace', 'yph'],
        name: 'Yards / Hour',
        standard: {
            body: 'Production rate = yards poured ÷ elapsed hours, anchored at the first load-out. Concrete sets in ~90 min from water contact (ASTM C94 §11.7), so sustained rates below ~10 yd/hr risk cold joints on a single pour.',
            ref: 'ASTM C94 §11.7'
        }
    },
    {
        Component: RequiredStrengthCalculator,
        category: 'Mix Design (ACI 318)',
        description: "Required f'cr from ACI 318 §26.4.3",
        icon: 'fa-bullseye',
        id: 'required-strength',
        keywords: ['fcr', "f'cr", 'strength', 'over-design', '318', '26.4.3'],
        name: "Required Strength (f'cr)",
        standard: {
            body: "f'cr is the strength the mix must be PROPORTIONED to achieve so the as-cast concrete has high confidence (no more than 1 in 100 sub-strength tests) of meeting f'c. When s is established from ≥15 tests, the over-design equations govern; otherwise Table 26.4.3.2.1 applies.",
            ref: 'ACI 318-19 §26.4.3'
        }
    },
    {
        Component: WaterCementCalculator,
        category: 'Mix Design (ACI 318)',
        description: 'Water-to-cementitious ratio + per-yard',
        icon: 'fa-percentage',
        id: 'water-cement',
        keywords: ['w/c', 'wc', 'ratio', 'water cement', 'cementitious'],
        name: 'W/C Ratio',
        standard: {
            body: 'Water (lbs) ÷ total cementitious (cement + SCMs). Durability governs the upper limit per ACI 318-19 Table 19.3.2.1 — see the right-rail card for class-specific caps.',
            ref: 'ACI 318-19 §19.3.2'
        }
    },
    {
        Component: AirContentCalculator,
        category: 'Mix Design (ACI 318)',
        description: 'Table 19.3.3.1 air content by exposure',
        icon: 'fa-wind',
        id: 'air-content',
        keywords: ['air', 'entrainment', 'frost', 'freeze', 'exposure'],
        name: 'Air Content',
        standard: {
            body: 'Required total air content for frost-resistant concrete, keyed by nominal max aggregate × exposure class. F0 imposes no requirement; F1 (moderate) is 1 % below the F2/F3 value. Field tolerance per ASTM C231 is typically ±1.5 %.',
            ref: 'ACI 318-19 Table 19.3.3.1'
        }
    },
    {
        Component: SlumpAdjustmentCalculator,
        category: 'Field Adjustments',
        description: 'Water to add for a target slump',
        icon: 'fa-arrows-alt-v',
        id: 'slump',
        keywords: ['slump', 'workability', 'adjustment', 'water'],
        name: 'Slump Adjust',
        standard: {
            body: 'Slump is checked per ASTM C143; the target ranges by placement application are in ACI 211.1 Table 6.3.1 (right-rail card). Field water adjustments must not push the mix above the spec w/cm cap.',
            ref: 'ASTM C143 / ACI 211.1'
        }
    },
    {
        Component: ProportionsCalculator,
        category: 'Field Adjustments',
        description: 'Rebalance after an overweight load',
        icon: 'fa-balance-scale',
        id: 'proportions',
        keywords: ['proportions', 'overweight', 'fix', 'rebalance'],
        name: 'Overweight Fix',
        standard: {
            body: 'When a batch comes out heavy, the proportions must be rebalanced so the w/cm and aggregate ratios still satisfy the original mix design. Iterates until per-yard weights converge within tolerance.',
            ref: 'ACI 211.1 (proportions)'
        }
    },
    {
        Component: SetTimeCalculator,
        category: 'Field Adjustments',
        description: 'Initial set + workable window',
        icon: 'fa-clock',
        id: 'set-time',
        keywords: ['set', 'time', 'hot weather', 'retarder', 'accelerator'],
        name: 'Set Time',
        standard: {
            body: 'Hot weather accelerates set, cold weather delays it. ACI 305R / 306R cover the placement-temperature limits and admixture strategies. Initial set is measured per ASTM C403.',
            ref: 'ASTM C403 / ACI 305R'
        }
    },
    {
        Component: CuringScheduleCalculator,
        category: 'Operations',
        description: 'ACI 308.1 minimum curing days',
        icon: 'fa-droplet',
        id: 'curing',
        keywords: ['cure', 'curing', '308', 'days', 'wet cure'],
        name: 'Curing Schedule',
        standard: {
            body: 'Minimum curing window from ACI 308.1 §6.3.4 — 7 days (normal) / 3 (high-early) / 14 (pozzolan-heavy). ACI 306 adds a day per 10 °F below 50 °F for cold-weather curing; severe-exposure mixes get +3 days per §6.3.4.2 commentary.',
            ref: 'ACI 308.1'
        }
    }
]

const CATEGORY_ORDER = ['Quantity & Cost', 'Mix Design (ACI 318)', 'Field Adjustments', 'Operations']
const RECENTS_KEY = 'smyrnatools.calculator.recents'
const RECENT_LIMIT = 5

/* Read / write the localStorage-backed "recent" list. Bounded length,
 * dedup-on-prepend, SSR-safe (falls back to [] when window is absent). */
function readRecents() {
    if (typeof window === 'undefined') return []
    try {
        const raw = window.localStorage.getItem(RECENTS_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((id) => CALCULATORS.some((c) => c.id === id)) : []
    } catch {
        return []
    }
}

function writeRecents(ids) {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(RECENTS_KEY, JSON.stringify(ids.slice(0, RECENT_LIMIT)))
    } catch {
        /* quota exceeded — recents are non-essential */
    }
}

const CalculatorView = () => {
    const isMobile = useIsMobile()
    const [selectedId, setSelectedId] = useState('volume')
    const [searchInput, setSearchInput] = useState('')
    const [recents, setRecents] = useState(() => readRecents())
    const [initialLoading, setInitialLoading] = useState(true)

    useEffect(() => {
        const timer = setTimeout(() => setInitialLoading(false), 120)
        return () => clearTimeout(timer)
    }, [])

    /* Bump the active calculator to the front of the recents list on
     * every selection change so the most-used tools stay at the top. */
    useEffect(() => {
        setRecents((prev) => {
            const next = [selectedId, ...prev.filter((id) => id !== selectedId)].slice(0, RECENT_LIMIT)
            writeRecents(next)
            return next
        })
    }, [selectedId])

    const visibleCalculators = useMemo(() => {
        const q = searchInput.trim().toLowerCase()
        if (!q) return CALCULATORS
        return CALCULATORS.filter((c) => {
            const haystack = [c.name, c.category, c.description, ...(c.keywords || [])].join(' ').toLowerCase()
            return haystack.includes(q)
        })
    }, [searchInput])

    const grouped = useMemo(() => {
        const map = new Map()
        for (const cat of CATEGORY_ORDER) map.set(cat, [])
        for (const calc of visibleCalculators) {
            if (!map.has(calc.category)) map.set(calc.category, [])
            map.get(calc.category).push(calc)
        }
        return [...map.entries()].filter(([, items]) => items.length > 0)
    }, [visibleCalculators])

    const recentCalculators = useMemo(() => {
        if (searchInput.trim()) return []
        return recents.map((id) => CALCULATORS.find((c) => c.id === id)).filter(Boolean)
    }, [recents, searchInput])

    const active = CALCULATORS.find((c) => c.id === selectedId) || CALCULATORS[0]
    const ActiveCalculator = active.Component

    return (
        <div className="flex-1 overflow-y-auto bg-bg-secondary">
            <TopSection
                hidePlantFilter
                hideViewModeToggle
                isLoading={initialLoading}
                onClearSearch={() => setSearchInput('')}
                onSearchInputChange={setSearchInput}
                searchInput={searchInput}
                searchPlaceholder="Search calculators (name, keyword, or ACI section)"
                sticky
                title="Calculators"
            />
            <div className="px-3 sm:px-4 lg:px-6 py-4 flex gap-4">
                <CatalogNav
                    active={active}
                    grouped={grouped}
                    isMobile={isMobile}
                    onSelect={setSelectedId}
                    recentCalculators={recentCalculators}
                />
                <main className="flex-1 min-w-0 flex flex-col gap-4">
                    <ActiveCalculator />
                </main>
                <ReferenceRail active={active} isMobile={isMobile} />
            </div>
        </div>
    )
}

/* ─── Left rail · catalog ──────────────────────────────────────── */

function CatalogNav({ active, grouped, isMobile, onSelect, recentCalculators }) {
    if (isMobile) {
        return (
            <aside className="lg:hidden -mx-3 px-3 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {grouped.flatMap(([, items]) =>
                    items.map((c) => (
                        <CatalogChip key={c.id} calculator={c} isActive={c.id === active.id} onSelect={onSelect} />
                    ))
                )}
            </aside>
        )
    }
    return (
        <aside className="hidden lg:flex flex-col gap-3 w-[224px] shrink-0 self-start sticky top-2">
            <nav className="rounded border border-border-light bg-bg-primary overflow-hidden">
                <div className="px-3 py-2.5 border-b border-border-light">
                    <div className="text-[10.5px] font-bold uppercase tracking-[.08em] text-text-tertiary">
                        Calculators
                    </div>
                </div>
                <div className="flex flex-col">
                    {recentCalculators.length > 0 && (
                        <CategoryBlock title="Recent">
                            {recentCalculators.map((c) => (
                                <CatalogRow
                                    key={`recent-${c.id}`}
                                    calculator={c}
                                    isActive={c.id === active.id}
                                    onSelect={onSelect}
                                />
                            ))}
                        </CategoryBlock>
                    )}
                    {grouped.map(([cat, items]) => (
                        <CategoryBlock key={cat} title={cat}>
                            {items.map((c) => (
                                <CatalogRow
                                    key={c.id}
                                    calculator={c}
                                    isActive={c.id === active.id}
                                    onSelect={onSelect}
                                />
                            ))}
                        </CategoryBlock>
                    ))}
                    {grouped.length === 0 && (
                        <div className="px-3 py-5 text-center text-[12px] text-text-tertiary">No matches.</div>
                    )}
                </div>
            </nav>
        </aside>
    )
}

function CategoryBlock({ children, title }) {
    return (
        <div className="border-b border-border-light last:border-b-0">
            <div className="px-3 pt-2.5 pb-1">
                <div className="text-[9.5px] font-bold uppercase tracking-[.1em] text-text-tertiary">{title}</div>
            </div>
            <div className="flex flex-col pb-1.5">{children}</div>
        </div>
    )
}

function CatalogRow({ calculator, isActive, onSelect }) {
    return (
        <button
            type="button"
            onClick={() => onSelect(calculator.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-start gap-2.5 px-3 py-1.5 text-left border-l-[3px] transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ${
                isActive
                    ? 'bg-bg-secondary border-l-accent'
                    : 'border-l-transparent hover:bg-bg-secondary hover:border-l-border-medium'
            }`}
        >
            <i
                className={`fas ${calculator.icon} text-[11px] mt-0.5 ${
                    isActive ? 'text-accent' : 'text-text-tertiary'
                }`}
                aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold truncate text-text-primary">{calculator.name}</div>
                <div className="text-[10.5px] text-text-tertiary leading-tight truncate">{calculator.description}</div>
            </div>
        </button>
    )
}

function CatalogChip({ calculator, isActive, onSelect }) {
    return (
        <button
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
                isActive
                    ? 'bg-accent text-white border-accent'
                    : 'bg-bg-primary text-text-secondary border-border-light hover:bg-bg-tertiary'
            }`}
            onClick={() => onSelect(calculator.id)}
            type="button"
        >
            <i className={`fas ${calculator.icon} text-[11px]`} />
            {calculator.name}
        </button>
    )
}

/* ─── Right rail · ACI reference + per-tool standard ────────── */

function ReferenceRail({ active, isMobile }) {
    if (isMobile) return null
    return (
        <aside className="hidden xl:flex flex-col gap-3 w-[280px] shrink-0 self-start sticky top-2">
            <Panel innerClassName="p-3.5" title={active.standard?.ref || 'About this tool'}>
                <p className="text-[12px] leading-relaxed text-text-secondary m-0">
                    {active.standard?.body || active.description}
                </p>
            </Panel>
            <Panel innerClassName="p-0" title="Slump · ACI 211.1">
                <table className="w-full border-collapse">
                    <tbody>
                        {ACI_SLUMP_RANGES.map((row) => (
                            <tr className="border-b border-border-light last:border-b-0" key={row.application}>
                                <td className="px-3 py-1.5 text-[10.5px] text-text-secondary leading-tight">
                                    {row.application}
                                </td>
                                <td className="px-3 py-1.5 text-right text-[11px] font-semibold text-text-primary tabular-nums whitespace-nowrap">
                                    {row.minIn}&ndash;{row.maxIn}&quot;
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Panel>
            <Panel innerClassName="p-0" title="Max w/cm · ACI 318">
                <table className="w-full border-collapse">
                    <tbody>
                        {[
                            ['F1 · moderate freeze', '0.55'],
                            ['F2 · severe freeze', '0.45'],
                            ['F3 · freeze + salts', '0.40'],
                            ['S1 · moderate sulfate', '0.50'],
                            ['S2 / S3 · severe sulfate', '0.45'],
                            ['W2 · low-perm water', '0.50'],
                            ['C2 · chloride', '0.40']
                        ].map(([label, max]) => (
                            <tr className="border-b border-border-light last:border-b-0" key={label}>
                                <td className="px-3 py-1.5 text-[10.5px] text-text-secondary leading-tight">{label}</td>
                                <td className="px-3 py-1.5 text-right text-[11px] font-bold text-text-primary tabular-nums whitespace-nowrap">
                                    {max}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Panel>
        </aside>
    )
}

export default CalculatorView
