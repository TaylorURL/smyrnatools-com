/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'

import { getSessionUserId } from '../../../services/SessionService'
import { UserPreferencesService } from '../../../services/UserPreferencesService'
import { importChunk } from '../../../utils/ChunkRecovery'
import { useAccentColor } from '../../hooks/useAccentColor'

// This modal is mounted beside the whole app rather than behind the session it
// serves, so it is on the path a signed-out visitor pays for. The roles lookup
// is the only thing here that reaches the database, and the module that
// constructs its client is the heaviest dependency in the graph; importing the
// service from inside the branch that already has a session keeps the client
// out of a visit that will never ask it anything. The session id the branch
// turns on is read from SessionService, which depends on nothing — asking
// UserService for it would drag the client back in to answer a question about
// memory.
const loadUserService = () =>
    importChunk(() => import('../../../services/UserService')).then((module) => module.UserService)

const IOS_STEPS = [
    {
        icon: 'fa-share',
        text: (
            <>
                Tap the <strong>Share</strong> button at the bottom of Safari
            </>
        )
    },
    {
        icon: 'fa-plus-square',
        text: (
            <>
                Scroll down and tap <strong>Add to Home Screen</strong>
            </>
        )
    },
    {
        text: (
            <>
                Tap <strong>Add</strong> in the top right corner
            </>
        )
    }
]

const ANDROID_STEPS = [
    {
        icon: 'fa-ellipsis-v',
        text: (
            <>
                Tap the <strong>Menu</strong> button in Chrome
            </>
        )
    },
    {
        text: (
            <>
                Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>
            </>
        )
    },
    {
        text: (
            <>
                Tap <strong>Add</strong> or <strong>Install</strong> to confirm
            </>
        )
    }
]

const DESKTOP_IOS_STEPS = [
    'Open **Safari** on your iPhone or iPad',
    'Navigate to **smyrnatools.com**',
    'Tap the **Share Button**',
    'Select **Add to Home Screen**',
    'Tap **Add**'
]

const DESKTOP_ANDROID_STEPS = [
    'Open **Chrome** on your Android phone',
    'Navigate to **smyrnatools.com**',
    'Tap the **Menu**',
    'Select **Add to Home screen**',
    'Tap **Add**'
]

function StepNumber({ number, accentColor }) {
    return (
        <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
            style={{ backgroundColor: accentColor }}
        >
            {number}
        </span>
    )
}

function SmallStepNumber({ number, accentColor }) {
    return (
        <span
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{ backgroundColor: accentColor }}
        >
            {number}
        </span>
    )
}

/** Renders the `**bold**` spans in a step string as `<strong>`. Splitting on
 *  a capturing group puts the bracketed text at every odd index. */
function renderBold(text) {
    return text.split(/\*\*(.+?)\*\*/).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))
}

function ActionButtons({ onPrimary, primaryIcon, primaryLabel, onSecondary, onDismiss, accentColor }) {
    return (
        <div className="flex flex-col gap-3">
            <button
                type="button"
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border-none px-6 py-3.5 text-[15px] font-semibold text-white cursor-pointer active:scale-[0.98] transition-[transform,filter] duration-150 ease-out motion-reduce:transition-none hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
                style={{ backgroundColor: accentColor }}
                onClick={onPrimary}
            >
                <i className={`fas ${primaryIcon}`} aria-hidden="true" /> {primaryLabel}
            </button>
            <button
                type="button"
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border-light bg-bg-secondary px-6 py-3.5 text-[15px] font-medium text-text-primary cursor-pointer active:scale-[0.98] transition-[transform,background-color] duration-150 ease-out motion-reduce:transition-none hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
                onClick={onSecondary}
            >
                <i className="fas fa-clock" aria-hidden="true" /> Remind Me Later
            </button>
            <button
                type="button"
                className="mt-1 border-none bg-transparent p-2 text-[13px] text-text-tertiary cursor-pointer transition-colors duration-150 ease-out motion-reduce:transition-none hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary rounded"
                onClick={onDismiss}
            >
                Do Not Show This Again
            </button>
        </div>
    )
}

