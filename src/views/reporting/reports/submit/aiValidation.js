/** Pre-submit AI validation gets a hard 15s budget. If the AI service
 *  hangs or rejects, we log the failure and let the user submit anyway —
 *  blocking submission on an external service that isn't responding is
 *  worse than letting a borderline comment through. */
export const AI_VALIDATION_TIMEOUT_MS = 15000
export const AI_VALIDATION_TIMEOUT = Symbol('ai-validation-timeout')

/** Races `promise` against `AI_VALIDATION_TIMEOUT_MS`. On timeout, logs a
 *  console error tagged with `label` and resolves `{ timedOut: true }`.
 *  Caller is responsible for falling through to submit on timeout. */
export async function raceAiValidation(promise, label) {
    let timer
    const result = await Promise.race([
        promise,
        new Promise((resolve) => {
            timer = setTimeout(() => resolve(AI_VALIDATION_TIMEOUT), AI_VALIDATION_TIMEOUT_MS)
        })
    ])
    clearTimeout(timer)
    if (result === AI_VALIDATION_TIMEOUT) {
        console.error(
            `[${label}] AI validation did not complete within ${AI_VALIDATION_TIMEOUT_MS / 1000}s — bypassing and proceeding with submit.`
        )
        return { timedOut: true, value: null }
    }
    return { timedOut: false, value: result }
}
