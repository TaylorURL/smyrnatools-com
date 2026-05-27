/* eslint-disable react/forbid-dom-props */
import React, { lazy, memo, Suspense, useCallback, useEffect, useRef, useState } from 'react'

import VersionPopup from '../../../app/components/common/VersionPopup'
import { SESSION_STORAGE_KEYS } from '../../../app/constants/authConstants'
import { useAuth } from '../../../app/context/AuthContext'
import { useIsMobile } from '../../../app/hooks/useIsMobile'
import { useVersion } from '../../../app/hooks/useVersion'
import SrmLogo from '../../../assets/images/srm-logo.svg'
import { Database } from '../../../services/DatabaseService'
import ValidationUtility from '../../../utils/ValidationUtility'

const ChangelogView = lazy(() => import('./ChangelogView'))
const PasswordRecoveryView = lazy(() => import('./PasswordRecoveryView'))
const VideoBackground = lazy(() => import('../../../app/components/common/VideoBackground'))
/** Static gradient placeholder shown while the video background lazy-loads. */
const VideoFallback = memo(function VideoFallback() {
    return <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#0a1929] to-[#1e3a5f]" />
})
/** Animated fleet/plant/operator stat counters shown on the login hero panel. */
const StatsDisplay = memo(function StatsDisplay({ stats }) {
    return (
        <div className="flex justify-center gap-10 border-t border-white/15 pt-8 w-full">
            <div className="text-center">
                <div className="text-white text-3xl font-bold">{stats.assets > 0 ? stats.assets : '-'}</div>
                <div className="text-white/50 text-xs mt-1">Fleet Assets</div>
            </div>
            <div className="text-center">
                <div className="text-white text-3xl font-bold">{stats.plants > 0 ? stats.plants : '-'}</div>
                <div className="text-white/50 text-xs mt-1">Plants</div>
            </div>
            <div className="text-center">
                <div className="text-white text-3xl font-bold">{stats.operators > 0 ? stats.operators : '-'}</div>
                <div className="text-white/50 text-xs mt-1">Operators</div>
            </div>
        </div>
    )
})
/** Horizontal bar that fills to 33/66/100% based on Weak/Medium/Strong password strength. */
const PasswordStrengthBar = memo(function PasswordStrengthBar({ strength }) {
    if (!strength.value) return null
    const widthMap = { Medium: '66%', Strong: '100%', Weak: '33%' }
    return (
        <div className="mb-6">
            <div className="flex items-center gap-2">
                <div className="flex-1 h-[3px] rounded-sm bg-slate-200">
                    <div
                        className="h-full rounded-sm transition-[width] duration-300"
                        style={{
                            background: strength.color,
                            width: widthMap[strength.value] || '0%'
                        }}
                    />
                </div>
                <span className="text-[0.7rem] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {strength.value}
                </span>
            </div>
        </div>
    )
})
/** Constant-time string comparison to prevent timing attacks on password matching. */
const constantTimeEqual = (a, b) => {
    if (a.length !== b.length) return false
    let mismatch = 0
    for (let i = 0; i < a.length; i++) {
        mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    return mismatch === 0
}
/** Returns Tailwind classes for floating-label inputs. */
const getInputClasses = (isFocused) =>
    `w-full bg-white border-0 rounded-none text-slate-800 text-base outline-none pt-4 pb-3 border-b-2 transition-colors duration-150 ease-out motion-reduce:transition-none placeholder-transparent autofill:shadow-[inset_0_0_0px_1000px_white] autofill:[-webkit-text-fill-color:theme(colors.slate.800)] ${isFocused ? 'border-[#1e3a5f]' : 'border-slate-200 hover:border-slate-300'}`
/** Returns Tailwind classes for floating labels above inputs. */
const getLabelClasses = (isFocused, hasValue) =>
    `absolute left-0 pointer-events-none font-medium transition-[top,font-size,color] duration-150 ease-out motion-reduce:transition-none ${isFocused || hasValue ? 'top-0 text-[0.7rem]' : 'top-4 text-[0.9rem]'} ${isFocused ? 'text-[#1e3a5f]' : 'text-slate-400'}`
/**
 * Full-screen login/signup view with a lazy-loaded video background,
 * animated fleet stats, password strength indicator, and links to
 * password recovery and the changelog. Creates a browser session
 * record in the database on successful authentication.
 */
function LoginView() {
    const version = useVersion()
    const isMobile = useIsMobile()
    const [isSignUp, setIsSignUp] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const [successMessage, setSuccessMessage] = useState('')
    const [passwordStrength, setPasswordStrength] = useState({ color: '', value: '' })
    const { signIn, signUp, loading, error } = useAuth()
    const timeoutRef = useRef(null)
    const [showRecovery, setShowRecovery] = useState(false)
    const [showChangelog, setShowChangelog] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [focusedField, setFocusedField] = useState(null)
    const [animatedStats, setAnimatedStats] = useState({ assets: 0, operators: 0, plants: 0 })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [videoLoaded, setVideoLoaded] = useState(false)
    // One-shot notice when the user lands here because their session expired
    // mid-use (not because they clicked Sign Out). Flag is set by useAuthSession
    // on SESSION_INVALID_EVENT and cleared the moment LoginView mounts.
    const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false)
    const strengthCheckRef = useRef(null)
    useEffect(() => {
        const timer = setTimeout(() => setVideoLoaded(true), 100)
        return () => clearTimeout(timer)
    }, [])
    useEffect(() => {
        try {
            if (sessionStorage.getItem(SESSION_STORAGE_KEYS.SESSION_EXPIRED_BANNER) === '1') {
                setSessionExpiredNotice(true)
                sessionStorage.removeItem(SESSION_STORAGE_KEYS.SESSION_EXPIRED_BANNER)
            }
        } catch {}
    }, [])
    // Fetch aggregate fleet counts after a 1s delay (so the UI paints first),
    // then animate them with a cubic ease-out over 1.5s.
    useEffect(() => {
        let cancelled = false
        const fetchStats = async () => {
            if (cancelled) return
            try {
                const [mixersRes, tractorsRes, trailersRes, equipmentRes, operatorsRes, plantsRes] = await Promise.all([
                    Database.from('mixers').select('*', { count: 'exact', head: true }).neq('status', 'Retired'),
                    Database.from('tractors').select('*', { count: 'exact', head: true }).neq('status', 'Retired'),
                    Database.from('trailers').select('*', { count: 'exact', head: true }).neq('status', 'Retired'),
                    Database.from('heavy_equipment')
                        .select('*', { count: 'exact', head: true })
                        .neq('status', 'Retired'),
                    Database.from('operators')
                        .select('*', { count: 'exact', head: true })
                        .in('status', ['Active', 'Training', 'Light Duty']),
                    Database.from('plants').select('*', { count: 'exact', head: true })
                ])
                if (cancelled) return
                const totalAssets =
                    (mixersRes.count || 0) +
                    (tractorsRes.count || 0) +
                    (trailersRes.count || 0) +
                    (equipmentRes.count || 0)
                const targetStats = {
                    assets: totalAssets,
                    operators: operatorsRes.count || 0,
                    plants: plantsRes.count || 0
                }
                const duration = 1500
                const startTime = performance.now()
                const animate = (currentTime) => {
                    if (cancelled) return
                    const elapsed = currentTime - startTime
                    const progress = Math.min(elapsed / duration, 1)
                    const eased = 1 - Math.pow(1 - progress, 3)
                    setAnimatedStats({
                        assets: Math.round(targetStats.assets * eased),
                        operators: Math.round(targetStats.operators * eased),
                        plants: Math.round(targetStats.plants * eased)
                    })
                    if (progress < 1) requestAnimationFrame(animate)
                }
                requestAnimationFrame(animate)
            } catch {
                if (!cancelled) setAnimatedStats({ assets: 0, operators: 0, plants: 0 })
            }
        }
        fetchStats()
        return () => {
            cancelled = true
        }
    }, [])
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            if (strengthCheckRef.current) clearTimeout(strengthCheckRef.current)
        }
    }, [])
    useEffect(() => {
        if (strengthCheckRef.current) clearTimeout(strengthCheckRef.current)
        if (password && isSignUp) {
            strengthCheckRef.current = setTimeout(async () => {
                const strengthValue = await ValidationUtility.passwordStrength(password)
                const colorMap = { medium: '#f59e0b', strong: '#22c55e', weak: '#ef4444' }
                setPasswordStrength({
                    color: colorMap[strengthValue] || '',
                    value: strengthValue ? strengthValue.charAt(0).toUpperCase() + strengthValue.slice(1) : ''
                })
            }, 300)
        } else {
            setPasswordStrength({ color: '', value: '' })
        }
    }, [password, isSignUp])
    useEffect(() => {
        if (error) {
            setErrorMessage(error)
            setSuccessMessage('')
        }
    }, [error])
    /** Handles sign-in or sign-up with a 10s safety timeout to prevent infinite loading state. */
    const handleSubmit = useCallback(
        async (e) => {
            e.preventDefault()
            if (isSubmitting || loading) return
            setErrorMessage('')
            setSuccessMessage('')
            setIsSubmitting(true)
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            timeoutRef.current = setTimeout(() => {
                setIsSubmitting(false)
                setErrorMessage('The operation timed out. Please try again.')
            }, 10000)
            try {
                if (isSignUp) {
                    if (!email || !password || !confirmPassword || !firstName || !lastName) {
                        setErrorMessage('Please complete all fields.')
                        if (timeoutRef.current) clearTimeout(timeoutRef.current)
                        setIsSubmitting(false)
                        return
                    }
                    if (!constantTimeEqual(password, confirmPassword)) {
                        setErrorMessage('Passwords do not match.')
                        if (timeoutRef.current) clearTimeout(timeoutRef.current)
                        setIsSubmitting(false)
                        return
                    }
                    const normFirst = await ValidationUtility.normalizeName(firstName)
                    const normLast = await ValidationUtility.normalizeName(lastName)
                    await signUp(email, password, normFirst, normLast)
                    if (timeoutRef.current) clearTimeout(timeoutRef.current)
                    setSuccessMessage('Account created successfully.')
                } else {
                    if (!email || !password) {
                        setErrorMessage('Please enter your email and password.')
                        if (timeoutRef.current) clearTimeout(timeoutRef.current)
                        setIsSubmitting(false)
                        return
                    }
                    const result = await signIn(email, password)
                    if (!result?.id) throw new Error('Sign in failed - no user data returned')
                    if (timeoutRef.current) clearTimeout(timeoutRef.current)
                    setSuccessMessage('Signed in successfully.')
                }
            } catch (err) {
                if (timeoutRef.current) clearTimeout(timeoutRef.current)
                setErrorMessage(err?.message || 'An authentication error occurred. Please try again.')
                setIsSubmitting(false)
            }
        },
        [isSubmitting, loading, isSignUp, email, password, confirmPassword, firstName, lastName, signIn, signUp]
    )
    const toggleSignUp = useCallback(() => setIsSignUp((prev) => !prev), [])
    const togglePassword = useCallback(() => setShowPassword((prev) => !prev), [])
    const openRecovery = useCallback(() => setShowRecovery(true), [])
    const closeRecovery = useCallback(() => setShowRecovery(false), [])
    const openChangelog = useCallback(() => setShowChangelog(true), [])
    const closeChangelog = useCallback(() => setShowChangelog(false), [])
    if (showChangelog) {
        return (
            <Suspense
                fallback={
                    <div className="flex items-center justify-center h-screen bg-white">
                        <i className="fas fa-spinner fa-spin text-text-primary text-2xl" />
                    </div>
                }
            >
                <ChangelogView onBack={closeChangelog} />
            </Suspense>
        )
    }
    if (showRecovery) {
        return (
            <Suspense
                fallback={
                    <div className="flex items-center justify-center h-screen bg-white">
                        <i className="fas fa-spinner fa-spin text-text-primary text-2xl" />
                    </div>
                }
            >
                <PasswordRecoveryView onBackToLogin={closeRecovery} />
            </Suspense>
        )
    }
    return (
        <div className="flex min-h-screen overflow-hidden">
            {videoLoaded ? (
                <Suspense fallback={<VideoFallback />}>
                    <VideoBackground />
                </Suspense>
            ) : (
                <VideoFallback />
            )}
            <VersionPopup version={version} onClick={openChangelog} />
            <div className="flex items-stretch h-screen relative w-full z-10">
                {/* Hero panel — hidden on mobile, shown on lg+ */}
                <div className="hidden lg:flex flex-1 items-center justify-center relative p-12">
                    <div className="relative z-[2] flex flex-col items-center text-center max-w-lg animate-fade-slide-in motion-reduce:animate-none">
                        <img src={SrmLogo} alt="SRM" className="h-32 w-32 mb-8 drop-shadow-2xl" loading="eager" />
                        <h1 className="text-white font-heading text-5xl font-extrabold tracking-tight leading-tight mb-3">
                            Smyrna <span className="text-white/70">Tools</span>
                        </h1>
                        <p className="text-white/60 text-lg leading-relaxed mb-10 max-w-sm">
                            Fleet management and operations platform.
                        </p>
                        <StatsDisplay stats={animatedStats} />
                    </div>
                </div>
                {/* Login form panel */}
                <div className="flex items-center justify-center w-full p-3 min-[481px]:p-6 lg:w-[480px] lg:min-w-[480px] lg:p-12 bg-white [background-image:linear-gradient(rgba(30,58,95,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(30,58,95,0.03)_1px,transparent_1px)] bg-[length:20px_20px]">
                    <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] max-w-[380px] w-full p-10">
                        {!isMobile && (
                            <div className="lg:hidden mb-8 text-center">
                                <img src={SrmLogo} alt="SRM" className="h-12 mb-2 inline" loading="eager" />
                                <div className="text-text-primary text-xl font-bold">Smyrna Tools</div>
                            </div>
                        )}
                        <div className="mb-10">
                            <h2 className="text-slate-800 font-heading text-2xl font-bold tracking-tight mb-2">
                                {isSignUp ? 'Create account' : 'Welcome back'}
                            </h2>
                            <p className="text-slate-500 text-[0.9rem] m-0">
                                {isSignUp ? 'Join the team' : 'Enter your credentials to continue'}
                            </p>
                        </div>
                        <form onSubmit={handleSubmit} noValidate>
                            {isSignUp && (
                                <div className="flex gap-6 mb-6">
                                    <div className="flex-1 relative">
                                        <label className={getLabelClasses(focusedField === 'firstName', firstName)}>
                                            First name
                                        </label>
                                        <input
                                            type="text"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            onFocus={() => setFocusedField('firstName')}
                                            onBlur={() => setFocusedField(null)}
                                            className={getInputClasses(focusedField === 'firstName')}
                                            required
                                        />
                                    </div>
                                    <div className="flex-1 relative">
                                        <label className={getLabelClasses(focusedField === 'lastName', lastName)}>
                                            Last name
                                        </label>
                                        <input
                                            type="text"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            onFocus={() => setFocusedField('lastName')}
                                            onBlur={() => setFocusedField(null)}
                                            className={getInputClasses(focusedField === 'lastName')}
                                            required
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="mb-6 relative">
                                <label className={getLabelClasses(focusedField === 'email', email)}>
                                    Email address
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onFocus={() => setFocusedField('email')}
                                    onBlur={() => setFocusedField(null)}
                                    autoComplete="username"
                                    className={getInputClasses(focusedField === 'email')}
                                    required
                                />
                            </div>
                            <div className="mb-6">
                                <div className="relative">
                                    <label className={getLabelClasses(focusedField === 'password', password)}>
                                        Password
                                    </label>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onFocus={() => setFocusedField('password')}
                                        onBlur={() => setFocusedField(null)}
                                        autoComplete={isSignUp ? 'new-password' : 'current-password'}
                                        className={`${getInputClasses(focusedField === 'password')} pr-10`}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={togglePassword}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        aria-pressed={showPassword}
                                        className="absolute right-0 bottom-3 bg-transparent border-none text-slate-400 cursor-pointer text-sm p-1 transition-colors duration-150 ease-out motion-reduce:transition-none hover:text-slate-700 focus-visible:outline-none focus-visible:text-[#1e3a5f] focus-visible:ring-2 focus-visible:ring-[#1e3a5f]/40 rounded"
                                    >
                                        <i
                                            className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}
                                            aria-hidden="true"
                                        />
                                    </button>
                                </div>
                            </div>
                            {isSignUp && password && <PasswordStrengthBar strength={passwordStrength} />}
                            {isSignUp && (
                                <div className="mb-6">
                                    <div className="relative">
                                        <label
                                            className={getLabelClasses(
                                                focusedField === 'confirmPassword',
                                                confirmPassword
                                            )}
                                        >
                                            Confirm password
                                        </label>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            onFocus={() => setFocusedField('confirmPassword')}
                                            onBlur={() => setFocusedField(null)}
                                            autoComplete="new-password"
                                            className={getInputClasses(focusedField === 'confirmPassword')}
                                            required
                                        />
                                        {confirmPassword && password === confirmPassword && (
                                            <i className="fas fa-check absolute right-0 bottom-3 text-text-primary" />
                                        )}
                                    </div>
                                </div>
                            )}
                            {!isSignUp && (
                                <div className="mb-6 text-right">
                                    <button
                                        type="button"
                                        onClick={openRecovery}
                                        className="bg-transparent border-none text-[#1e3a5f] cursor-pointer text-[0.8rem] font-medium p-0 transition-colors duration-150 ease-out motion-reduce:transition-none hover:underline focus-visible:outline-none focus-visible:underline focus-visible:ring-2 focus-visible:ring-[#1e3a5f]/40 rounded"
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                            )}
                            {sessionExpiredNotice && !errorMessage && !successMessage && (
                                <div
                                    role="status"
                                    aria-live="polite"
                                    className="flex items-start gap-2 rounded-lg text-[0.85rem] mb-6 py-3 px-4 animate-msg-in motion-reduce:animate-none bg-amber-50 border border-amber-200 text-amber-900"
                                >
                                    <i
                                        className="fas fa-info-circle shrink-0 mt-0.5 text-[0.9rem]"
                                        aria-hidden="true"
                                    />
                                    <span>Your session expired. Please sign in again.</span>
                                </div>
                            )}
                            {errorMessage && (
                                <div
                                    role="alert"
                                    className="flex items-start gap-2 rounded-lg text-[0.85rem] mb-6 py-3 px-4 animate-msg-in motion-reduce:animate-none bg-red-50 border border-red-200 text-red-800"
                                >
                                    <i
                                        className="fas fa-exclamation-circle shrink-0 mt-0.5 text-[0.9rem]"
                                        aria-hidden="true"
                                    />
                                    <span>{errorMessage}</span>
                                </div>
                            )}
                            {successMessage && (
                                <div
                                    role="status"
                                    aria-live="polite"
                                    className="flex items-start gap-2 rounded-lg text-[0.85rem] mb-6 py-3 px-4 animate-msg-in motion-reduce:animate-none bg-green-50 border border-green-200 text-green-800"
                                >
                                    <i
                                        className="fas fa-check-circle shrink-0 mt-0.5 text-[0.9rem]"
                                        aria-hidden="true"
                                    />
                                    <span>{successMessage}</span>
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={isSubmitting || loading}
                                className={`w-full bg-[#1e3a5f] text-white rounded-md text-[0.9rem] font-semibold py-3.5 px-6 border-none transition-[filter,transform,opacity] duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f]/50 focus-visible:ring-offset-2 ${isSubmitting || loading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:brightness-110 active:scale-[0.98]'}`}
                            >
                                {isSubmitting || loading ? (
                                    <span className="inline-flex items-center gap-2">
                                        <i className="fas fa-circle-notch fa-spin" aria-hidden="true" />
                                        Processing...
                                    </span>
                                ) : isSignUp ? (
                                    'Create account'
                                ) : (
                                    'Sign in'
                                )}
                            </button>
                        </form>
                        <div className="mt-8 text-center">
                            <span className="text-slate-500 text-[0.85rem]">
                                {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                            </span>{' '}
                            <button
                                type="button"
                                onClick={toggleSignUp}
                                className="bg-transparent border-none text-[#1e3a5f] cursor-pointer text-[0.85rem] font-semibold p-0 transition-colors duration-150 ease-out motion-reduce:transition-none hover:underline focus-visible:outline-none focus-visible:underline focus-visible:ring-2 focus-visible:ring-[#1e3a5f]/40 rounded"
                            >
                                {isSignUp ? 'Sign in' : 'Sign up'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
export default LoginView