function MobileContent({ deviceType, accentColor, onInstalled, onRemindLater, onDismissForever }) {
    const steps = deviceType === 'ios' ? IOS_STEPS : deviceType === 'android' ? ANDROID_STEPS : []
    return (
        <div className="px-8 pb-8 pt-10 text-center">
            <div
                className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[20px] text-4xl"
                style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
            >
                <i className="fas fa-mobile-alt" aria-hidden="true" />
            </div>
            <h2 className="mb-3 font-heading text-2xl font-bold tracking-tight" style={{ color: accentColor }}>
                Install Smyrna Tools
            </h2>
            <p className="mb-7 text-[15px] leading-relaxed text-text-secondary">
                Add Smyrna Tools to your home screen for quick access and a better experience.
            </p>
            <div className="mb-7 text-left">
                {steps.map((step, index) => (
                    <div
                        key={index}
                        className={`flex items-start gap-3.5 py-3 ${index < steps.length - 1 ? 'border-b border-border-light' : ''}`}
                    >
                        <StepNumber number={index + 1} accentColor={accentColor} />
                        <span className="pt-1 text-sm leading-normal text-text-primary">
                            {step.text} {step.icon && <i className={`fas ${step.icon}`} aria-hidden="true" />}
                        </span>
                    </div>
                ))}
            </div>
            <ActionButtons
                accentColor={accentColor}
                onPrimary={onInstalled}
                primaryIcon="fa-check"
                primaryLabel="I Installed It"
                onSecondary={onRemindLater}
                onDismiss={onDismissForever}
            />
        </div>
    )
}

function DesktopTutorialSection({ icon, title, steps, accentColor }) {
    return (
        <div className="rounded-xl border border-border-light bg-bg-secondary p-5 text-left">
            <div className="mb-4 flex items-center gap-3">
                <i className={`${icon} text-2xl`} style={{ color: accentColor }} aria-hidden="true" />
                <h3 className="m-0 font-heading text-base font-semibold" style={{ color: accentColor }}>
                    {title}
                </h3>
            </div>
            {steps.map((step, index) => (
                <div key={index} className="flex items-center gap-2.5 py-2 text-[13px] text-text-primary">
                    <SmallStepNumber number={index + 1} accentColor={accentColor} />
                    <span>{renderBold(step)}</span>
                </div>
            ))}
        </div>
    )
}

function DesktopContent({ accentColor, onInstalled, onRemindLater, onDismissForever }) {
    return (
        <div className="px-8 pb-8 pt-10 text-center">
            <div
                className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[20px] text-4xl"
                style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
            >
                <i className="fas fa-mobile-screen-button" aria-hidden="true" />
            </div>
            <h2 className="mb-3 font-heading text-2xl font-bold tracking-tight" style={{ color: accentColor }}>
                Install on Your Phone
            </h2>
            <p className="mb-7 text-[15px] leading-relaxed text-text-secondary">
                Get the best experience by installing Smyrna Tools on your mobile device.
            </p>
            <div className="mb-7 flex flex-col gap-5">
                <DesktopTutorialSection
                    icon="fab fa-apple"
                    title="iPhone / iPad"
                    steps={DESKTOP_IOS_STEPS}
                    accentColor={accentColor}
                />
                <DesktopTutorialSection
                    icon="fab fa-android"
                    title="Android"
                    steps={DESKTOP_ANDROID_STEPS}
                    accentColor={accentColor}
                />
            </div>
            <ActionButtons
                accentColor={accentColor}
                onPrimary={onInstalled}
                primaryIcon="fa-check-circle"
                primaryLabel="Got It, Thanks!"
                onSecondary={onRemindLater}
                onDismiss={onDismissForever}
            />
        </div>
    )
}

