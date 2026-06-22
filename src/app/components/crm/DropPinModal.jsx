/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useRef, useState } from 'react'

import CrmService from '../../../services/CrmService'

/** Safe check for SpeechRecognition API — works in SSR/jsdom without crashing. */
function getSpeechRecognitionConstructor() {
    if (typeof window === 'undefined') return null
    return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

/**
 * Modal for dropping a GPS pin with an optional voice/typed job note.
 *
 * @param {object} props
 * @param {string} props.accentColor
 * @param {{ lat: number, lng: number } | null} props.location - Captured coordinates, or null if GPS failed.
 * @param {() => void} props.onClose
 * @param {(savedPin: object) => void} props.onSaved
 */
export function DropPinModal({ accentColor, location, onClose, onSaved }) {
    const [comment, setComment] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [saveError, setSaveError] = useState(null)
    const [isRecording, setIsRecording] = useState(false)

    const recognitionRef = useRef(null)
    const SpeechRecognition = getSpeechRecognitionConstructor()
    const hasSpeechApi = !!SpeechRecognition

    /** Close on Escape key. */
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

    /** Clean up speech recognition on unmount. */
    useEffect(() => {
        return () => {
            recognitionRef.current?.stop()
        }
    }, [])

    const handleToggleRecording = () => {
        if (isRecording) {
            recognitionRef.current?.stop()
            setIsRecording(false)
            return
        }

        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

        let finalTranscript = ''

        recognition.onresult = (event) => {
            let interimTranscript = ''
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const text = event.results[i][0].transcript
                if (event.results[i].isFinal) {
                    finalTranscript += text + ' '
                } else {
                    interimTranscript += text
                }
            }
            setComment((prev) => {
                const base = prev.trimEnd()
                const separator = base ? ' ' : ''
                return base + separator + finalTranscript + interimTranscript
            })
        }

        recognition.onend = () => {
            setIsRecording(false)
            recognitionRef.current = null
        }

        recognition.onerror = () => {
            setIsRecording(false)
            recognitionRef.current = null
        }

        recognitionRef.current = recognition
        recognition.start()
        setIsRecording(true)
    }

    const handleSave = async () => {
        if (!location) return
        setIsSaving(true)
        setSaveError(null)
        try {
            const savedPin = await CrmService.savePin({ lat: location.lat, lng: location.lng, comment })
            onSaved(savedPin)
            onClose()
        } catch (err) {
            setSaveError(err.message || 'Failed to save pin')
        } finally {
            setIsSaving(false)
        }
    }

    const locationUnavailable = !location

    return (
        /* Scrim */
        <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            {/* Panel */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Drop a pin"
                className="relative w-full max-w-sm rounded-md bg-bg-primary border border-border-light shadow-modal p-5 flex flex-col gap-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <i className="fas fa-map-pin text-[16px]" style={{ color: accentColor }} aria-hidden="true" />
                        <h2 className="text-[15px] font-bold text-text-primary m-0">Drop a pin</h2>
                    </div>
                    <button type="button"
                        type="button"
                        aria-label="Close"
                        onClick={onClose}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border-none bg-transparent text-text-tertiary hover:text-text-primary hover:bg-bg-hover cursor-pointer transition-colors duration-150"
                    >
                        <i className="fas fa-times text-[13px]" aria-hidden="true" />
                    </button>
                </div>

                {/* Location status */}
                {locationUnavailable ? (
                    <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
                        <i className="fas fa-triangle-exclamation text-[12px] text-red-500" aria-hidden="true" />
                        <p className="text-[12.5px] text-red-600 dark:text-red-400 m-0">
                            Couldn&apos;t get your location. Check location permissions and try again.
                        </p>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 rounded-md bg-bg-secondary border border-border-light px-3 py-2">
                        <i className="fas fa-location-dot text-[12px] text-text-tertiary" aria-hidden="true" />
                        <p className="text-[12px] text-text-secondary m-0">
                            Location captured: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                        </p>
                    </div>
                )}

                {/* Comment field */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                        <label
                            htmlFor="pin-comment"
                            className="text-[12px] font-semibold text-text-secondary uppercase tracking-[0.06em]"
                        >
                            Job notes
                        </label>
                        {hasSpeechApi && (
                            <button type="button"
                                type="button"
                                aria-label={isRecording ? 'Stop recording' : 'Start voice dictation'}
                                onClick={handleToggleRecording}
                                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold border-none cursor-pointer transition-colors duration-150 ${
                                    isRecording
                                        ? 'bg-red-500/15 text-red-500'
                                        : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                                }`}
                            >
                                <i
                                    className={`fas fa-microphone text-[11px] ${isRecording ? 'animate-pulse' : ''}`}
                                    aria-hidden="true"
                                />
                                <span>{isRecording ? 'Recording…' : 'Mic'}</span>
                            </button>
                        )}
                    </div>
                    <textarea
                        id="pin-comment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="What's happening at this location?"
                        rows={3}
                        className="w-full resize-none rounded-md border border-border-light bg-bg-secondary px-3 py-2 text-[13px] text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-[box-shadow] duration-150"
                    />
                </div>

                {/* Error */}
                {saveError && <p className="text-[12px] text-red-500 m-0">{saveError}</p>}

                {/* Actions */}
                <div className="flex items-center gap-2 justify-end">
                    <button type="button"
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold border-none bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover cursor-pointer transition-colors duration-150 active:scale-[0.97]"
                    >
                        Cancel
                    </button>
                    <button type="button"
                        type="button"
                        disabled={locationUnavailable || isSaving}
                        onClick={handleSave}
                        className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold border-none text-white cursor-pointer transition-[background-color,transform,opacity] duration-150 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: accentColor }}
                    >
                        {isSaving ? (
                            <>
                                <i className="fas fa-circle-notch fa-spin text-[11px]" aria-hidden="true" />
                                <span>Saving…</span>
                            </>
                        ) : (
                            <>
                                <i className="fas fa-map-pin text-[11px]" aria-hidden="true" />
                                <span>Save pin</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default DropPinModal
