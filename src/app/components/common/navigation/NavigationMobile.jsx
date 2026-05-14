/* eslint-disable react/forbid-dom-props */
import React from 'react'

import SrmLogo from '../../../../assets/images/srm-logo.svg'
import {
    ADMIN_ITEMS,
    ASSET_ITEMS,
    buildHeaderStyle,
    PEOPLE_ITEMS,
    REPORTING_ITEMS,
    TOOLS_ITEMS
} from '../../../constants/navigationConstants'
import { MobileMenuItem, MobileRegionSelect, MobileSection } from './NavigationParts'

const SECTIONS = [
    { items: TOOLS_ITEMS, key: 'hasTools', title: 'Tools' },
    { items: ASSET_ITEMS, key: 'hasAssets', title: 'Assets' },
    { items: PEOPLE_ITEMS, key: 'hasPeople', title: 'People' },
    { items: REPORTING_ITEMS, key: 'hasReporting', title: 'Reporting' },
    { items: ADMIN_ITEMS, key: 'hasAdmin', title: 'Admin' }
]

/** Renders the mobile header bar and the slide-in navigation drawer. */
export default function NavigationMobile({
    children,
    accentColor,
    mobileMenuOpen,
    setMobileMenuOpen,
    regionCode,
    permittedRegions,
    handleRegionChange,
    visibleMenuItems,
    standaloneItems,
    groupFlags,
    selectedView,
    handleMenuClick
}) {
    const headerStyle = buildHeaderStyle(accentColor)
    const dashboardItem = standaloneItems.find((i) => i.id === 'Dashboard')
    return (
        <div className="flex flex-col h-screen w-full">
            <div
                style={{
                    ...headerStyle,
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    position: 'sticky',
                    top: 0,
                    zIndex: 100
                }}
            >
                <img className="h-[34px]" src={SrmLogo} alt="Logo" draggable={false} />
                <button
                    className="items-center rounded-[10px] cursor-pointer flex h-10 justify-center w-10"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    style={{
                        backgroundColor: mobileMenuOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: 'white'
                    }}
                >
                    <i className={`fas fa-${mobileMenuOpen ? 'times' : 'bars'}`}></i>
                </button>
            </div>
            {mobileMenuOpen && (
                <div
                    className="bg-[rgba(0,0,0,0.5)] fixed z-[200]"
                    style={{ bottom: 0, left: 0, right: 0, top: 0 }}
                    onClick={() => setMobileMenuOpen(false)}
                >
                    <div
                        className="bg-bg-primary h-full overflow-y-auto absolute w-[280px]"
                        style={{ boxShadow: 'var(--shadow)', padding: '20px', right: 0, top: 0 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <MobileRegionSelect
                            regionCode={regionCode}
                            permittedRegions={permittedRegions}
                            onChange={handleRegionChange}
                            accentColor={accentColor}
                        />
                        {dashboardItem && (
                            <MobileMenuItem
                                item={dashboardItem}
                                isActive={selectedView === 'Dashboard'}
                                onClick={() => handleMenuClick('Dashboard')}
                                accentColor={accentColor}
                            />
                        )}
                        {SECTIONS.map(({ key, items, title }) =>
                            groupFlags[key] ? (
                                <MobileSection key={title} title={title}>
                                    {items.map((id) => {
                                        const item = visibleMenuItems.find((i) => i.id === id)
                                        if (!item) return null
                                        return (
                                            <MobileMenuItem
                                                key={id}
                                                item={item}
                                                isActive={selectedView === id}
                                                onClick={() => handleMenuClick(id)}
                                                accentColor={accentColor}
                                            />
                                        )
                                    })}
                                </MobileSection>
                            ) : null
                        )}
                        {standaloneItems
                            .filter((i) => i.id !== 'Dashboard')
                            .map((item) => (
                                <MobileMenuItem
                                    key={item.id}
                                    item={item}
                                    isActive={selectedView === item.id}
                                    onClick={() => handleMenuClick(item.id)}
                                    accentColor={accentColor}
                                />
                            ))}
                        <MobileSection title="Account">
                            <MobileMenuItem
                                item={{ id: 'MyAccount', text: 'My Account' }}
                                isActive={selectedView === 'MyAccount'}
                                onClick={() => handleMenuClick('MyAccount')}
                                accentColor={accentColor}
                            />
                        </MobileSection>
                    </div>
                </div>
            )}
            <div className="flex-1 overflow-x-hidden overflow-y-auto relative" data-content-scroll>
                {children}
            </div>
        </div>
    )
}