/**
 * Prompt inviting the user to install the app on their phone. Renders
 * nothing at all unless a signed-in user holds a role other than guest, the
 * app is not already running standalone, and the server says this prompt is
 * still due for them. It then waits a couple of seconds so it does not land
 * mid-load.
 *
 * Device type picks the content, not just the copy: a phone gets the
 * step-by-step for its own browser, a desktop gets both platforms' steps to
 * follow on a phone.
 *
 * All three exits persist a decision server-side, and the backdrop and the
 * close button count as "remind me later" — there is no way to close this
 * without recording something.
 */
function AppInstallPromptModal() {
    const [showModal, setShowModal] = useState(false)
    const [deviceType, setDeviceType] = useState('desktop')
    const [promptType, setPromptType] = useState('mobile_install')
    const accentColor = useAccentColor()
    useEffect(() => {
        let timerId
        let checked = false
        const checkAndShowPrompt = async () => {
            if (checked) return
            const userId = getSessionUserId()
            if (!userId) return
            checked = true
            const userService = await loadUserService()
            const roles = await userService.getUserRoles(userId)
            const isGuestOnly = roles.length > 0 && roles.every((r) => r?.name?.toLowerCase() === 'guest')
            if (isGuestOnly || roles.length === 0) return
            const device = UserPreferencesService.detectDeviceType()
            setDeviceType(device)
            if (!UserPreferencesService.canShowInstallPrompt()) return
            const type = device === 'desktop' ? 'desktop_tutorial' : 'mobile_install'
            setPromptType(type)
            const shouldShow = await UserPreferencesService.shouldShowPrompt(userId, type)
            if (shouldShow) timerId = setTimeout(() => setShowModal(true), 2000)
        }
        checkAndShowPrompt()
        // This modal is mounted beside the whole app, so it is on screen from
        // the first commit — before AuthContext's whoami round trip has put a
        // session id in memory, and on a fresh document that trip is the only
        // thing that ever will. The check has to run again when the session
        // announces itself, or the prompt is silently skipped for the visit
        // that had a session all along. The guard keeps a sign-in later in the
        // same document from queueing a second prompt on top of the first.
        window.addEventListener('authSuccess', checkAndShowPrompt)
        return () => {
            window.removeEventListener('authSuccess', checkAndShowPrompt)
            clearTimeout(timerId)
        }
    }, [])
    const withCurrentUser = async (action) => {
        const userId = getSessionUserId()
        if (userId) await action(userId)
        setShowModal(false)
    }
    const handleDismissForever = () =>
        withCurrentUser((id) => UserPreferencesService.dismissForever(id, promptType, deviceType))
    const handleRemindLater = () =>
        withCurrentUser((id) => UserPreferencesService.remindLater(id, promptType, deviceType))
    const handleInstalled = () =>
        withCurrentUser((id) => UserPreferencesService.markAsInstalled(id, promptType, deviceType))
    if (!showModal) return null
    const ContentComponent = deviceType === 'desktop' ? DesktopContent : MobileContent
    if (typeof document === 'undefined' || !document.body) return null
    return ReactDOM.createPortal(
        <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-system flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm animate-fade-in motion-reduce:animate-none"
            onClick={handleRemindLater}
        >
            <div
                className="relative max-h-[90vh] w-full max-w-[480px] overflow-auto rounded-modal border border-border-light bg-bg-primary shadow-modal animate-pop-in motion-reduce:animate-none"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    aria-label="Close"
                    className="absolute right-4 top-4 z-base flex h-9 w-9 items-center justify-center rounded-full border-none bg-bg-secondary text-base text-text-secondary cursor-pointer hover:bg-bg-hover hover:text-text-primary active:scale-[0.94] transition-[background-color,color,transform] duration-150 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
                    onClick={handleRemindLater}
                >
                    <i className="fas fa-times" aria-hidden="true" />
                </button>
                <ContentComponent
                    deviceType={deviceType}
                    accentColor={accentColor}
                    onInstalled={handleInstalled}
                    onRemindLater={handleRemindLater}
                    onDismissForever={handleDismissForever}
                />
            </div>
        </div>,
        document.body
    )
}
export default AppInstallPromptModal
