import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock CrmService BEFORE importing the component.
vi.mock('../../../../services/CrmService', () => ({
    default: { geocodeAccounts: vi.fn() }
}))

import CrmService from '../../../../services/CrmService'
import { CrmSettingsPage } from '../CrmSettingsPage'

beforeEach(() => vi.clearAllMocks())

describe('CrmSettingsPage', () => {
    it('renders the geocode button', () => {
        render(<CrmSettingsPage accentColor="#1e3a5f" />)
        expect(screen.getByRole('button', { name: /geocode accounts/i })).toBeInTheDocument()
    })

    it('calls CrmService.geocodeAccounts when the button is clicked', async () => {
        CrmService.geocodeAccounts.mockResolvedValue({ geocoded: 3, failed: 0, remaining: 0 })

        render(<CrmSettingsPage accentColor="#1e3a5f" />)
        fireEvent.click(screen.getByRole('button', { name: /geocode accounts/i }))

        await waitFor(() => expect(CrmService.geocodeAccounts).toHaveBeenCalledWith({ limit: 15 }))
    })

    it('shows success summary after all accounts are geocoded', async () => {
        CrmService.geocodeAccounts.mockResolvedValue({ geocoded: 3, failed: 0, remaining: 0 })

        render(<CrmSettingsPage accentColor="#1e3a5f" />)
        fireEvent.click(screen.getByRole('button', { name: /geocode accounts/i }))

        await waitFor(() => expect(screen.getByText(/done — geocoded 3 accounts/i)).toBeInTheDocument())
    })

    it('shows failure count in the summary when some addresses could not be geocoded', async () => {
        CrmService.geocodeAccounts.mockResolvedValue({ geocoded: 2, failed: 1, remaining: 0 })

        render(<CrmSettingsPage accentColor="#1e3a5f" />)
        fireEvent.click(screen.getByRole('button', { name: /geocode accounts/i }))

        await waitFor(() => expect(screen.getByText(/1 failed/i)).toBeInTheDocument())
    })

    it('shows an inline error message when the service throws', async () => {
        CrmService.geocodeAccounts.mockRejectedValue(new Error('Network error'))

        render(<CrmSettingsPage accentColor="#1e3a5f" />)
        fireEvent.click(screen.getByRole('button', { name: /geocode accounts/i }))

        await waitFor(() => expect(screen.getByText(/network error/i)).toBeInTheDocument())
    })

    it('loops until remaining reaches 0', async () => {
        CrmService.geocodeAccounts
            .mockResolvedValueOnce({ geocoded: 5, failed: 0, remaining: 5 })
            .mockResolvedValueOnce({ geocoded: 5, failed: 0, remaining: 0 })

        render(<CrmSettingsPage accentColor="#1e3a5f" />)
        fireEvent.click(screen.getByRole('button', { name: /geocode accounts/i }))

        await waitFor(() => expect(CrmService.geocodeAccounts).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(screen.getByText(/done — geocoded 10 accounts/i)).toBeInTheDocument())
    })
})
