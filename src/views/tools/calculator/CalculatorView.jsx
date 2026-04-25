import React, { useEffect, useMemo, useState } from 'react'

import { ReportsActionBar } from '../../../app/components/reports/ReportsToolbar'
import TopSection from '../../../app/components/sections/TopSection'
import ProportionsCalculator from './types/ProportionsCalculator'
import SetTimeCalculator from './types/SetTimeCalculator'
import SlumpAdjustmentCalculator from './types/SlumpAdjustmentCalculator'
import WaterCementCalculator from './types/WaterCementCalculator'
import YardagePerHourCalculator from './types/YardagePerHourCalculator'

/** Tab definitions for each concrete industry calculator surfaced in the action bar. */
const CALCULATOR_TYPES = [
    { icon: 'fa-tachometer-alt', id: 'yardage-hour', name: 'Yd/Hr' },
    { icon: 'fa-balance-scale', id: 'proportions', name: 'Overweight Fix' },
    { icon: 'fa-arrows-alt-v', id: 'slump', name: 'Slump Adjust' },
    { icon: 'fa-tint', id: 'water-cement', name: 'W/C Ratio' },
    { icon: 'fa-clock', id: 'set-time', name: 'Set Time' }
]

const CALCULATOR_COMPONENTS = {
    proportions: ProportionsCalculator,
    'set-time': SetTimeCalculator,
    slump: SlumpAdjustmentCalculator,
    'water-cement': WaterCementCalculator,
    'yardage-hour': YardagePerHourCalculator
}

/**
 * Calculator hub. Wraps the active concrete calculator in the same chrome as
 * the rest of the app — sticky `TopSection` with a search input and a slim
 * Plan/Reports-style action bar that hosts the pill-segmented tab control.
 * Search filters which calculator pills are visible so a user can jump to a
 * specific tool by name.
 */
const CalculatorView = () => {
    const [selectedCalculator, setSelectedCalculator] = useState('yardage-hour')
    const [searchInput, setSearchInput] = useState('')
    const [initialLoading, setInitialLoading] = useState(true)

    useEffect(() => {
        const timer = setTimeout(() => setInitialLoading(false), 150)
        return () => clearTimeout(timer)
    }, [])

    const visibleTabs = useMemo(() => {
        const search = searchInput.trim().toLowerCase()
        const filtered = search
            ? CALCULATOR_TYPES.filter((c) => c.name.toLowerCase().includes(search))
            : CALCULATOR_TYPES
        return filtered.map((c) => ({ icon: c.icon, key: c.id, label: c.name }))
    }, [searchInput])

    const ActiveCalculator = CALCULATOR_COMPONENTS[selectedCalculator]

    return (
        <div className="bg-slate-50 min-h-full w-full pb-16">
            <TopSection
                title="Calculators"
                sticky
                hidePlantFilter
                hideViewModeToggle
                isLoading={initialLoading}
                searchInput={searchInput}
                searchPlaceholder="Search calculators"
                onSearchInputChange={setSearchInput}
                onClearSearch={() => setSearchInput('')}
            />
            <ReportsActionBar tabs={visibleTabs} activeTab={selectedCalculator} onTabChange={setSelectedCalculator} />
            <main className="px-3 sm:px-4 md:px-6 lg:px-8 py-4">
                {ActiveCalculator ? (
                    <ActiveCalculator />
                ) : (
                    <div className="rounded-xl text-center p-8 md:p-16 bg-white border border-border-light">
                        <div className="text-4xl md:text-6xl mb-4 md:mb-6 text-slate-400">
                            <i className="fas fa-hard-hat" />
                        </div>
                        <h3 className="text-lg md:text-2xl font-bold m-0 text-slate-900">Coming Soon</h3>
                        <p className="text-sm md:text-base mt-2 mb-0 text-slate-500">
                            This calculator is under development
                        </p>
                    </div>
                )}
            </main>
        </div>
    )
}

export default CalculatorView
