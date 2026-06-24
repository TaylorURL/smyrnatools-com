import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock CrmService BEFORE importing the component.
vi.mock('../../../../services/CrmService', () => ({
    default: { savePin: vi.fn() }
}))

// Stub SpeechRecognition so the mic button never appears (simplest path in jsdom).
Object.defineProperty(window, 'SpeechRecognition', { value: undefined, writable: true })
Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, writable: true })

import CrmService from '../../../../services/CrmService'
import { DropPinModal } from '../DropPinModal'

const LOCATION = { lat: 35.1234, lng: -89.5678 }
const ACCENT = '#2563eb'
const noop = () => {}

beforeEach(() => vi.clearAllMocks())

describe('DropPinModal', () => {
    it('renders the captured coordinates when location is provided', () => {
        render(<DropPinModal accentColor={ACCENT} location={LOCATION} onClose={noop} onSaved={noop} />)
        expect(screen.getByText(/location captured/i)).toBeInTheDocument()
        expect(screen.getByText(/35\.1234/)).toBeInTheDocument()
        expect(screen.getByText(/-89\.5678/)).toBeInTheDocument()
    })

    it('shows the location-unavailable error when location is null', () => {
        render(<DropPinModal accentColor={ACCENT} location={null} onClose={noop} onSaved={noop} />)
        expect(screen.getByText(/couldn't get your location/i)).toBeInTheDocument()
    })

    it('disables the Save button when location is null', () => {
        render(<DropPinModal accentColor={ACCENT} location={null} onClose={noop} onSaved={noop} />)
        expect(screen.getByRole('button', { name: /save pin/i })).toBeDisabled()
    })

    it('renders the comment textarea with the label "Job notes"', () => {
        render(<DropPinModal accentColor={ACCENT} location={LOCATION} onClose={noop} onSaved={noop} />)
        expect(screen.getByLabelText(/job notes/i)).toBeInTheDocument()
    })

    it('calls CrmService.savePin with the location and typed comment, then onSaved and onClose', async () => {
        const savedPin = { comment: 'pothole ahead', id: 'p1', lat: 35.1234, lng: -89.5678 }
        CrmService.savePin.mockResolvedValue(savedPin)

        const onSaved = vi.fn()
        const onClose = vi.fn()

        render(<DropPinModal accentColor={ACCENT} location={LOCATION} onClose={onClose} onSaved={onSaved} />)

        fireEvent.change(screen.getByLabelText(/job notes/i), {
            target: { value: 'pothole ahead' }
        })
        fireEvent.click(screen.getByRole('button', { name: /save pin/i }))

        await waitFor(() =>
            expect(CrmService.savePin).toHaveBeenCalledWith({
                comment: 'pothole ahead',
                lat: 35.1234,
                lng: -89.5678
            })
        )
        expect(onSaved).toHaveBeenCalledWith(savedPin)
        expect(onClose).toHaveBeenCalled()
    })

    it('shows an inline error when savePin rejects', async () => {
        CrmService.savePin.mockRejectedValue(new Error('Server unavailable'))

        render(<DropPinModal accentColor={ACCENT} location={LOCATION} onClose={noop} onSaved={noop} />)

        fireEvent.click(screen.getByRole('button', { name: /save pin/i }))

        await waitFor(() => expect(screen.getByText(/server unavailable/i)).toBeInTheDocument())
    })

    it('calls onClose when Cancel is clicked', () => {
        const onClose = vi.fn()
        render(<DropPinModal accentColor={ACCENT} location={LOCATION} onClose={onClose} onSaved={noop} />)
        fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
        expect(onClose).toHaveBeenCalled()
    })

    it('calls onClose when the scrim is clicked', () => {
        const onClose = vi.fn()
        const { container } = render(
            <DropPinModal accentColor={ACCENT} location={LOCATION} onClose={onClose} onSaved={noop} />
        )
        // The scrim is the outer div (first child of container)
        fireEvent.click(container.firstChild)
        expect(onClose).toHaveBeenCalled()
    })

    it('does not show the mic button when SpeechRecognition is unavailable', () => {
        render(<DropPinModal accentColor={ACCENT} location={LOCATION} onClose={noop} onSaved={noop} />)
        expect(screen.queryByRole('button', { name: /mic/i })).not.toBeInTheDocument()
    })
})
