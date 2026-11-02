import React from 'react'

import {
    ACCENT_PRESETS,
    clampColorToMaxBrightness,
    FIELD_LABEL_CLASS,
    FieldStyle,
    MAX_BRIGHTNESS_HEX
} from '../../../constants/myAccountConstants'
import { Card, CardHeader, SegmentedControl, SubtleButton, Toggle } from '../MyAccountAtoms'
import StartPageDropdown from '../StartPageDropdown'

/** Preferences tab body — start page, appearance (accent + theme), nav style,
 *  tutorials toggle, cache reset. */
export default function PreferencesTab({
    accentColor,
    cacheClearing,
    isMobile,
    onClearCache,
    onResetTutorials,
    preferences,
    themeMode,
    updatePreferences
}) {
    return (
        <>
            <section id="startpage" className="scroll-mt-4">
                <Card>
                    <CardHeader title="Start page" description="Choose which page loads when you open the app" />
                    <div className="px-5 py-5">
                        <StartPageDropdown
                            value={preferences.startPage || 'Dashboard'}
                            accentColor={accentColor}
                            onChange={(id) => updatePreferences('startPage', id)}
                        />
                    </div>
                </Card>
            </section>

            <section id="appearance" className="scroll-mt-4">
                <Card>
                    <CardHeader title="Appearance" description="Customize the look of the application" />
                    <div className="px-5 py-5 grid gap-5 md:grid-cols-2">
                        <div>
                            <div className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                Accent color
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5">
                                {ACCENT_PRESETS.map(({ color, name }) => {
                                    const isActive = (preferences.accentColor || '#2A3163') === color
                                    return (
                                        <button
                                            type="button"
                                            key={color}
                                            onClick={() => updatePreferences('accentColor', color)}
                                            className="h-9 w-9 cursor-pointer rounded-[4px] border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
                                            style={{
                                                background: color,
                                                boxShadow: isActive
                                                    ? `0 0 0 2px var(--bg-primary), 0 0 0 4px var(--text-primary)`
                                                    : 'none'
                                            }}
                                            title={name}
                                            aria-label={`Set accent color to ${name}`}
                                            aria-pressed={isActive}
                                        />
                                    )
                                })}
                                <div className="relative">
                                    <input
                                        type="color"
                                        value={preferences.accentColor || '#2A3163'}
                                        onChange={(e) => {
                                            const clampedColor = clampColorToMaxBrightness(e.target.value)
                                            updatePreferences('accentColor', clampedColor)
                                        }}
                                        className="absolute inset-0 h-9 w-9 cursor-pointer opacity-0"
                                        aria-label="Custom accent color"
                                    />
                                    <div className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-bg-primary border border-border-medium text-text-secondary">
                                        <i className="fas fa-eyedropper text-[13px]" />
                                    </div>
                                </div>
                            </div>
                            <p className="mt-2.5 text-[11px] text-text-tertiary">
                                Very light colors will be clamped for readability (max {MAX_BRIGHTNESS_HEX})
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2.5">
                                <div className="flex h-9 items-center gap-2 rounded-[4px] px-3" style={FieldStyle}>
                                    <div className="h-4 w-4 rounded-[3px]" style={{ background: accentColor }} />
                                    <span className="font-mono text-[13px] tabular-nums text-text-primary">
                                        {(preferences.accentColor || '#2A3163').toUpperCase()}
                                    </span>
                                </div>
                                {preferences.accentColor && preferences.accentColor !== '#2A3163' && (
                                    <SubtleButton
                                        icon="fa-undo"
                                        onClick={() => updatePreferences('accentColor', '#2A3163')}
                                    >
                                        Reset
                                    </SubtleButton>
                                )}
                            </div>
                        </div>

                        <div>
                            <div className={FIELD_LABEL_CLASS} style={{ color: 'var(--text-secondary)' }}>
                                Theme
                            </div>
                            <SegmentedControl
                                accentColor={accentColor}
                                options={[
                                    { icon: 'fa-sun', label: 'Light', value: 'light' },
                                    { icon: 'fa-moon', label: 'Dark', value: 'dark' }
                                ]}
                                value={themeMode}
                                onChange={(v) => updatePreferences('themeMode', v)}
                            />
                        </div>
                    </div>
                </Card>
            </section>

            <section id="navigation" className="scroll-mt-4">
                <Card>
                    <CardHeader
                        title="Navigation"
                        description="Show the sidebar with labels, or as a narrow strip of icons"
                    />
                    <div className="px-5 py-5">
                        <SegmentedControl
                            accentColor={accentColor}
                            options={[
                                { icon: 'fa-table-columns', label: 'Full sidebar', value: 'top_bar_basic' },
                                { icon: 'fa-grip-lines-vertical', label: 'Compact sidebar', value: 'two_level_tabs' }
                            ]}
                            value={preferences.navStyle || 'top_bar_basic'}
                            onChange={(v) => updatePreferences('navStyle', v)}
                        />
                    </div>
                </Card>
            </section>

            {!isMobile && (
                <section id="tutorials" className="scroll-mt-4">
                    <Card>
                        <CardHeader title="Tutorials" description="Manage tutorial hints and guides" />
                        <div className="px-5 py-5 flex flex-col items-start gap-4">
                            <div className="flex w-full items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="text-[14px] font-medium text-text-primary">Show tutorials</div>
                                    <div className="text-[12px] mt-0.5 text-text-secondary">
                                        Show helpful tips and guides throughout the app
                                    </div>
                                </div>
                                <Toggle
                                    accentColor={accentColor}
                                    ariaLabel="Toggle tutorials"
                                    checked={!!preferences.tutorials}
                                    onChange={() => updatePreferences('tutorials', !preferences.tutorials)}
                                />
                            </div>
                            <SubtleButton icon="fa-redo" onClick={onResetTutorials}>
                                Reset tutorials
                            </SubtleButton>
                        </div>
                    </Card>
                </section>
            )}

            <section id="cache" className="scroll-mt-4">
                <Card>
                    <CardHeader title="Cache" description="Clear cached data to free up space and fix stale content" />
                    <div className="px-5 py-5">
                        <SubtleButton
                            disabled={cacheClearing}
                            icon={cacheClearing ? 'fa-spinner animate-dv-spin' : 'fa-broom'}
                            onClick={onClearCache}
                        >
                            {cacheClearing ? 'Clearing…' : 'Clear all caches'}
                        </SubtleButton>
                    </div>
                </Card>
            </section>
        </>
    )
}
