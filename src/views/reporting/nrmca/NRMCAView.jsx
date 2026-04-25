import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import PlantDropdownModal from '../../../app/components/common/PlantDropdownModal'
import { ReportsActionBar } from '../../../app/components/reports/ReportsToolbar'
import TopSection from '../../../app/components/sections/TopSection'
import { usePreferences } from '../../../app/context/PreferencesContext'
import { NRMCAService } from '../../../services/NRMCAService'
import { PlantService } from '../../../services/PlantService'

// ─── Constants ────────────────────────────────────────────────────────────────

const RENEWAL_WARN_DAYS = 90
const CALIBRATION_WARN_DAYS = 30

const SCALE_TYPES = ['batch', 'aggregate', 'truck', 'water', 'admixture', 'cement', 'other']

const STATUS_BADGE = {
    valid: { label: 'Valid', bg: '#dcfce7', color: '#166534' },
    expiring: { label: 'Expiring', bg: '#fef3c7', color: '#92400e' },
    expired: { label: 'Expired', bg: '#fee2e2', color: '#b91c1c' },
    ok: { label: 'OK', bg: '#dcfce7', color: '#166534' },
    due_soon: { label: 'Due Soon', bg: '#fef3c7', color: '#92400e' },
    overdue: { label: 'Overdue', bg: '#fee2e2', color: '#b91c1c' },
    unknown: { label: 'Not Set', bg: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }
}

const SCALE_ICON_BY_STATUS = {
    ok: { bg: '#dcfce7', color: '#166534' },
    due_soon: { bg: '#fef3c7', color: '#92400e' },
    overdue: { bg: '#fee2e2', color: '#b91c1c' },
    unknown: { bg: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }
}

const STATUS_PILL_CLS =
    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-wider shrink-0'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (d) =>
    d
        ? new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : null

const daysFromNow = (d) => (d ? Math.ceil((new Date(d + 'T12:00:00') - Date.now()) / 86400000) : null)

function getRenewalStatus(expiresAt) {
    const days = daysFromNow(expiresAt)
    if (days === null) return 'unknown'
    if (days < 0) return 'expired'
    if (days <= RENEWAL_WARN_DAYS) return 'expiring'
    return 'valid'
}

function getCalibrationStatus(calibratedAt, intervalDays) {
    if (!calibratedAt) return 'unknown'
    const nextDueDate = new Date(new Date(calibratedAt + 'T12:00:00').getTime() + intervalDays * 86400000)
        .toISOString()
        .slice(0, 10)
    const days = daysFromNow(nextDueDate)
    if (days < 0) return 'overdue'
    if (days <= CALIBRATION_WARN_DAYS) return 'due_soon'
    return 'ok'
}

function getNextCalibrationDueDate(calibratedAt, intervalDays) {
    if (!calibratedAt) return null
    return new Date(new Date(calibratedAt + 'T12:00:00').getTime() + intervalDays * 86400000).toISOString().slice(0, 10)
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
    const cfg = STATUS_BADGE[status] ?? STATUS_BADGE.unknown
    return (
        <span className={STATUS_PILL_CLS} style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.label}
        </span>
    )
}

function Field({ label, children }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</label>
            {children}
        </div>
    )
}

const INPUT_CLS =
    'w-full rounded-lg border border-border-light bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400'
const SELECT_CLS =
    'w-full appearance-none rounded-lg border border-border-light bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 cursor-pointer'

