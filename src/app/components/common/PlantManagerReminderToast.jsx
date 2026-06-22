/* eslint-disable react/forbid-dom-props */
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'

import { Database } from '../../../services/DatabaseService'
import { getSessionUserId } from '../../../services/SessionService'

const WARNING_COLOR = '#d97706'

function PlantManagerReminderToast() {
    const [visible, setVisible] = useState(false)
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        let cancelled = false
        async function checkRole() {
            try {
                const { data: sessionData } = await Database.auth.getSession()
                const userId = sessionData?.session?.user?.id || getSessionUserId() || ''
                if (!userId || cancelled) return
                const roles = await UserService.getUserRoles(userId)
                const isPlantManager = roles?.some(
                    (r) =>
                        r?.name?.toLowerCase().includes('plant manager') ||
                        r?.name?.toLowerCase().includes('pm') ||
                        r?.name?.toLowerCase() === 'plant_manager'
                )
                if (!cancelled) setVisible(isPlantManager)
            } catch {
                /* role check failed — don't show the toast */
            }
        }
        checkRole()
        return () => { cancelled = true }
    }, [])

    if (!visible || dismissed) return null
    if (typeof document === 'undefined' || !document.body) return null

    return ReactDOM.createPortal(
        <div
            role="status"
            aria-live="polite"
            className="fixed bottom-5 right-5 z-[9998] w-[22rem] overflow-hidden rounded-modal border border-border-light bg-bg-primary shadow-modal animate-fade-slide-in motion-reduce:animate-none"
        >
            <div
                className="flex items-center gap-2 px-4 py-2.5"
                style={{ backgroundColor: WARNING_COLOR }}
            >
                <i className="fas fa-triangle-exclamation text-sm text-white" aria-hidden="true" />
                <span className="text-sm font-semibold text-white">Plant Manager Reminder</span>
            </div>
            <div className="px-4 py-3">
                <p className="mb-3 text-[0.8125rem] leading-relaxed text-text-secondary">
                    Verify your operators are using the correct operator phones, the right assigned
                    truck, and completing pre-trips in Samsara.
                </p>
                <div className="flex items-center justify-end">
                    <button
                        type="button"
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary cursor-pointer transition-[background-color,color,transform] duration-150 ease-out motion-reduce:transition-none hover:bg-bg-hover hover:text-text-primary active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
                        onClick={() => setDismissed(true)}
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}

export default PlantManagerReminderToast
