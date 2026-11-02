import React, { useState } from 'react'

import AssetView from '../../../views/assets/AssetView'
import TabFadeIn from '../common/TabFadeIn'
import PageHeader from '../ui/PageHeader'
import AssetStatisticsView from './statistics/AssetStatisticsView'

const BASE_TABS = [
    { id: 'list', label: 'List' },
    { id: 'statistics', label: 'Statistics' }
]

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
    const [activeTab, setActiveTab] = useState('list')

    const tabs = BASE_TABS

    if (embedded) {
        return (
            <AssetView
                config={config}
                embedded
                hideSectionTitle
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
            <PageHeader
                title={title || config.pluralLabel}
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
            />
            <TabFadeIn animationKey={activeTab} className="flex-1 min-h-0 flex flex-col">
                {activeTab === 'list' && (
                    <AssetView
                        config={config}
                        embedded={false}
                        hideSectionTitle
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
