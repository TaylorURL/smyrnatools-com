import { useState } from 'react'

import APIUtility from '../../../utils/APIUtility'

const RECOVERY_ERROR_ID = 'recovery-error'

// The same field, label and alert treatment as LoginForm, whose card this
// one replaces in place: recovery is a step of signing in, not a new page.
const INPUT_CLS =
    'w-full rounded-md border border-white/15 bg-white/[0.06] text-white text-[13.5px] ' +
    'px-3 py-2.5 outline-none transition-[border-color,background-color,box-shadow] duration-150 ease-out motion-reduce:transition-none ' +
    'placeholder:text-white/40 hover:border-white/25 focus:border-white/50 focus:bg-white/[0.1] field-on-media'

const LABEL_CLS = 'mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.1em] text-white/60'

const ALERT_BASE_CLS =
    'mb-5 flex items-start gap-2 rounded-md border px-3 py-2 text-[12.5px] leading-snug animate-msg-in motion-reduce:animate-none'

/**
 * Password recovery form. Sends the user's email to the backend which
 * generates and emails a new password if the account exists. Uses a
 * deliberately vague success message to avoid leaking account existence.
 * Renders as a card in the sign-in panel's slot, matching LoginForm.
 */
function PasswordRecoveryView({ onBackToLogin }) {
    const [email, setEmail] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    async function handleSubmit(e) {
        e.preventDefault()
        if (submitting) return
        setMessage('')
        setError('')
        if (!email) {
            setError('Enter your email.')
            return
        }
        setSubmitting(true)
        try {
            const { res } = await APIUtility.post('/auth-service/reset-password', { email })
            if (res.ok) {
                setMessage('If an account exists for this email, a new password has been sent.')
            } else {
                setError('An error occurred. Please try again.')
            }
        } catch (err) {
            setError('An error occurred. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }
    return (
        <div className="w-full rounded-card border border-white/10 bg-slate-950/45 p-5 shadow-modal backdrop-blur-xl animate-fade-slide-in motion-reduce:animate-none sm:p-6">
            <div className="mb-5 flex flex-col gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-current text-sky-300 shadow-glow" aria-hidden="true" />
                    Smyrna Tools
                </span>
                <h2 className="m-0 font-heading text-[22px] font-bold leading-tight tracking-tight text-white">
                    Reset your password
                </h2>
                <p className="m-0 text-[12.5px] text-white/70">
                    Enter your work email and a new password will be sent to it.
                </p>
            </div>
            <form onSubmit={handleSubmit} noValidate>
                <div className="mb-4">
                    <label htmlFor="recovery-email" className={LABEL_CLS}>
                        Email Address
                    </label>
                    <input
                        id="recovery-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        autoFocus
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? RECOVERY_ERROR_ID : undefined}
                        className={`${INPUT_CLS} ${error ? 'border-rose-400/70 bg-rose-400/[0.08]' : ''}`}
                        required
                    />
                </div>
                {error && (
                    <div
                        role="alert"
                        id={RECOVERY_ERROR_ID}
                        className={`${ALERT_BASE_CLS} border-rose-400/40 bg-rose-400/10 text-white`}
                    >
                        <i className="fas fa-exclamation-circle mt-0.5 shrink-0 text-rose-300" aria-hidden="true" />
                        <span>{error}</span>
                    </div>
                )}
                {message && (
                    <div
                        role="status"
                        aria-live="polite"
                        className={`${ALERT_BASE_CLS} border-emerald-400/40 bg-emerald-400/10 text-white`}
                    >
                        <i className="fas fa-check-circle mt-0.5 shrink-0 text-emerald-300" aria-hidden="true" />
                        <span>{message}</span>
                    </div>
                )}
                <button
                    type="submit"
                    disabled={submitting}
                    className={`mt-1 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-white/20 bg-white px-4 py-2.5 text-[13px] font-bold tracking-tight text-slate-950 transition-[filter,transform,opacity,background-color] duration-150 ease-out hover:bg-white/95 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 motion-reduce:transition-none ${submitting ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                    {submitting ? (
                        <>
                            <i className="fas fa-circle-notch fa-spin" aria-hidden="true" />
                            Sending…
                        </>
                    ) : (
                        <>
                            <i className="fas fa-paper-plane text-[11px]" aria-hidden="true" />
                            Send New Password
                        </>
                    )}
                </button>
            </form>
            <div className="mt-5 flex items-center justify-center gap-1.5 border-t border-white/10 pt-4 text-[12px]">
                <span className="text-white/70">Remembered it?</span>
                <button
                    type="button"
                    onClick={onBackToLogin}
                    className="cursor-pointer border-none bg-transparent p-0 font-bold text-sky-300 transition-colors duration-150 ease-out hover:text-sky-200 hover:underline focus-visible:underline focus-visible:outline-none motion-reduce:transition-none"
                >
                    Back to Sign In
                </button>
            </div>
        </div>
    )
}
export default PasswordRecoveryView
