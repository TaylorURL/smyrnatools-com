import React, { useCallback, useEffect, useMemo, useState } from 'react'

import CalculatorShell, { CalcField, CalcSection } from '../CalculatorShell'
import { WATER_LBS_PER_GALLON } from './calculatorConstants'

/** Maps the risk level emitted by the calculator to a `CalculatorShell` status. */
const RISK_TO_STATUS = {
    cold: { kind: 'info', label: 'Cold' },
    cool: { kind: 'info', label: 'Cool' },
    hot: { kind: 'danger', label: 'Hot' },
    normal: { kind: 'success', label: 'Normal' },
    warm: { kind: 'warning', label: 'Warm' }
}

const formatHM = (hours, mins) => (hours > 0 ? `${hours}h ${mins}m` : `${mins}m`)

const getTimeOfDay = (hour) => {
    if (hour >= 10 && hour < 16) return { icon: 'fa-sun', short: 'Peak Sun' }
    if (hour >= 6 && hour < 10) return { icon: 'fa-cloud-sun', short: 'Morning' }
    if (hour >= 16 && hour < 20) return { icon: 'fa-cloud-sun', short: 'Evening' }
    return { icon: 'fa-moon', short: 'Night' }
}

const EMPTY_MIX = {
    addedWater: '',
    batchSize: '',
    cement: '',
    coarseAgg: '',
    fineAgg: '',
    slump: '',
    supplemental: '',
    water: ''
}
const EMPTY_MANUAL_WEATHER = { cloudCover: '', humidity: '', temperature: '' }

/**
 * Concrete set time estimator. Combines real-time geolocation weather (or
 * manual entry) with mix design parameters (W/C ratio, slump, cementitious
 * content, supplemental ratio) and time-of-day heuristics to predict
 * initial and final set times. Hosted inside `CalculatorShell` so the
 * predicted set times lead.
 */
