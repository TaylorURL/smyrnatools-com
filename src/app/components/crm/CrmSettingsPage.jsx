/* eslint-disable react/forbid-dom-props */
import React, { useCallback, useState } from 'react'

import CrmService from '../../../services/CrmService'
import { CrmPanel as Panel } from './CrmSection'

const MAX_BATCHES = 40
const BATCH_LIMIT = 15

/** CRM Settings — map geocoding, wrapped in the flat Panel primitive so it
 *  reads as part of the site rather than a foreign card. */
export function CrmSettingsPage({ accentColor }) {
    const [isRunning, setIsRunning] = useState(false)
    const [totalGeocoded, setTotalGeocoded] = useState(0)
    const [totalFailed, setTotalFailed] = useState(0)
    const [currentRemaining, setCurrentRemaining] = useState(null)
    const [isDone, setIsDone] = useState(false)
    const [errorMessage, setErrorMessage] = useState(null)

    const handleGeocode = useCallback(async () => {
        setIsRunning(true)
        setIsDone(false)
        setErrorMessage(null)
        setTotalGeocoded(0)
        setTotalFailed(0)
        setCurrentRemaining(null)

        let accumulatedGeocoded = 0
        let accumulatedFailed = 0

        try {
            for (let batch = 0; batch < MAX_BATCHES; batch++) {
                const { geocoded, failed, remaining } = await CrmService.geocodeAccounts({ limit: BATCH_LIMIT })
                accumulatedGeocoded += geocoded
                accumulatedFailed += failed
                setTotalGeocoded(accumulatedGeocoded)
                setTotalFailed(accumulatedFailed)
                setCurrentRemaining(remaining)
                if (remaining === 0) break
            }
        } catch (err) {
            setErrorMessage(err?.message || 'Geocoding failed — check the console for details.')
        } finally {
            setIsRunning(false)
            setIsDone(true)
        }
    }, [])

    const buttonLabel = isRunning ? 'Geocoding…' : 'Geocode accounts'

    return (
        <div className="flex flex-col gap-4 animate-fade-in-up">
            <Panel title="Map geocoding" innerClassName="p-4">
                <p className="text-[12px] text-text-secondary m-0 mb-3 leading-relaxed">
                    Account locations must be geocoded before they appear on the Map tab. This runs the US Census
                    geocoder against each account&apos;s address and saves latitude/longitude coordinates. Process up to
                    25 accounts per batch — click again to continue if more remain.
                </p>

                <div className="flex items-center gap-3 flex-wrap">
                    <button type="button"
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-white transition-opacity disabled:opacity-60 active:scale-[0.97]"
                        disabled={isRunning}
                        onClick={handleGeocode}
                        style={{ backgroundColor: accentColor }}
                        type="button"
                    >
                        {isRunning && (
                            <span
                                aria-hidden="true"
                                className="block w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"
                            />
                        )}
                        {buttonLabel}
                    </button>

                    {isRunning && currentRemaining !== null && (
                        <span className="text-[12px] text-text-secondary">
                            Geocoded {totalGeocoded} so far…&nbsp;({currentRemaining} remaining)
                        </span>
                    )}

                    {isRunning && currentRemaining === null && (
                        <span className="text-[12px] text-text-secondary">Starting…</span>
                    )}
                </div>

                {isDone && !errorMessage && (
                    <p className="text-[12px] text-green-600 dark:text-green-400 m-0 mt-3">
                        Done — geocoded {totalGeocoded} account{totalGeocoded !== 1 ? 's' : ''}
                        {totalFailed > 0 ? `, ${totalFailed} failed` : ''}.
                        {currentRemaining != null && currentRemaining > 0
                            ? ` ${currentRemaining} still need geocoding — click again to continue.`
                            : ''}
                    </p>
                )}

                {errorMessage && <p className="text-[12px] text-red-600 dark:text-red-400 m-0 mt-3">{errorMessage}</p>}
            </Panel>
        </div>
    )
}

export default CrmSettingsPage
