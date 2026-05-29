/* eslint-disable react/forbid-dom-props */
import { useCallback, useEffect, useReducer, useRef } from 'react'

import CrmService from '../../../../services/CrmService'
import { AccountDetailBody } from './AccountDetailBody'

// ─── state ───────────────────────────────────────────────────────────────────

const initialState = {
    account: null,
    contacts: [],
    error: null,
    interactions: [],
    isLoading: true,
    isSaving: false,
    isVisible: false
}

function reducer(state, action) {
    switch (action.type) {
        case 'FETCH_START':
            return { ...state, error: null, isLoading: true }
        case 'FETCH_SUCCESS':
            return {
                ...state,
                account: action.payload.account,
                contacts: action.payload.contacts ?? [],
                error: null,
                interactions: action.payload.interactions ?? [],
                isLoading: false
            }
        case 'FETCH_ERROR':
            return { ...state, error: action.payload, isLoading: false }
        case 'SAVE_START':
            return { ...state, isSaving: true }
        case 'SAVE_DONE':
            return { ...state, isSaving: false }
        case 'SHOW':
            return { ...state, isVisible: true }
        default:
            return state
    }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Returns whether the user has indicated they prefer reduced motion. */
const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Builds a tap-to-call href from a contact list, falling back to the
 *  raw account phone. Primary contacts are preferred. */
function derivePrimaryPhone(contacts, accountPhone) {
    const primary = contacts.find((c) => c.is_primary) ?? contacts[0] ?? null
    if (primary) {
        return {
            phone: primary.phone_display,
            phoneHref: primary.phone_digits ? `tel:${primary.phone_digits}` : null
        }
    }
    return {
        phone: accountPhone ?? null,
        phoneHref: accountPhone ? `tel:${accountPhone}` : null
    }
}

// ─── component ───────────────────────────────────────────────────────────────

/**
 * Right-side slide-over drawer showing contacts, interaction history, and a
 * log-interaction composer for a single CRM account.
 *
 * Uses the shared AccountDetailBody (sticky header + Contacts | Activity |
 * Opportunities tab strip) so the design is consistent with the inline
 * CrmCustomerDetail surface.
 *
 * @param {string} accountId - The account to display.
 * @param {string} accentColor - CSS color passed through to the log composer.
 * @param {() => void} onClose - Called when the user closes the drawer.
 */
export function AccountDetailDrawer({ accountId, accentColor, onClose }) {
    const [state, dispatch] = useReducer(reducer, initialState)
    const mounted = useRef(true)

    // ── animation: mark visible after first paint so the CSS transition fires
    useEffect(() => {
        const id = requestAnimationFrame(() => {
            if (mounted.current) dispatch({ type: 'SHOW' })
        })
        return () => cancelAnimationFrame(id)
    }, [])

    // ── cleanup on unmount
    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])

    // ── Escape key listener
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

    // ── data fetch
    const fetchBundle = useCallback(async () => {
        dispatch({ type: 'FETCH_START' })
        try {
            const data = await CrmService.fetchAccount(accountId)
            if (mounted.current) dispatch({ payload: data ?? {}, type: 'FETCH_SUCCESS' })
        } catch (err) {
            if (mounted.current) {
                dispatch({ payload: err?.message || 'Failed to load account', type: 'FETCH_ERROR' })
            }
        }
    }, [accountId])

    useEffect(() => {
        fetchBundle()
    }, [fetchBundle])

    // ── log-interaction submission
    const handleLog = useCallback(
        async (payload) => {
            dispatch({ type: 'SAVE_START' })
            try {
                await CrmService.logInteraction({
                    accountId,
                    comment: payload.comment,
                    interactionType: payload.interactionType,
                    roleLens: payload.roleLens
                })
            } finally {
                // Re-fetch regardless of success/failure to stay consistent.
                await fetchBundle()
                if (mounted.current) dispatch({ type: 'SAVE_DONE' })
            }
        },
        [accountId, fetchBundle]
    )

    const { account, contacts, error, interactions, isLoading, isSaving, isVisible } = state
    const reduceMotion = prefersReducedMotion()

    const panelTranslate = reduceMotion ? 'translate-x-0' : isVisible ? 'translate-x-0' : 'translate-x-full'

    const scrimOpacity = isVisible ? 'bg-black/50' : 'bg-transparent'

    const { phone: primaryPhone, phoneHref: primaryPhoneHref } = derivePrimaryPhone(contacts, account?.phone)

    return (
        <>
            {/* Backdrop scrim */}
            <div
                className={`fixed inset-0 z-[999] transition-colors duration-250 ease-out ${scrimOpacity}`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Slide-over panel */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label={account?.name ?? 'Account details'}
                className={[
                    'fixed right-0 top-0 z-[1000] flex h-full w-full max-w-md flex-col',
                    'bg-bg-primary shadow-xl',
                    'transition-transform duration-250 ease-out',
                    panelTranslate
                ].join(' ')}
            >
                {error ? (
                    <div className="px-4 py-3 text-[12.5px] text-red-500">{error}</div>
                ) : isLoading ? (
                    <DrawerSkeleton />
                ) : (
                    <AccountDetailBody
                        account={account}
                        accentColor={accentColor}
                        closeIcon="xmark"
                        closeLabel="Close"
                        fillHeight
                        interactions={interactions}
                        isSavingInteraction={isSaving}
                        onClose={onClose}
                        onLogInteraction={handleLog}
                        primaryPhone={primaryPhone}
                        primaryPhoneHref={primaryPhoneHref}
                    />
                )}
            </div>
        </>
    )
}

// ─── DrawerSkeleton ───────────────────────────────────────────────────────────

function DrawerSkeleton() {
    const Bar = ({ className = '' }) => <div className={`animate-pulse rounded bg-bg-tertiary ${className}`} />
    return (
        <div className="flex flex-col gap-4 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-2 flex-1">
                    <Bar className="h-4 w-40" />
                    <Bar className="h-3 w-20" />
                </div>
                <Bar className="h-8 w-8 rounded-md" />
            </div>
            <div className="flex items-center gap-2">
                <Bar className="h-8 w-32 rounded-md" />
                <Bar className="h-8 w-28 rounded-md ml-auto" />
            </div>
            {/* Tab strip placeholder */}
            <div className="flex gap-1 border-b border-border-light pb-0">
                <Bar className="h-9 w-20 rounded-t" />
                <Bar className="h-9 w-20 rounded-t" />
                <Bar className="h-9 w-28 rounded-t" />
            </div>
            {/* Content placeholders */}
            <div className="flex flex-col gap-3 pt-2">
                <Bar className="h-3 w-20" />
                <Bar className="h-10 w-full rounded-md" />
                <Bar className="h-10 w-full rounded-md" />
            </div>
        </div>
    )
}
