/* eslint-disable react/forbid-dom-props */
import React, { useState } from 'react'

import AssetView from '../../../views/assets/AssetView'
import { DEFAULT_ACCENT_COLOR } from '../../constants/themeConstants'
import { usePreferences } from '../../context/PreferencesContext'
import TabFadeIn from '../common/TabFadeIn'
import AssetStatisticsView from './statistics/AssetStatisticsView'

const BASE_TABS = [
    { icon: 'fa-list', id: 'list', label: 'List' },
    { icon: 'fa-chart-column', id: 'statistics', label: 'Statistics' }
]

/** Tab strip for the shell. The active pill is filled with the user's chosen
 *  accent, which is a runtime preference rather than a theme token, so it has
 *  to be applied as an inline style. */
function AssetTabBar({ accentColor, activeTab, onChange, tabs }) {
    return (
        <div
            className="flex items-center gap-1 rounded-lg p-0.5 bg-bg-tertiary border border-border-light"
            role="tablist"
        >
            {tabs.map((tab) => {
                const active = tab.id === activeTab
                return (
                    <button
                        type="button"
                        key={tab.id}
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(tab.id)}
                        className="flex items-center gap-1.5 rounded-md text-[12px] font-semibold border-none cursor-pointer px-3 py-1.5 transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none active:scale-[0.97]"
                        style={{
                            background: active ? accentColor : 'transparent',
                            color: active ? 'var(--on-accent)' : 'var(--text-secondary)'
                        }}
                    >
                        <i className={`fas ${tab.icon} text-[11px]`} />
                        <span>{tab.label}</span>
                    </button>
                )
            })}
        </div>
    )
}

/**
 * Header and tab chrome around one asset type's two surfaces: the list
 * (`AssetView`) and the statistics dashboard (`AssetStatisticsView`). Both are
 * driven by the same asset `config`, and only the active one is mounted, so
 * each owns its own `useAssetData` subscription and neither holds state for
 * the other. Switching tabs unmounts the one being left, so anything it did
 * not persist — scroll position, sort order, open rows — is gone on return.
 *
 * Embedded callers get `AssetView` on its own with no header or tabs, because
 * the shell's chrome would compete with the modal already framing it.
 */
export default function AssetViewShell({
    config,
    embedded = false,
    exactMatch = false,
    initialSearch = '',
    onSelectItem,
    setSelectedView,
    title
}) {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || DEFAULT_ACCENT_COLOR
    const [activeTab, setActiveTab] = useState('list')

    const tabs = BASE_TABS

    if (embedded) {
        return (
            <AssetView
                config={config}
                embedded
                exactMatch={exactMatch}
                initialSearch={initialSearch}
                onSelectItem={onSelectItem}
                setSelectedView={setSelectedView}
                title={title}
            />
        )
    }

    return (
        <div className={`flex flex-col h-full ${config.viewClassName}-shell`}>
            <div className="flex items-center justify-between flex-wrap gap-2 px-3 sm:px-4 md:px-6 pt-3 pb-2 border-b border-border-light bg-bg-primary">
                <div className="flex items-center gap-3">
                    <i className={`fas ${config.icon} text-[14px]`} style={{ color: accentColor }} />
                    <span className="text-[14px] font-bold text-text-primary">{title || config.pluralLabel}</span>
                </div>
                <AssetTabBar accentColor={accentColor} activeTab={activeTab} onChange={setActiveTab} tabs={tabs} />
            </div>
            <TabFadeIn animationKey={activeTab} className="flex-1 min-h-0 flex flex-col">
                {activeTab === 'list' && (
                    <AssetView
                        config={config}
                        embedded={false}
                        exactMatch={exactMatch}
                        initialSearch={initialSearch}
                        onSelectItem={onSelectItem}
                        setSelectedView={setSelectedView}
                        title={title}
                    />
                )}
                {activeTab === 'statistics' && (
                    <AssetStatisticsView
                        config={config}
                        onSelectAsset={(row) => row?.id && onSelectItem?.(row.id)}
                        title={title || config.pluralLabel}
                    />
                )}
            </TabFadeIn>
        </div>
    )
}