const SetTimeCalculator = () => {
    const [weather, setWeather] = useState(null)
    const [loading, setLoading] = useState(false)
    const [locationError, setLocationError] = useState(null)
    const [useManual, setUseManual] = useState(false)
    const [manualWeather, setManualWeather] = useState(EMPTY_MANUAL_WEATHER)
    const [mixData, setMixData] = useState(EMPTY_MIX)

    const fetchWeather = useCallback(async (lat, lon) => {
        setLoading(true)
        setLocationError(null)
        try {
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,cloud_cover,relative_humidity_2m,wind_speed_10m&temperature_unit=fahrenheit`
            )
            const data = await response.json()
            if (data.current) {
                setWeather({
                    cloudCover: data.current.cloud_cover,
                    humidity: data.current.relative_humidity_2m,
                    temperature: data.current.temperature_2m,
                    windSpeed: data.current.wind_speed_10m
                })
            }
        } catch (err) {
            setLocationError('Failed to fetch weather data')
        }
        setLoading(false)
    }, [])

    const getLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation not supported')
            return
        }
        setLoading(true)
        navigator.geolocation.getCurrentPosition(
            (position) => fetchWeather(position.coords.latitude, position.coords.longitude),
            () => {
                setLocationError('Location access denied')
                setLoading(false)
            }
        )
    }, [fetchWeather])

    useEffect(() => {
        if (!useManual) getLocation()
    }, [useManual, getLocation])

    const handleManualWeatherChange = (field, value) => setManualWeather((prev) => ({ ...prev, [field]: value }))
    const handleMixChange = (field, value) => setMixData((prev) => ({ ...prev, [field]: value }))

    const result = useMemo(() => {
        const temp = useManual ? parseFloat(manualWeather.temperature) : weather?.temperature
        const batchSize = parseFloat(mixData.batchSize)
        const slump = parseFloat(mixData.slump)
        const cement = parseFloat(mixData.cement)
        const designWaterGalPerYd = parseFloat(mixData.water)
        const addedWaterGal = parseFloat(mixData.addedWater) || 0
        if (
            !temp ||
            isNaN(batchSize) ||
            batchSize <= 0 ||
            isNaN(slump) ||
            isNaN(cement) ||
            cement <= 0 ||
            isNaN(designWaterGalPerYd) ||
            designWaterGalPerYd <= 0
        ) {
            return null
        }

        const supplemental = parseFloat(mixData.supplemental) || 0
        const totalCementPerYd = cement + supplemental
        const designWaterLbsPerYd = designWaterGalPerYd * WATER_LBS_PER_GALLON
        const addedWaterLbsPerYd = (addedWaterGal * WATER_LBS_PER_GALLON) / batchSize
        const totalWaterLbsPerYd = designWaterLbsPerYd + addedWaterLbsPerYd
        const wc = totalCementPerYd > 0 ? totalWaterLbsPerYd / totalCementPerYd : 0
        const cloudCover = useManual ? parseFloat(manualWeather.cloudCover) || 50 : weather?.cloudCover || 50
        const humidity = useManual ? parseFloat(manualWeather.humidity) || 50 : weather?.humidity || 50
        const windSpeed = weather?.windSpeed || 5

        // Base set times in minutes under standard conditions (70F, 0.45 W/C, 4" slump).
        let baseInitialSet = 120
        let baseFinalSet = 480

        if (temp < 50) {
            const f = 1 + (50 - temp) * 0.03
            baseInitialSet *= f
            baseFinalSet *= f
        } else if (temp > 77) {
            const f = Math.max(1 - (temp - 77) * 0.015, 0.5)
            baseInitialSet *= f
            baseFinalSet *= f
        }
        if (wc > 0.5) {
            const f = 1 + (wc - 0.5) * 0.5
            baseInitialSet *= f
            baseFinalSet *= f
        } else if (wc < 0.4) {
            const f = 1 - (0.4 - wc) * 0.3
            baseInitialSet *= f
            baseFinalSet *= f
        }
        if (slump > 6) {
            const f = 1 + (slump - 6) * 0.04
            baseInitialSet *= f
            baseFinalSet *= f
        } else if (slump < 3) {
            baseInitialSet *= Math.max(1 - (3 - slump) * 0.03, 0.85)
            baseFinalSet *= Math.max(1 - (3 - slump) * 0.03, 0.9)
        }
        if (totalCementPerYd > 600) {
            baseInitialSet *= Math.max(1 - (totalCementPerYd - 600) * 0.0003, 0.7)
            baseFinalSet *= Math.max(1 - (totalCementPerYd - 600) * 0.0003, 0.75)
        } else if (totalCementPerYd < 400 && totalCementPerYd > 0) {
            baseInitialSet *= Math.min(1 + (400 - totalCementPerYd) * 0.0005, 1.3)
            baseFinalSet *= Math.min(1 + (400 - totalCementPerYd) * 0.0005, 1.25)
        }
        // SCMs (fly ash, slag) react more slowly than Portland cement.
        if (cement > 0 && supplemental > 0) {
            const r = supplemental / totalCementPerYd
            if (r > 0.2) {
                baseInitialSet *= 1 + r * 0.3
                baseFinalSet *= 1 + r * 0.2
            }
        }

        const hour = new Date().getHours()
        const isPeakSun = hour >= 10 && hour < 16
        const isMorning = hour >= 6 && hour < 10
        const isEvening = hour >= 16 && hour < 20
        const isNight = hour >= 20 || hour < 6
        if (isPeakSun && cloudCover < 25 && temp > 70) {
            baseInitialSet *= 0.85
            baseFinalSet *= 0.8
        } else if (isPeakSun && cloudCover < 50 && temp > 65) {
            baseInitialSet *= 0.9
            baseFinalSet *= 0.85
        } else if ((isMorning || isEvening) && cloudCover < 30 && temp > 70) {
            baseInitialSet *= 0.95
            baseFinalSet *= 0.92
        } else if (isNight) {
            baseInitialSet *= 1.1
            baseFinalSet *= 1.08
        }
        if (humidity < 40) baseInitialSet *= 0.95
        else if (humidity > 80) baseInitialSet *= 1.05
        if (windSpeed > 15) baseInitialSet *= 0.9

        let riskLevel = 'normal'
        let riskMessage = ''
        if (temp < 40) {
            riskLevel = 'cold'
            riskMessage = 'Cold weather may significantly delay set. Consider heated enclosures or accelerators.'
        } else if (temp < 50) {
            riskLevel = 'cool'
            riskMessage = 'Cool conditions will extend set time. Monitor closely.'
        } else if (temp > 90) {
            riskLevel = 'hot'
            riskMessage = 'Hot weather may cause rapid set. Consider retarders or ice water.'
        } else if (temp > 80 && cloudCover < 30) {
            riskLevel = 'warm'
            riskMessage = 'Direct sun exposure will accelerate set. Plan accordingly.'
        } else if (isNight && temp < 60) {
            riskLevel = 'cool'
            riskMessage = 'Nighttime placement with cooler temps will extend set time.'
        }

        return {
            cementPerYd: Math.round(totalCementPerYd),
            cloudCover,
            finalSet: {
                hours: Math.floor(baseFinalSet / 60),
                mins: Math.round(baseFinalSet % 60),
                total: baseFinalSet
            },
            humidity,
            initialSet: {
                hours: Math.floor(baseInitialSet / 60),
                mins: Math.round(baseInitialSet % 60),
                total: baseInitialSet
            },
            riskLevel,
            riskMessage,
            slump,
            temp,
            wc: Math.round(wc * 100) / 100
        }
    }, [weather, mixData, manualWeather, useManual])

    const clearForm = () => {
        setMixData(EMPTY_MIX)
        setManualWeather(EMPTY_MANUAL_WEATHER)
    }

    const stats = useMemo(() => {
        if (!result) return []
        return [
            { label: 'Air Temp', value: `${Math.round(result.temp)}°F` },
            { label: 'W/C Ratio', value: result.wc.toFixed(2) },
            { label: 'Cement / yd', value: `${result.cementPerYd} lb` },
            { label: 'Slump', value: `${result.slump.toFixed(1)} in` }
        ]
    }, [result])

    const renderManualField = ({ field, label, max, min, placeholder, unit }) => (
        <CalcField
            key={field}
            label={label}
            max={max}
            min={min}
            onChange={(value) => handleManualWeatherChange(field, value)}
            placeholder={placeholder}
            suffix={unit}
            value={manualWeather[field]}
        />
    )

    const renderMixField = ({ field, label, placeholder, step, unit }) => (
        <CalcField
            key={field}
            label={label}
            onChange={(value) => handleMixChange(field, value)}
            placeholder={placeholder}
            step={step}
            suffix={unit}
            value={mixData[field]}
        />
    )

    const todHour = new Date().getHours()
    const tod = getTimeOfDay(todHour)

    return (
        <CalculatorShell
            icon="fa-clock"
            onReset={clearForm}
            placeholder="Enter weather and mix design (cement, water, slump, batch size) to predict set time"
            placeholderIcon="fa-clock"
            primary={
                result
                    ? { label: 'initial set', value: formatHM(result.initialSet.hours, result.initialSet.mins) }
                    : null
            }
            secondary={
                result ? { label: 'final set', value: formatHM(result.finalSet.hours, result.finalSet.mins) } : null
            }
            stats={stats}
            status={result ? RISK_TO_STATUS[result.riskLevel] : null}
            title="Set Time Predictor"
        >
            <div className="flex flex-col gap-5">
                <CalcSection
                    action={
                        <button
                            type="button"
                            onClick={() => setUseManual(!useManual)}
                            className={`font-semibold rounded text-xs px-2.5 py-1 cursor-pointer transition-colors ${useManual ? 'bg-blue-50 border border-accent text-accent' : 'bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                        >
                            {useManual ? 'Use Location' : 'Manual Entry'}
                        </button>
                    }
                    icon="fa-cloud-sun"
                    title="Weather Conditions"
                >
                    {useManual ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {[
                                { field: 'temperature', label: 'Temperature', placeholder: '72', unit: '°F' },
                                {
                                    field: 'cloudCover',
                                    label: 'Cloud Cover',
                                    max: '100',
                                    min: '0',
                                    placeholder: '50',
                                    unit: '%'
                                },
                                {
                                    field: 'humidity',
                                    label: 'Humidity',
                                    max: '100',
                                    min: '0',
                                    placeholder: '50',
                                    unit: '%'
                                }
                            ].map(renderManualField)}
                            <div className="md:col-span-3 flex items-center justify-center gap-2 rounded-lg bg-blue-50 text-accent font-semibold text-xs py-2 px-3">
                                <i className={`fas ${tod.icon}`} />
                                <span>{tod.short}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-light)] min-h-[88px] p-3">
                            {loading && (
                                <div className="flex items-center gap-3 text-[var(--text-secondary)] text-sm">
                                    <i className="fas fa-spinner fa-spin" />
                                    <span>Getting weather…</span>
                                </div>
                            )}
                            {locationError && (
                                <div className="flex flex-col items-center gap-2 text-text-primary text-sm text-center">
                                    <i className="fas fa-exclamation-circle text-xl" />
                                    <span>{locationError}</span>
                                    <button
                                        onClick={getLocation}
                                        className="bg-[var(--card-background)] border border-red-500 rounded text-text-primary cursor-pointer text-xs font-semibold py-1 px-2 hover:bg-red-50"
                                    >
                                        <i className="fas fa-redo" /> Retry
                                    </button>
                                </div>
                            )}
                            {weather && !loading && (
                                <div className="flex flex-wrap justify-center items-center gap-5">
                                    <div className="flex items-center gap-2 text-accent font-bold text-lg">
                                        <i className="fas fa-thermometer-half" />
                                        <span>{Math.round(weather.temperature)}°F</span>
                                    </div>
                                    {[
                                        { icon: tod.icon, label: tod.short },
                                        { icon: 'fa-cloud', label: `${weather.cloudCover}% clouds` },
                                        { icon: 'fa-tint', label: `${weather.humidity}% RH` },
                                        { icon: 'fa-wind', label: `${Math.round(weather.windSpeed)} mph` }
                                    ].map((stat, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center gap-2 text-[var(--text-secondary)] text-xs font-semibold"
                                        >
                                            <i className={`fas ${stat.icon}`} />
                                            <span>{stat.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </CalcSection>

                <CalcSection title="Mix Design (per yard)">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { field: 'cement', label: 'Primary Powder', placeholder: '0', unit: 'lbs/yd' },
                            { field: 'supplemental', label: 'Supplemental', placeholder: '0', unit: 'lbs/yd' },
                            { field: 'water', label: 'Design Water', placeholder: '0', unit: 'gal/yd' },
                            { field: 'slump', label: 'Slump', placeholder: '4', step: '0.5', unit: 'in' }
                        ].map(renderMixField)}
                    </div>
                </CalcSection>

                <CalcSection title="Batch Info">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                            { field: 'batchSize', label: 'Batch Size', placeholder: '10', step: '0.5', unit: 'yd' },
                            { field: 'addedWater', label: 'Added Water', placeholder: '0', unit: 'gal' }
                        ].map(renderMixField)}
                    </div>
                </CalcSection>

                {result?.riskMessage && (
                    <div
                        className={`flex items-start gap-3 rounded-lg border text-sm font-medium p-3 text-text-primary ${
                            result.riskLevel === 'hot'
                                ? 'bg-red-50 border-red-300'
                                : result.riskLevel === 'cold' || result.riskLevel === 'cool'
                                  ? 'bg-blue-50 border-blue-300'
                                  : 'bg-amber-50 border-amber-300'
                        }`}
                    >
                        <i className="fas fa-exclamation-triangle mt-0.5" />
                        <span>{result.riskMessage}</span>
                    </div>
                )}

                <div className="flex items-center gap-2 text-[var(--text-tertiary)] text-[11px] italic">
                    <i className="fas fa-info-circle" />
                    <span>Estimates only. Actual set times vary by mix design and conditions.</span>
                </div>
            </div>
        </CalculatorShell>
    )
}

export default SetTimeCalculator
