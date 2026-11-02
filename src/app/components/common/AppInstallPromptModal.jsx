import React, { useCallback, useEffect, useRef, useState } from 'react'

import { getSessionUserId } from '../../../services/SessionService'
import { UserPreferencesService } from '../../../services/UserPreferencesService'
import { importChunk } from '../../../utils/ChunkRecovery'
import Dialog from '../ui/Dialog'

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

/** Renders the `**bold**` spans in a step string as `<strong>`. Splitting on
 *  a capturing group puts the bracketed text at every odd index. */
function renderBold(text) {
    return text.split(/\*\*(.+?)\*\*/).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))
}

/** One numbered list of steps, ruled like every other list in a dialog. */
function StepList({ label, steps }) {
    return (
        <ol aria-label={label} className="m-0 list-none p-0">
            {steps.map((step, index) => (
                <li
                    key={index}
                    className="flex items-baseline gap-3 border-b border-border-light px-6 py-2.5 text-[13px] leading-normal text-text-primary last:border-b-0"
                >
                    <span className="w-4 shrink-0 text-right tabular-nums text-text-tertiary">{index + 1}</span>
                    <span className="min-w-0 flex-1">{step}</span>
                </li>
            ))}
        </ol>
    )
}

function MobileContent({ deviceType }) {
    const steps = deviceType === 'ios' ? IOS_STEPS : deviceType === 'android' ? ANDROID_STEPS : []
    return (
        <StepList
            label="Steps"
            steps={steps.map((step, index) => (
                <React.Fragment key={index}>
                    {step.text}
                    {step.icon && (
                        <i className={`fas ${step.icon} ml-1.5 text-[12px] text-text-secondary`} aria-hidden="true" />
                    )}
                </React.Fragment>
            ))}
        />
    )
}

function DesktopTutorialSection({ title, steps }) {
    return (
        <section className="min-w-0 border-b border-border-light last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
            <h3 className="m-0 px-6 pb-1 pt-4 text-[13px] font-semibold text-text-primary">{title}</h3>
            <StepList label={title} steps={steps.map(renderBold)} />
        </section>
    )
}

function DesktopContent() {
    return (
        <div className="grid sm:grid-cols-2">
            <DesktopTutorialSection title="iPhone or iPad" steps={DESKTOP_IOS_STEPS} />
            <DesktopTutorialSection title="Android" steps={DESKTOP_ANDROID_STEPS} />
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
 * All three exits persist a decision server-side, and the scrim, Escape and
 * the close button count as "remind me later" — there is no way to close this
 * without recording something.
 */
function AppInstallPromptModal() {
    const [showModal, setShowModal] = useState(false)
    const [deviceType, setDeviceType] = useState('desktop')
    const [promptType, setPromptType] = useState('mobile_install')
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
    // Escape, the scrim and the close button all count as "remind me later".
    // The dialog re-runs its focus handling whenever its `onClose` changes
    // identity, so it gets one stable function that calls the latest handler.
    const remindLaterRef = useRef(handleRemindLater)
    useEffect(() => {
        remindLaterRef.current = handleRemindLater
    })
    const handleClose = useCallback(() => remindLaterRef.current(), [])
    if (!showModal) return null
    const isDesktop = deviceType === 'desktop'
    return (
        <Dialog
            open
            onClose={handleClose}
            size={isDesktop ? 'lg' : 'md'}
            zClassName="z-system"
            bodyClassName="p-0"
            title={isDesktop ? 'Install on your phone' : 'Install Smyrna Tools'}
            description={
                isDesktop
                    ? 'Get the best experience by installing Smyrna Tools on your phone.'
                    : 'Add Smyrna Tools to your home screen for quick access and a better experience.'
            }
            footer={
                <>
                    <button
                        type="button"
                        onClick={handleDismissForever}
                        className="order-last h-9 w-full cursor-pointer rounded-[4px] border-none bg-transparent px-1 text-[13px] text-text-secondary underline-offset-2 transition-colors duration-150 hover:text-text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none sm:order-none sm:mr-auto sm:w-auto"
                    >
                        Don&apos;t show this again
                    </button>
                    <button
                        type="button"
                        onClick={handleRemindLater}
                        className="btn-secondary flex-1 justify-center sm:flex-none"
                    >
                        Remind me later
                    </button>
                    <button
                        type="button"
                        onClick={handleInstalled}
                        className="btn-primary flex-1 justify-center sm:flex-none"
                    >
                        {isDesktop ? 'Got it' : 'I installed it'}
                    </button>
                </>
            }
        >
            {isDesktop ? <DesktopContent /> : <MobileContent deviceType={deviceType} />}
        </Dialog>
    )
}
export default AppInstallPromptModal