function Modal({ title, onClose, onSubmit, submitting, children }) {
    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-border-light bg-white rounded-t-2xl z-10">
                    <h2 className="text-base font-bold text-slate-800">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <i className="fas fa-times" />
                    </button>
                </div>
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        onSubmit()
                    }}
                    className="px-6 py-5 flex flex-col gap-4"
                >
                    {children}
                </form>
                <div className="sticky bottom-0 flex justify-end gap-3 px-6 py-4 border-t border-border-light bg-white rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold rounded-lg border border-border-light bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={submitting}
                        className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {submitting ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function IconBtn({ icon, onClick, danger, title }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className="px-2 py-1 text-[10.5px] font-semibold rounded shrink-0 inline-flex items-center justify-center transition-colors"
            style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                color: danger ? '#dc2626' : 'var(--text-secondary)'
            }}
            aria-label={title || (danger ? 'Delete' : 'Edit')}
        >
            <i className={`fas ${icon} text-[10px]`} />
        </button>
    )
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function LogRenewalModal({ plant, onClose, onSaved }) {
    const today = new Date().toISOString().slice(0, 10)
    const threeYearsOut = new Date(Date.now() + 3 * 365 * 86400000).toISOString().slice(0, 10)
    const [renewedAt, setRenewedAt] = useState(today)
    const [expiresAt, setExpiresAt] = useState(threeYearsOut)
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)

    async function handleSave() {
        setSaving(true)
        try {
            await NRMCAService.logRenewal({
                nrmca_plant_id: plant.id,
                renewed_at: renewedAt,
                renewal_expires_at: expiresAt || null,
                notes: notes || null
            })
            onSaved()
        } catch (err) {
            alert(err?.message || 'Failed to log renewal')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal title={`Log Renewal — ${plant.plant_label}`} onClose={onClose} onSubmit={handleSave} submitting={saving}>
            <Field label="Renewal Date">
                <input
                    type="date"
                    className={INPUT_CLS}
                    value={renewedAt}
                    onChange={(e) => setRenewedAt(e.target.value)}
                    required
                />
            </Field>
            <Field label="Expiration Date">
                <input
                    type="date"
                    className={INPUT_CLS}
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                />
            </Field>
            <Field label="Notes (optional)">
                <textarea className={INPUT_CLS} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
        </Modal>
    )
}

function LogCalibrationModal({ scale, onClose, onSaved }) {
    const today = new Date().toISOString().slice(0, 10)
    const [calibratedAt, setCalibratedAt] = useState(today)
    const [calibratedBy, setCalibratedBy] = useState('')
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)

    async function handleSave() {
        setSaving(true)
        try {
            await NRMCAService.logCalibration({
                scale_id: scale.id,
                calibrated_at: calibratedAt,
                calibrated_by: calibratedBy || null,
                notes: notes || null
            })
            onSaved()
        } catch (err) {
            alert(err?.message || 'Failed to log calibration')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            title={`Log Calibration — ${scale.scale_name}`}
            onClose={onClose}
            onSubmit={handleSave}
            submitting={saving}
        >
            <Field label="Calibration Date">
                <input
                    type="date"
                    className={INPUT_CLS}
                    value={calibratedAt}
                    onChange={(e) => setCalibratedAt(e.target.value)}
                    required
                />
            </Field>
            <Field label="Calibrated By (optional)">
                <input
                    type="text"
                    className={INPUT_CLS}
                    placeholder="Company or technician name"
                    value={calibratedBy}
                    onChange={(e) => setCalibratedBy(e.target.value)}
                />
            </Field>
            <Field label="Notes (optional)">
                <textarea className={INPUT_CLS} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
        </Modal>
    )
}

