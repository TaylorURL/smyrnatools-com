/* eslint-disable react/forbid-dom-props */
import React, { useRef, useState } from 'react'

import { usePreferences } from '../../../../../app/context/PreferencesContext'
import {
    ALLOWED_FILE_TYPE,
    DUMP_LOCATIONS,
    MAX_FILE_SIZE_MB,
    REASONS
} from '../../../../constants/lostLoadModalConstants'
import { useLostLoadFormData } from '../../../../hooks/useLostLoadFormData'
import { useLostLoadSubmit } from '../../../../hooks/useLostLoadSubmit'
import AttachmentField from './modal/AttachmentField'
import { parseInitialDumpLocation, parseInitialReason } from './modal/helpers'
import OptionRadioGroup from './modal/OptionRadioGroup'
import ReprimandToggles from './modal/ReprimandToggles'
import TruckPicker from './modal/TruckPicker'

/* Shared form-control classes so every input in this modal shares one focus
   ring + hover + placeholder treatment across the three themes. `[color-scheme]`
   keeps native date popups in sync with the active theme. */
const INPUT_BASE =
    'rounded-lg px-3 py-2.5 text-sm bg-bg-primary border border-border-light text-text-primary placeholder:text-text-tertiary transition-colors duration-150 hover:border-border-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:border-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed'
const FIELD_INPUT_CLS = `${INPUT_BASE} [color-scheme:light] dark:[color-scheme:dark]`
const FIELD_TEXTAREA_CLS = `${INPUT_BASE} resize-y`

/** Modal form for submitting or editing a lost load report. Plant is
 *  auto-populated from the user's assigned plant. When `initialReport` is
 *  provided the modal runs in edit mode and UPDATEs the existing row. */
