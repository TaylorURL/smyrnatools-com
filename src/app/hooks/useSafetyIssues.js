import { useEffect } from 'react'

import { ReportUtility } from '../../utils/ReportUtility'

/** Factory for a brand-new issue row — used both for the seed entry and
 *  for the "Add Issue" button. */
function buildNewIssue(description = '') {
    return {
        affectsEfficiency: false,
        date: ReportUtility.getTodayISODate(),
        description,
        id: Date.now(),
        plant: '',
        tag: '',
        tags: []
    }
}

/** Coerces a string-form `issues` value into the array shape used by
 *  the modern UI and seeds an empty starter row when nothing is set. */
function useLegacyIssueMigration(form, setForm) {
    useEffect(() => {
        if (typeof form.issues === 'string') {
            setForm((f) => ({
                ...f,
                issues: f.issues ? [buildNewIssue(f.issues)] : [buildNewIssue()]
            }))
        } else if (!form.issues || (Array.isArray(form.issues) && form.issues.length === 0)) {
            setForm((f) => ({ ...f, issues: [buildNewIssue()] }))
        }
    }, [form.issues, setForm])
}

/** Backfills missing fields (`tags`, `date`, `affectsEfficiency`) on
 *  issues created under older shapes — preserves the existing `tag`
 *  scalar by promoting it into the new `tags` array. */
function useIssueFieldBackfill(form, setForm) {
    useEffect(() => {
        if (!Array.isArray(form.issues)) return
        let needsUpdate = false
        const migrated = form.issues.map((i) => {
            const next = { ...i }
            if (!Array.isArray(next.tags)) {
                next.tags = next.tag ? [next.tag] : []
                needsUpdate = true
            }
            if (next.date === undefined) {
                next.date = ''
                needsUpdate = true
            }
            if (next.affectsEfficiency === undefined) {
                next.affectsEfficiency = false
                needsUpdate = true
            }
            return next
        })
        if (needsUpdate) setForm((f) => ({ ...f, issues: migrated }))
    }, [form.issues, setForm])
}

/** Mutation API for the safety issue list — add, remove, update, tag
 *  helpers. All operations are pure with respect to `form.issues`. */
function buildIssueMutations(issues, setForm) {
    const updateIssue = (id, patch) => {
        setForm((f) => ({
            ...f,
            issues: issues.map((i) => {
                if (i.id !== id) return i
                const next = { ...i, ...patch }
                if (patch.plant !== undefined && (!patch.plant || patch.plant === 'All')) {
                    next.affectsEfficiency = false
                }
                return next
            })
        }))
    }
    return {
        addIssue: () => setForm((f) => ({ ...f, issues: [...(f.issues || []), buildNewIssue()] })),
        removeIssue: (id) => setForm((f) => ({ ...f, issues: issues.filter((i) => i.id !== id) })),
        removeIssueTag: (id, tagToRemove) => {
            const issue = issues.find((i) => i.id === id)
            if (!issue) return
            const next = (issue.tags || []).filter((t) => t !== tagToRemove)
            updateIssue(id, { tag: next[0] || '', tags: next })
        },
        updateIssue,
        updateIssueTagsArray: (id, nextArray) => updateIssue(id, { tag: nextArray[0] || '', tags: nextArray })
    }
}

/** Top-level hook for the SafetyManagerSubmitPlugin — runs the two
 *  migration effects and returns the current issue list + mutation
 *  helpers. */
export function useSafetyIssues(form, setForm) {
    useLegacyIssueMigration(form, setForm)
    useIssueFieldBackfill(form, setForm)
    const issues = Array.isArray(form.issues) ? form.issues : []
    return { issues, ...buildIssueMutations(issues, setForm) }
}
