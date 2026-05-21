import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import PlanSettingsService from '../../services/PlanSettingsService'
import { hydratePlanScheduleSettings } from '../../utils/PlanScheduleUtility'
import { hydrateBookOrderSettings } from '../constants/bookOrderConstants'
import { hydratePlanSettings } from '../constants/planConstants'
import { PLAN_SETTINGS_DEFAULTS } from '../constants/planSettingsSchema'

/** Convert any value to either a finite number or `''`. Empty string maps
 *  to "use the field's default" — the same posture the DB takes when no
 *  row exists. */
const toNumericOrEmpty = (raw) => {
    if (raw === '' || raw == null) return ''
    const n = typeof raw === 'number' ? raw : parseFloat(raw)
    return Number.isFinite(n) ? n : ''
}

/** Build the initial form values from a `plan_settings` row or, when no
 *  row exists, from the baked-in defaults so the form always has
 *  something concrete to render. */
const buildFormValues = (row) =>
    Object.fromEntries(
        Object.entries(PLAN_SETTINGS_DEFAULTS).map(([column, defaultValue]) => [
            column,
            toNumericOrEmpty(row?.[column] ?? defaultValue)
        ])
    )

/** Diff form state against the last saved snapshot (or defaults) and
 *  return only the columns the user actually changed. Empty / NaN values
 *  are excluded so the save payload never wipes a column. */
const buildPatch = (form, savedSnapshot) => {
    const patch = {}
    for (const [column, value] of Object.entries(form)) {
        if (value === '' || !Number.isFinite(Number(value))) continue
        const previous = savedSnapshot?.[column] ?? PLAN_SETTINGS_DEFAULTS[column]
        if (Number(previous) !== Number(value)) patch[column] = Number(value)
    }
    return patch
}

/**
 * State + IO for the Plan → Settings operational form. Loads the active
 * region's row on mount, exposes the in-flight form state, and saves a
 * diff-only patch back through the edge function. After a successful
 * save the freshly returned row is fanned out to every constant module
 * so the new values take effect in the running session without a
 * reload.
 */
export function usePlanOperationalSettings(regionCode) {
    const [savedSnapshot, setSavedSnapshot] = useState(null)
    const [form, setForm] = useState(() => buildFormValues(null))
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [savedAt, setSavedAt] = useState(null)
    const mountedRef = useRef(true)

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
        }
    }, [])

    const reload = useCallback(async () => {
        if (!regionCode) return
        setLoading(true)
        setError(null)
        try {
            const row = await PlanSettingsService.fetchByRegion(regionCode)
            if (!mountedRef.current) return
            setSavedSnapshot(row)
            setForm(buildFormValues(row))
        } catch (err) {
            if (!mountedRef.current) return
            setError(err?.message || 'Failed to load settings')
        } finally {
            if (mountedRef.current) setLoading(false)
        }
    }, [regionCode])

    useEffect(() => {
        reload()
    }, [reload])

    const updateField = useCallback((column, value) => {
        setForm((prev) => ({ ...prev, [column]: value === '' ? '' : toNumericOrEmpty(value) }))
    }, [])

    const patch = useMemo(() => buildPatch(form, savedSnapshot), [form, savedSnapshot])
    const isDirty = Object.keys(patch).length > 0

    const discard = useCallback(() => {
        setForm(buildFormValues(savedSnapshot))
        setError(null)
    }, [savedSnapshot])

    const save = useCallback(async () => {
        if (!regionCode || !isDirty) return
        setSaving(true)
        setError(null)
        try {
            const updated = await PlanSettingsService.upsertByRegion(regionCode, patch)
            if (!mountedRef.current) return
            setSavedSnapshot(updated)
            setForm(buildFormValues(updated))
            // Push the freshly saved row through the live-binding hydrators
            // so the new values take effect in the running session — every
            // consumer reading these constants gets the updated values on
            // the next access.
            if (updated) {
                hydratePlanSettings(updated)
                hydratePlanScheduleSettings(updated)
                hydrateBookOrderSettings(updated)
                PlanSettingsService.hydrate(updated, regionCode)
            }
            setSavedAt(Date.now())
        } catch (err) {
            if (!mountedRef.current) return
            setError(err?.message || 'Failed to save settings')
        } finally {
            if (mountedRef.current) setSaving(false)
        }
    }, [regionCode, isDirty, patch])

    return {
        discard,
        error,
        form,
        isDirty,
        loading,
        reload,
        save,
        savedAt,
        savedSnapshot,
        saving,
        updateField
    }
}