function PlantFormModal({ plant, regionPlants, onClose, onSaved }) {
    const [plantCode, setPlantCode] = useState(plant?.plant_code ?? '')
    const [plantLabel, setPlantLabel] = useState(plant?.plant_label ?? '')
    const [notes, setNotes] = useState(plant?.notes ?? '')
    const [saving, setSaving] = useState(false)
    const [showPlantPicker, setShowPlantPicker] = useState(false)

    const selectedPlantName = useMemo(() => {
        if (!plantCode) return null
        const match = regionPlants.find((p) => (p.plantCode || p.plant_code) === plantCode)
        return match ? match.plantName || match.plant_name : null
    }, [plantCode, regionPlants])

    async function handleSave() {
        if (!plantCode || !plantLabel) return
        setSaving(true)
        try {
            await NRMCAService.upsertPlant({
                id: plant?.id,
                plant_code: plantCode,
                plant_label: plantLabel,
                notes: notes || null
            })
            onSaved()
        } catch (err) {
            alert(err?.message || 'Failed to save plant')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal title={plant ? 'Edit Plant' : 'Add Plant'} onClose={onClose} onSubmit={handleSave} submitting={saving}>
            <Field label="Plant">
                <button
                    type="button"
                    onClick={() => setShowPlantPicker(true)}
                    className={SELECT_CLS + ' text-left text-slate-900'}
                >
                    {plantCode ? (
                        `(${plantCode}) ${selectedPlantName ?? ''}`
                    ) : (
                        <span className="text-slate-400">Select plant…</span>
                    )}
                </button>
                <PlantDropdownModal
                    isOpen={showPlantPicker}
                    onClose={() => setShowPlantPicker(false)}
                    plants={regionPlants}
                    onSelect={(code) => setPlantCode(code)}
                />
            </Field>
            <Field label="Plant Label">
                <input
                    type="text"
                    className={INPUT_CLS}
                    placeholder="e.g. Main Batch Plant, Plant 1-A"
                    value={plantLabel}
                    onChange={(e) => setPlantLabel(e.target.value)}
                    required
                />
                <p className="text-[11px] text-slate-400">
                    Use labels to distinguish multiple batch plants at the same location.
                </p>
            </Field>
            <Field label="Notes (optional)">
                <textarea className={INPUT_CLS} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
        </Modal>
    )
}

function ScaleFormModal({ scale, nrmcaPlants, defaultPlantId, onClose, onSaved }) {
    const [nrmcaPlantId, setNrmcaPlantId] = useState(scale?.nrmca_plant_id ?? defaultPlantId ?? '')
    const [scaleName, setScaleName] = useState(scale?.scale_name ?? '')
    const [scaleType, setScaleType] = useState(scale?.scale_type ?? 'batch')
    const [intervalDays, setIntervalDays] = useState(String(scale?.calibration_interval_days ?? 365))
    const [notes, setNotes] = useState(scale?.notes ?? '')
    const [saving, setSaving] = useState(false)

    const selectedPlant = nrmcaPlants.find((p) => p.id === nrmcaPlantId)

    async function handleSave() {
        if (!nrmcaPlantId || !scaleName) return
        setSaving(true)
        try {
            await NRMCAService.upsertScale({
                id: scale?.id,
                nrmca_plant_id: nrmcaPlantId,
                plant_code: selectedPlant?.plant_code ?? null,
                scale_name: scaleName,
                scale_type: scaleType,
                calibration_interval_days: parseInt(intervalDays) || 365,
                notes: notes || null
            })
            onSaved()
        } catch (err) {
            alert(err?.message || 'Failed to save scale')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal title={scale ? 'Edit Scale' : 'Add Scale'} onClose={onClose} onSubmit={handleSave} submitting={saving}>
            <Field label="Plant">
                <select
                    className={SELECT_CLS}
                    value={nrmcaPlantId}
                    onChange={(e) => setNrmcaPlantId(e.target.value)}
                    required
                >
                    <option value="">Select plant…</option>
                    {nrmcaPlants.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.plant_code} — {p.plant_label}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label="Scale Name">
                <input
                    type="text"
                    className={INPUT_CLS}
                    placeholder="e.g. Batch Scale 1"
                    value={scaleName}
                    onChange={(e) => setScaleName(e.target.value)}
                    required
                />
            </Field>
            <Field label="Scale Type">
                <select className={SELECT_CLS} value={scaleType} onChange={(e) => setScaleType(e.target.value)}>
                    {SCALE_TYPES.map((t) => (
                        <option key={t} value={t}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label="Calibration Interval (days)">
                <input
                    type="number"
                    className={INPUT_CLS}
                    min="1"
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(e.target.value)}
                />
                <p className="text-[11px] text-slate-400">365 = annual · 180 = semi-annual</p>
            </Field>
            <Field label="Notes (optional)">
                <textarea className={INPUT_CLS} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
        </Modal>
    )
}

// ─── Scale Row ────────────────────────────────────────────────────────────────

function ScaleRow({ scale, allPlants, onReload, accentColor }) {
    const [calibModal, setCalibModal] = useState(false)
    const [editModal, setEditModal] = useState(false)

    const status = getCalibrationStatus(scale.calibrated_at, scale.calibration_interval_days)
    const nextDue = getNextCalibrationDueDate(scale.calibrated_at, scale.calibration_interval_days)
    const days = nextDue ? daysFromNow(nextDue) : null
    const iconCfg = SCALE_ICON_BY_STATUS[status] ?? SCALE_ICON_BY_STATUS.unknown

    function confirmDelete() {
        if (!window.confirm(`Delete scale "${scale.scale_name}"?`)) return
        NRMCAService.deleteScale(scale.id)
            .then(onReload)
            .catch((e) => alert(e?.message))
    }

    return (
        <>
            <div
                className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-bg-tertiary"
                style={{ borderBottom: '1px solid var(--border-light)' }}
            >
                <div className="w-4 shrink-0" />
                <div
                    className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                    style={{ background: iconCfg.bg, color: iconCfg.color }}
                >
                    <i className="fas fa-balance-scale text-[10px]" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[12px] truncate" style={{ color: 'var(--text-primary)' }}>
                        {scale.scale_name}
                        <span className="ml-1.5 capitalize font-normal" style={{ color: 'var(--text-tertiary)' }}>
                            · {scale.scale_type}
                        </span>
                    </div>
                    <div className="text-[10.5px] mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                        {scale.calibrated_at ? `Calibrated ${fmt(scale.calibrated_at)}` : 'Never calibrated'}
                        {scale.calibrated_by ? ` · ${scale.calibrated_by}` : ''}
                        {nextDue &&
                            ` · due ${fmt(nextDue)}${days !== null ? ` (${days < 0 ? `${Math.abs(days)}d late` : `${days}d`})` : ''}`}
                    </div>
                </div>
                <StatusBadge status={status} />
                <button
                    type="button"
                    onClick={() => setCalibModal(true)}
                    className="text-white text-[10.5px] font-semibold px-2 py-1 rounded shrink-0 hidden sm:inline-flex items-center gap-1 uppercase tracking-wider"
                    style={{ background: accentColor }}
                >
                    Log
                </button>
                <IconBtn icon="fa-pencil-alt" onClick={() => setEditModal(true)} title="Edit scale" />
                <IconBtn icon="fa-trash-alt" onClick={confirmDelete} danger title="Delete scale" />
            </div>

            {calibModal && (
                <LogCalibrationModal
                    scale={scale}
                    onClose={() => setCalibModal(false)}
                    onSaved={() => {
                        setCalibModal(false)
                        onReload()
                    }}
                />
            )}
            {editModal && (
                <ScaleFormModal
                    scale={scale}
                    nrmcaPlants={allPlants}
                    onClose={() => setEditModal(false)}
                    onSaved={() => {
                        setEditModal(false)
                        onReload()
                    }}
                />
            )}
        </>
    )
}

// ─── Plant Group ──────────────────────────────────────────────────────────────

/**
 * Plant header row + nested scale rows. Mirrors the dense list chrome used by
 * `MergedReviewList` (Reports' review tab): tight padding, 6×6 icons, 12px
 * titles, 10.5px secondary text, accent CTA with uppercase tracking.
 */
function PlantGroup({ plant, scales, allPlants, regionPlants, onReload, accentColor }) {
    const [renewModal, setRenewModal] = useState(false)
    const [editModal, setEditModal] = useState(false)
    const [addScaleModal, setAddScaleModal] = useState(false)

    const renewalStatus = getRenewalStatus(plant.renewal_expires_at)
    const plantScales = scales.filter((s) => s.nrmca_plant_id === plant.id)
    const expiryDays = daysFromNow(plant.renewal_expires_at)

    const contextLine = plant.renewal_expires_at
        ? renewalStatus === 'expired'
            ? `Expired ${fmt(plant.renewal_expires_at)}${expiryDays !== null ? ` · ${Math.abs(expiryDays)}d ago` : ''}`
            : `Expires ${fmt(plant.renewal_expires_at)}${expiryDays !== null && expiryDays >= 0 ? ` · ${expiryDays}d left` : ''}`
        : plant.renewed_at
          ? `Renewed ${fmt(plant.renewed_at)}`
          : 'No certification on file'

    function confirmDeletePlant() {
        if (!window.confirm(`Delete "${plant.plant_label}"? This will also remove all associated scales and history.`))
            return
        NRMCAService.deletePlant(plant.id)
            .then(onReload)
            .catch((e) => alert(e?.message))
    }

    return (
        <>
            {/* Plant header row */}
            <div
                className="flex items-center gap-2.5 px-3 py-2"
                style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)' }}
            >
                <div
                    className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                    style={{ background: `${accentColor}22`, color: accentColor }}
                >
                    <i className="fas fa-certificate text-[10px]" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[12px] truncate" style={{ color: 'var(--text-primary)' }}>
                        {plant.plant_label}
                        <span
                            className="ml-1.5 font-semibold uppercase tracking-wider"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            · {plant.plant_code}
                        </span>
                    </div>
                    <div className="text-[10.5px] mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                        NRMCA Certification · {contextLine}
                    </div>
                </div>
                <StatusBadge status={renewalStatus} />
                <button
                    type="button"
                    onClick={() => setRenewModal(true)}
                    className="text-white text-[10.5px] font-semibold px-2 py-1 rounded shrink-0 hidden sm:inline-flex items-center gap-1 uppercase tracking-wider"
                    style={{ background: accentColor }}
                >
                    Log Renewal
                </button>
                <IconBtn icon="fa-pencil-alt" onClick={() => setEditModal(true)} title="Edit plant" />
                <IconBtn icon="fa-trash-alt" onClick={confirmDeletePlant} danger title="Delete plant" />
            </div>

            {/* Scale rows */}
            {plantScales.map((scale) => (
                <ScaleRow
                    key={scale.id}
                    scale={scale}
                    allPlants={allPlants}
                    onReload={onReload}
                    accentColor={accentColor}
                />
            ))}

            {/* Add scale row */}
            <div
                className="flex items-center gap-2.5 px-3 py-1.5"
                style={{ borderBottom: '1px solid var(--border-light)' }}
            >
                <div className="w-4 shrink-0" />
                <div className="w-6 shrink-0" />
                <button
                    type="button"
                    onClick={() => setAddScaleModal(true)}
                    className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    <i className="fas fa-plus text-[9px]" />
                    Add scale
                </button>
            </div>

            {renewModal && (
                <LogRenewalModal
                    plant={plant}
                    onClose={() => setRenewModal(false)}
                    onSaved={() => {
                        setRenewModal(false)
                        onReload()
                    }}
                />
            )}
            {editModal && (
                <PlantFormModal
                    plant={plant}
                    regionPlants={regionPlants}
                    onClose={() => setEditModal(false)}
                    onSaved={() => {
                        setEditModal(false)
                        onReload()
                    }}
                />
            )}
            {addScaleModal && (
                <ScaleFormModal
                    defaultPlantId={plant.id}
                    nrmcaPlants={allPlants}
                    onClose={() => setAddScaleModal(false)}
                    onSaved={() => {
                        setAddScaleModal(false)
                        onReload()
                    }}
                />
            )}
        </>
    )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NRMCASkeleton() {
    return (
        <div
            className="rounded overflow-hidden"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
        >
            {[1, 2, 3].map((g) => (
                <React.Fragment key={g}>
                    <div
                        className="flex items-center gap-2.5 px-3 py-2"
                        style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)' }}
                    >
                        <div
                            className="w-6 h-6 rounded animate-pulse shrink-0"
                            style={{ background: 'var(--bg-tertiary)' }}
                        />
                        <div className="flex-1 min-w-0">
                            <div
                                className="h-3 w-40 rounded animate-pulse mb-1"
                                style={{ background: 'var(--bg-tertiary)' }}
                            />
                            <div
                                className="h-2.5 w-28 rounded animate-pulse"
                                style={{ background: 'var(--bg-tertiary)' }}
                            />
                        </div>
                        <div className="h-4 w-14 rounded animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />
                    </div>
                    {[1, 2].map((r) => (
                        <div
                            key={r}
                            className="flex items-center gap-2.5 px-3 py-2"
                            style={{ borderBottom: '1px solid var(--border-light)' }}
                        >
                            <div className="w-4 shrink-0" />
                            <div
                                className="w-6 h-6 rounded animate-pulse shrink-0"
                                style={{ background: 'var(--bg-tertiary)' }}
                            />
                            <div className="flex-1 min-w-0">
                                <div
                                    className="h-3 w-36 rounded animate-pulse mb-1"
                                    style={{ background: 'var(--bg-tertiary)' }}
                                />
                                <div
                                    className="h-2.5 w-48 rounded animate-pulse"
                                    style={{ background: 'var(--bg-tertiary)' }}
                                />
                            </div>
                            <div
                                className="h-4 w-12 rounded animate-pulse"
                                style={{ background: 'var(--bg-tertiary)' }}
                            />
                        </div>
                    ))}
                </React.Fragment>
            ))}
        </div>
    )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function NRMCAView() {
    const { preferences } = usePreferences()
    const accentColor = preferences.accentColor || '#1e3a5f'
    const headerRef = useRef(null)

    const [plants, setPlants] = useState([])
    const [scales, setScales] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [regionPlants, setRegionPlants] = useState([])
    const [addPlantModal, setAddPlantModal] = useState(false)
    const [tab, setTab] = useState('all')

    const regionCode = preferences.selectedRegion?.code

    const regionPlantCodes = useMemo(() => {
        if (!regionCode || !regionPlants.length) return null
        return new Set(
            regionPlants
                .map((p) =>
                    String(p.plantCode ?? p.plant_code ?? '')
                        .trim()
                        .toUpperCase()
                )
                .filter(Boolean)
        )
    }, [regionCode, regionPlants])

    const loadData = useCallback(
        async ({ background = false } = {}) => {
            if (background) setRefreshing(true)
            else setLoading(true)
            try {
                const [fetchedPlants, fetchedScales] = await Promise.all([
                    NRMCAService.fetchPlants(regionPlantCodes),
                    NRMCAService.fetchScales(regionPlantCodes)
                ])
                setPlants(fetchedPlants)
                setScales(fetchedScales)
            } catch {
                // stays empty; UI shows empty state
            } finally {
                if (background) setRefreshing(false)
                else setLoading(false)
            }
        },
        [regionPlantCodes]
    )

    useEffect(() => {
        if (regionCode) {
            PlantService.fetchRegionPlants(regionCode)
                .then(setRegionPlants)
                .catch(() => setRegionPlants([]))
        } else {
            setRegionPlants([])
        }
    }, [regionCode])

    useEffect(() => {
        loadData()
    }, [loadData])

    const expiredPlantCount = useMemo(
        () => plants.filter((p) => getRenewalStatus(p.renewal_expires_at) === 'expired').length,
        [plants]
    )
    const overdueScaleCount = useMemo(
        () =>
            scales.filter((s) => getCalibrationStatus(s.calibrated_at, s.calibration_interval_days) === 'overdue')
                .length,
        [scales]
    )
    const issueCount = expiredPlantCount + overdueScaleCount

    const badge = useMemo(() => {
        if (loading || !plants.length) return null
        const parts = [`${plants.length} Plants`, `${scales.length} Scales`]
        if (expiredPlantCount > 0) parts.push(`${expiredPlantCount} Expired`)
        if (overdueScaleCount > 0) parts.push(`${overdueScaleCount} Overdue`)
        return parts.join(' · ')
    }, [loading, plants.length, scales.length, expiredPlantCount, overdueScaleCount])

    const visiblePlants = useMemo(() => {
        if (tab !== 'issues') return plants
        return plants.filter((plant) => {
            if (getRenewalStatus(plant.renewal_expires_at) === 'expired') return true
            return scales.some(
                (s) =>
                    s.nrmca_plant_id === plant.id &&
                    getCalibrationStatus(s.calibrated_at, s.calibration_interval_days) === 'overdue'
            )
        })
    }, [plants, scales, tab])

    const visibleScales = useMemo(() => {
        if (tab !== 'issues') return scales
        return scales.filter((s) => getCalibrationStatus(s.calibrated_at, s.calibration_interval_days) === 'overdue')
    }, [scales, tab])

    const tabs = useMemo(
        () => [
            { key: 'all', label: 'All', icon: 'fa-list' },
            {
                key: 'issues',
                label: issueCount > 0 ? `Issues · ${issueCount}` : 'Issues',
                icon: 'fa-triangle-exclamation'
            }
        ],
        [issueCount]
    )

    return (
        <div className="bg-slate-50 min-h-screen w-full pb-16">
            <TopSection
                title="Calibrations & Certifications"
                forwardedRef={headerRef}
                sticky
                isLoading={loading}
                badge={badge}
                hidePlantFilter
                hideViewModeToggle
                hideSearchBar
            />
            <ReportsActionBar
                tabs={tabs}
                activeTab={tab}
                onTabChange={setTab}
                isRefreshing={refreshing}
                onRefresh={() => loadData({ background: true })}
                rightChildren={
                    <button
                        type="button"
                        onClick={() => setAddPlantModal(true)}
                        className="flex items-center gap-1.5 rounded text-[12px] font-semibold px-2.5 py-1.5 cursor-pointer text-white"
                        style={{ background: accentColor }}
                    >
                        <i className="fas fa-plus text-[10px]" />
                        <span className="hidden sm:inline">Add Plant</span>
                    </button>
                }
            />

            <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 flex flex-col gap-4">
                {loading ? (
                    <NRMCASkeleton />
                ) : plants.length === 0 ? (
                    <div
                        className="rounded overflow-hidden"
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                    >
                        <div
                            className="flex flex-col items-center justify-center py-10 px-4 text-center"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            <i className="fas fa-certificate text-2xl mb-2" />
                            <div className="text-[12px]">
                                No plants defined yet — add one to start tracking certifications and calibrations.
                            </div>
                        </div>
                    </div>
                ) : visiblePlants.length === 0 ? (
                    <div
                        className="rounded overflow-hidden"
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                    >
                        <div
                            className="flex flex-col items-center justify-center py-10 px-4 text-center"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            <i className="fas fa-circle-check text-2xl mb-2" />
                            <div className="text-[12px]">No expired certifications or overdue calibrations.</div>
                        </div>
                    </div>
                ) : (
                    <div
                        className="rounded overflow-hidden"
                        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
                    >
                        {visiblePlants.map((plant) => (
                            <PlantGroup
                                key={plant.id}
                                plant={plant}
                                scales={visibleScales}
                                allPlants={plants}
                                regionPlants={regionPlants}
                                onReload={loadData}
                                accentColor={accentColor}
                            />
                        ))}
                    </div>
                )}
            </div>

            {addPlantModal && (
                <PlantFormModal
                    regionPlants={regionPlants}
                    onClose={() => setAddPlantModal(false)}
                    onSaved={() => {
                        setAddPlantModal(false)
                        loadData()
                    }}
                />
            )}
        </div>
    )
}
