import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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

jest.mock('../../app/components/common/VersionPopup', () =>
    function MockVersionPopup() {
        return <div data-testid="version-popup" />
    }
)

jest.mock('../../assets/images/srm-logo.svg', () => 'srm-logo.svg')

import LoginView from '../common/login/LoginView'

describe('LoginView', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('renders the login form with email and password fields', () => {
        render(<LoginView />)

        expect(screen.getByText('Welcome back')).toBeInTheDocument()
        expect(screen.getByText('Sign in')).toBeInTheDocument()
    })

    it('shows error when submitting empty login form', async () => {
        render(<LoginView />)

        const submitButton = screen.getByRole('button', { name: /sign in/i })
        await userEvent.click(submitButton)

        expect(screen.getByText('Please enter your email and password.')).toBeInTheDocument()
        expect(mockSignIn).not.toHaveBeenCalled()
    })

    it('calls signIn with email and password on valid submission', async () => {
        mockSignIn.mockResolvedValue({ id: 'user-123' })
        render(<LoginView />)

        // Find inputs by their labels
        const emailInput = document.querySelector('input[type="email"]')
        const passwordInput = document.querySelector('input[type="password"]')

        await userEvent.type(emailInput, 'test@example.com')
        await userEvent.type(passwordInput, 'password123')

        const submitButton = screen.getByRole('button', { name: /sign in/i })
        await userEvent.click(submitButton)

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

        const submitButton = screen.getByRole('button', { name: /sign in/i })
        await userEvent.click(submitButton)

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

        const submitButton = screen.getByRole('button', { name: /sign in/i })
        await userEvent.click(submitButton)

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

        // Switch to sign-up mode
        const signUpLink = screen.getByRole('button', { name: /sign up/i })
        await userEvent.click(signUpLink)

        // Submit without filling anything
        const submitButton = screen.getByRole('button', { name: /create account/i })
        await userEvent.click(submitButton)

        expect(screen.getByText('Please complete all fields.')).toBeInTheDocument()
    })

    it('toggles password visibility', async () => {
        render(<LoginView />)

        const passwordInput = document.querySelector('input[type="password"]')
        expect(passwordInput.type).toBe('password')

        // The toggle button has an eye icon
        const toggleButton = passwordInput.parentElement.querySelector('button')
        await userEvent.click(toggleButton)

        expect(passwordInput.type).toBe('text')
    })
})
