import { useEffect, useRef, useState } from 'react'

const DEBOUNCE_MS = 1200

/**
 * Debounced autosave for report drafts. Watches `form` and calls `onSave`
 * `DEBOUNCE_MS` after the last mutation so a stream of keystrokes
 * coalesces into one write. Tracks status so the header can show
 * "Saving…" / "Saved just now" / "Save failed" without each consumer
 * wiring its own state.
 *
 * Snapshot semantics:
 *   - First render captures a baseline snapshot WITHOUT saving — prevents
 *     a save-on-mount when the form is hydrated from an existing draft.
 *   - Every subsequent change that differs from the last saved snapshot
 *     restarts the debounce timer; pending timers are cancelled on
 *     unmount or when autosave is disabled.
 *   - A successful save advances the snapshot. A failed save does NOT,
 *     so the next change retries.
 *
 * @param {Object} args
 * @param {boolean} args.enabled - When false, autosave is paused (e.g.,
 *   read-only mode, or before initial form hydration).
 * @param {Object} args.form - The form state being watched.
 * @param {Function} args.onSave - Async `(form) => Promise<void>` that
 *   persists the draft and updates any external snapshot tracking.
 *
 * @returns {{
 *   status: 'idle' | 'saving' | 'saved' | 'failed',
 *   lastSavedAt: number | null,
 *   error: string | null
 * }}
 */
export function useAutosaveDraft({ enabled, form, onSave }) {
    const [status, setStatus] = useState('idle')
    const [lastSavedAt, setLastSavedAt] = useState(null)
    const [error, setError] = useState(null)
    const lastSavedSnapshotRef = useRef(null)
    const timerRef = useRef(null)
    const onSaveRef = useRef(onSave)
    const formRef = useRef(form)

    useEffect(() => {
        onSaveRef.current = onSave
    }, [onSave])

    useEffect(() => {
        formRef.current = form
    }, [form])

    useEffect(() => {
        if (!enabled) {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }
            return undefined
        }
        const snapshot = JSON.stringify(form)
        if (lastSavedSnapshotRef.current === null) {
            lastSavedSnapshotRef.current = snapshot
            return undefined
        }
        if (snapshot === lastSavedSnapshotRef.current) return undefined

        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(async () => {
            timerRef.current = null
            const snapshotAtFire = JSON.stringify(formRef.current)
            setStatus('saving')
            setError(null)
            try {
                await onSaveRef.current(formRef.current)
                lastSavedSnapshotRef.current = snapshotAtFire
                setLastSavedAt(Date.now())
                setStatus('saved')
            } catch (e) {
                console.warn('[useAutosaveDraft] save failed', e?.message || e)
                setError(e?.message || 'Save failed')
                setStatus('failed')
            }
        }, DEBOUNCE_MS)

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }
        }
    }, [enabled, form])

    return { error, lastSavedAt, status }
}
