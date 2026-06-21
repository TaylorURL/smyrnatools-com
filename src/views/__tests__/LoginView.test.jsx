import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import LoginView from '../common/login/LoginView'

// --- Mocks ---

const mockSignIn = jest.fn()
const mockSignUp = jest.fn()

jest.mock('../../app/context/AuthContext', () => ({
    useAuth: () => ({
        error: null,
        loading: false,
        signIn: mockSignIn,
        signUp: mockSignUp
    })
}))

jest.mock('../../app/hooks/useVersion', () => ({
    __esModule: true,
    default: () => '1.0.0',
    useVersion: () => '1.0.0'
}))

jest.mock('../../app/hooks/useIsMobile', () => ({
    useIsMobile: () => false
}))

jest.mock('../../services/DatabaseService', () => ({
    Database: {
        from: () => ({
            select: () => ({
                in: () => Promise.resolve({ count: 5 }),
                neq: () => Promise.resolve({ count: 10 })
            })
        })
    }
}))

jest.mock('../../utils/ValidationUtility', () => ({
    __esModule: true,
    default: {
        normalizeName: jest.fn((name) => Promise.resolve(name)),
        passwordStrength: jest.fn(() => Promise.resolve('strong'))
    }
}))

jest.mock(
    '../../app/components/common/VersionPopup',
    () =>
        function MockVersionPopup() {
            return <div data-testid="version-popup" />
        }
)

jest.mock('../../assets/images/srm-logo.svg', () => 'srm-logo.svg')

/** Resolves the form submit button by exact accessible name to avoid
 *  colliding with the "Smyrna Tools" destination card which also contains
 *  the words "Sign in". */
const getSubmitButton = () => screen.getByRole('button', { name: 'Sign in' })

describe('LoginView portal', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('renders the portal hero with the embedded login form', () => {
        render(<LoginView />)

        expect(screen.getByRole('heading', { level: 1, name: /smyrna/i })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: /sign in to smyrna tools/i })).toBeInTheDocument()
        expect(getSubmitButton()).toBeInTheDocument()
    })

    it('exposes Smyrna Ready Mix and Samsara as external destination links', () => {
        render(<LoginView />)

        const readyMix = screen.getByRole('link', { name: /smyrna ready mix/i })
        const samsara = screen.getByRole('link', { name: /samsara/i })

        expect(readyMix).toHaveAttribute('href', 'https://smyrnareadymix.com')
        expect(readyMix).toHaveAttribute('target', '_blank')
        expect(readyMix).toHaveAttribute('rel', expect.stringContaining('noopener'))
        expect(samsara).toHaveAttribute('href', 'https://samsara.com')
        expect(samsara).toHaveAttribute('target', '_blank')
        expect(samsara).toHaveAttribute('rel', expect.stringContaining('noopener'))
    })

    it('shows error when submitting empty login form', async () => {
        render(<LoginView />)

        await userEvent.click(getSubmitButton())

        expect(screen.getByText('Please enter your email and password.')).toBeInTheDocument()
        expect(mockSignIn).not.toHaveBeenCalled()
    })

    it('calls signIn with email and password on valid submission', async () => {
        mockSignIn.mockResolvedValue({ id: 'user-123' })
        render(<LoginView />)

        const emailInput = document.querySelector('input[type="email"]')
        const passwordInput = document.querySelector('input[type="password"]')

        await userEvent.type(emailInput, 'test@example.com')
        await userEvent.type(passwordInput, 'password123')
        await userEvent.click(getSubmitButton())

        await waitFor(() => {
            expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123')
        })
    })

    it('shows success message after successful sign in', async () => {
        mockSignIn.mockResolvedValue({ id: 'user-123' })
        render(<LoginView />)

        const emailInput = document.querySelector('input[type="email"]')
        const passwordInput = document.querySelector('input[type="password"]')

        await userEvent.type(emailInput, 'test@example.com')
        await userEvent.type(passwordInput, 'secret')
        await userEvent.click(getSubmitButton())

        await waitFor(() => {
            expect(screen.getByText('Signed in successfully.')).toBeInTheDocument()
        })
    })

    it('shows error when signIn throws', async () => {
        mockSignIn.mockRejectedValue(new Error('Invalid credentials'))
        render(<LoginView />)

        const emailInput = document.querySelector('input[type="email"]')
        const passwordInput = document.querySelector('input[type="password"]')

        await userEvent.type(emailInput, 'test@example.com')
        await userEvent.type(passwordInput, 'wrongpassword')
        await userEvent.click(getSubmitButton())

        await waitFor(() => {
            expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
        })
    })

    it('toggles to sign-up mode and shows name fields', async () => {
        render(<LoginView />)

        const signUpLink = screen.getByRole('button', { name: /sign up/i })
        await userEvent.click(signUpLink)

        expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument()
    })

    it('shows error in sign-up mode when fields are incomplete', async () => {
        render(<LoginView />)

        const signUpLink = screen.getByRole('button', { name: /sign up/i })
        await userEvent.click(signUpLink)

        const submitButton = screen.getByRole('button', { name: /create account/i })
        await userEvent.click(submitButton)

        expect(screen.getByText('Please complete all fields.')).toBeInTheDocument()
    })

    it('toggles password visibility', async () => {
        render(<LoginView />)

        const passwordInput = document.querySelector('input[type="password"]')
        expect(passwordInput.type).toBe('password')

        const toggleButton = passwordInput.parentElement.querySelector('button')
        await userEvent.click(toggleButton)

        expect(passwordInput.type).toBe('text')
    })
})