function LostLoadReportModal({ onClose, onSubmitted, plants, user, initialReport = null }) {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'
    const fileInputRef = useRef(null)
    const isEditing = !!initialReport?.id
    const initialData = initialReport?.data || {}
    const initialReason = parseInitialReason(initialData.reason)
    const initialDump = parseInitialDumpLocation(initialData.dump_location)

    const [plant, setPlant] = useState(initialData.plant || '')
    const [lostLoadDate, setLostLoadDate] = useState(initialData.lost_load_date || '')
    const [yardage, setYardage] = useState(initialData.yardage != null ? String(initialData.yardage) : '')
    const [truckNumber, setTruckNumber] = useState(initialData.truck_number || '')
    const [customerName, setCustomerName] = useState(initialData.customer_name || '')
    const [ticketNumber, setTicketNumber] = useState(initialData.ticket_number || '')
    const [reason, setReason] = useState(initialReason.category)
    const [explanation, setExplanation] = useState(initialReason.explanation)
    const [dumpLocation, setDumpLocation] = useState(initialDump.category)
    const [dumpLocationOther, setDumpLocationOther] = useState(initialDump.other)
    const [operatorReprimanded, setOperatorReprimanded] = useState(!!initialData.operator_reprimanded)
    const [plantManagerReprimanded, setPlantManagerReprimanded] = useState(!!initialData.plant_manager_reprimanded)
    const [attachment, setAttachment] = useState(null)
    const [truckPickerOpen, setTruckPickerOpen] = useState(false)
    const [truckSearch, setTruckSearch] = useState('')

    const { operatorMap, regionalMixers, selectedOperatorId, selectedOperatorName } = useLostLoadFormData({
        isEditing,
        plants,
        setPlant,
        truckNumber,
        truckSearch,
        user
    })

    const { submit, submitting, error, setError, emailError } = useLostLoadSubmit({
        initialReport,
        isEditing,
        onClose,
        onSubmitted,
        user
    })

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.type !== ALLOWED_FILE_TYPE) {
            setError('Only PDF files are allowed.')
            return
        }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            setError(`File must be under ${MAX_FILE_SIZE_MB}MB.`)
            return
        }
        setError('')
        setAttachment(file)
    }

    const handleClearAttachment = () => {
        setAttachment(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleSubmit = () =>
        submit({
            attachment,
            customerName,
            dumpLocation,
            dumpLocationOther,
            explanation,
            lostLoadDate,
            operatorReprimanded,
            plant,
            plantManagerReprimanded,
            reason,
            selectedOperatorId,
            selectedOperatorName,
            ticketNumber,
            truckNumber,
            yardage
        })

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center sm:p-4 overflow-y-auto bg-[rgba(0,0,0,0.5)]"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="rounded-none sm:rounded-2xl shadow-2xl w-full sm:max-w-lg flex flex-col bg-bg-primary min-h-screen sm:min-h-0 sm:max-h-[90vh]">
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border-light sticky top-0 bg-bg-primary z-10">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex items-center justify-center w-9 h-9 rounded-lg"
                            style={{ backgroundColor: `${accentColor}15` }}
                        >
                            <i className="fas fa-exclamation-triangle text-sm" style={{ color: accentColor }} />
                        </div>
                        <h2 className="text-base font-semibold m-0 text-text-primary">
                            {isEditing ? 'Edit Lost Load Report' : 'Lost Load Report'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                        type="button"
                    >
                        <i className="fas fa-times text-sm" />
                    </button>
                </div>
                <div className="px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-4 overflow-y-auto">
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-text-primary">
                            <i className="fas fa-exclamation-circle shrink-0" />
                            {error}
                        </div>
                    )}
                    {emailError && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-text-primary">
                            <i className="fas fa-exclamation-triangle shrink-0 mt-0.5" />
                            <div>
                                <div className="font-semibold mb-0.5">Report submitted — email notification failed</div>
                                <div>{emailError}</div>
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            Plant
                        </label>
                        <div className="relative">
                            <select
                                value={plant}
                                onChange={(e) => {
                                    setPlant(e.target.value)
                                }}
                                aria-label="Plant"
                                className={`w-full appearance-none rounded-lg pl-3 pr-9 py-2.5 text-sm font-medium cursor-pointer transition-colors duration-150 bg-bg-secondary border border-border-light hover:border-border-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:border-[var(--accent)] ${plant ? 'text-text-primary' : 'text-text-secondary'}`}
                            >
                                <option value="">Select plant...</option>
                                {plants.map((p) => (
                                    <option key={p.plant_code} value={p.plant_code}>
                                        ({p.plant_code}) {p.plant_name}
                                    </option>
                                ))}
                            </select>
                            <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none text-text-tertiary" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            Date of Lost Load <span className="text-text-primary">*</span>
                        </label>
                        <input
                            type="date"
                            value={lostLoadDate}
                            onChange={(e) => setLostLoadDate(e.target.value)}
                            className={`${FIELD_INPUT_CLS} bg-bg-secondary`}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            Yardage
                        </label>
                        <input
                            type="number"
                            value={yardage}
                            onChange={(e) => setYardage(e.target.value)}
                            placeholder="Enter yardage..."
                            className={FIELD_INPUT_CLS}
                            min="0"
                        />
                    </div>
                    <TruckPicker
                        accentColor={accentColor}
                        truckNumber={truckNumber}
                        setTruckNumber={setTruckNumber}
                        truckPickerOpen={truckPickerOpen}
                        setTruckPickerOpen={setTruckPickerOpen}
                        truckSearch={truckSearch}
                        setTruckSearch={setTruckSearch}
                        regionalMixers={regionalMixers}
                        operatorMap={operatorMap}
                    />
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            Customer Name
                        </label>
                        <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Enter customer name..."
                            className={FIELD_INPUT_CLS}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            Ticket Number
                        </label>
                        <input
                            type="text"
                            value={ticketNumber}
                            onChange={(e) => setTicketNumber(e.target.value)}
                            placeholder="Enter ticket number..."
                            className={FIELD_INPUT_CLS}
                        />
                    </div>
                    <AttachmentField
                        attachment={attachment}
                        fileInputRef={fileInputRef}
                        onFileSelect={handleFileSelect}
                        onClear={handleClearAttachment}
                    />
                    <OptionRadioGroup
                        label="Dump Location"
                        required
                        options={DUMP_LOCATIONS}
                        value={dumpLocation}
                        onChange={(loc) => {
                            setDumpLocation(loc)
                            if (loc !== 'Other') setDumpLocationOther('')
                        }}
                        accentColor={accentColor}
                        columns={2}
                    >
                        {dumpLocation === 'Other' && (
                            <input
                                type="text"
                                value={dumpLocationOther}
                                onChange={(e) => setDumpLocationOther(e.target.value)}
                                placeholder="Specify where concrete was dumped..."
                                autoFocus
                                className={`${FIELD_INPUT_CLS} mt-1`}
                            />
                        )}
                    </OptionRadioGroup>
                    <OptionRadioGroup
                        label="Reason"
                        options={REASONS}
                        value={reason}
                        onChange={(r) => {
                            setReason(r)
                            setExplanation('')
                        }}
                        accentColor={accentColor}
                    >
                        {reason && (
                            <textarea
                                value={explanation}
                                onChange={(e) => setExplanation(e.target.value)}
                                placeholder="Explain what happened and what will be done to prevent this..."
                                rows={3}
                                autoFocus
                                className={`${FIELD_TEXTAREA_CLS} mt-1 resize-none`}
                            />
                        )}
                    </OptionRadioGroup>
                    <ReprimandToggles
                        accentColor={accentColor}
                        operatorReprimanded={operatorReprimanded}
                        setOperatorReprimanded={setOperatorReprimanded}
                        plantManagerReprimanded={plantManagerReprimanded}
                        setPlantManagerReprimanded={setPlantManagerReprimanded}
                    />
                </div>
                <div className="px-4 sm:px-6 py-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 sticky bottom-0 bg-bg-primary border-t border-border-light z-10 border-t border-border-light">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-lg text-sm font-medium bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-[background-color,opacity] duration-150 hover:brightness-110 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-primary"
                        style={{ background: accentColor, opacity: submitting ? 0.7 : 1 }}
                        type="button"
                    >
                        {submitting ? (
                            <>
                                <i className="fas fa-circle-notch fa-spin mr-2" />
                                {isEditing ? 'Saving...' : 'Submitting...'}
                            </>
                        ) : isEditing ? (
                            'Save Changes'
                        ) : (
                            'Submit Report'
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
export default LostLoadReportModal
