import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock CrmService BEFORE importing the component.
vi.mock('../../../../../services/CrmService', () => ({
    default: { deletePin: vi.fn(), fetchPins: vi.fn() }
}))

// Mock AuthContext — CrmPinsPage uses useAuth to read user.id for own-pin detection.
vi.mock('../../../../context/AuthContext', () => ({
    useAuth: vi.fn(() => ({ user: { id: 'u1' } }))
}))

// Mock Leaflet — jsdom cannot run canvas/WebGL
vi.mock('leaflet', () => {
    const layerGroup = { addTo: vi.fn(), clearLayers: vi.fn() }
    const tileLayer = { addTo: vi.fn(), _url: '' }
    const marker = { addTo: vi.fn(), bindPopup: vi.fn().mockReturnThis() }
    return {
        default: {
            divIcon: vi.fn(() => ({})),
            latLngBounds: vi.fn(() => ({})),
            layerGroup: vi.fn(() => layerGroup),
            map: vi.fn(() => ({
                fitBounds: vi.fn(),
                invalidateSize: vi.fn(),
                remove: vi.fn(),
                removeLayer: vi.fn(),
                setView: vi.fn()
            })),
            marker: vi.fn(() => marker),
            tileLayer: vi.fn(() => tileLayer)
        }
    }
})

vi.mock('../../../../../views/tools/plan/flow-map/flowMapShared', () => ({
    TENNESSEE_CENTER: [35.86, -86.66],
    buildTileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    isDarkTheme: vi.fn(() => false)
}))

// useCrmViewMode — default to 'list' so the table renders without real localStorage.
vi.mock('../../../../hooks/useCrmViewMode', () => ({
    useCrmViewMode: vi.fn(() => ['list', vi.fn()])
}))

import CrmService from '../../../../../services/CrmService'
import { CrmPinsPage } from '../CrmPinsPage'

const PIN_A = {
    id: 'p1',
    lat: 35.1,
    lng: -89.5,
    comment: 'Pothole by driveway',
    created_by: 'u1',
    created_by_name: 'Alice',
    created_at: '2026-05-28T10:00:00Z'
}

const PIN_B = {
    id: 'p2',
    lat: 35.2,
    lng: -89.6,
    comment: 'Road edge crumbling',
    created_by: 'u2',
    created_by_name: 'Bob',
    created_at: '2026-05-27T09:30:00Z'
}

beforeEach(() => vi.clearAllMocks())

describe('CrmPinsPage — list view (default)', () => {
    it('renders both pin notes in the table', async () => {
        CrmService.fetchPins.mockResolvedValue([PIN_A, PIN_B])

        render(<CrmPinsPage accentColor="#2563eb" />)

        await waitFor(() => expect(screen.getByText('Pothole by driveway')).toBeInTheDocument())
        expect(screen.getByText('Road edge crumbling')).toBeInTheDocument()
    })

    it('shows author names in the table', async () => {
        CrmService.fetchPins.mockResolvedValue([PIN_A, PIN_B])

        render(<CrmPinsPage accentColor="#2563eb" />)

        await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
        expect(screen.getByText('Bob')).toBeInTheDocument()
    })

    it("shows a Delete button only on the caller's own pins", async () => {
        CrmService.fetchPins.mockResolvedValue([PIN_A, PIN_B])

        render(<CrmPinsPage accentColor="#2563eb" />)

        await waitFor(() => expect(screen.getByText('Pothole by driveway')).toBeInTheDocument())

        // PIN_A is owned by u1 (matches mocked user) — delete button present.
        const deleteButtons = screen.getAllByRole('button', { name: /delete pin/i })
        expect(deleteButtons).toHaveLength(1)
    })

    it('calls CrmService.deletePin when the delete button is clicked', async () => {
        CrmService.fetchPins.mockResolvedValue([PIN_A])
        CrmService.deletePin.mockResolvedValue({})

        render(<CrmPinsPage accentColor="#2563eb" />)

        await waitFor(() => expect(screen.getByRole('button', { name: /delete pin/i })).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: /delete pin/i }))

        await waitFor(() => expect(CrmService.deletePin).toHaveBeenCalledWith('p1'))
    })

    it('shows the empty state when fetchPins resolves with no pins', async () => {
        CrmService.fetchPins.mockResolvedValue([])

        render(<CrmPinsPage accentColor="#2563eb" />)

        await waitFor(() => expect(screen.getByText(/no pins dropped yet/i)).toBeInTheDocument())
    })

    it('shows an error banner when fetchPins rejects', async () => {
        CrmService.fetchPins.mockRejectedValue(new Error('Network timeout'))

        render(<CrmPinsPage accentColor="#2563eb" />)

        await waitFor(() => expect(screen.getByText(/network timeout/i)).toBeInTheDocument())
    })

    it('does not show the empty state when pins are present', async () => {
        CrmService.fetchPins.mockResolvedValue([PIN_A])

        render(<CrmPinsPage accentColor="#2563eb" />)

        await waitFor(() => expect(screen.queryByText(/no pins dropped yet/i)).not.toBeInTheDocument())
    })
})

describe('CrmPinsPage — map view', () => {
    it('renders the map container when view mode is cards', async () => {
        // Override the mock to return 'cards' mode.
        const { useCrmViewMode } = await import('../../../../hooks/useCrmViewMode')
        useCrmViewMode.mockReturnValue(['cards', vi.fn()])

        CrmService.fetchPins.mockResolvedValue([PIN_A])

        const { container } = render(<CrmPinsPage accentColor="#2563eb" />)

        await waitFor(() => expect(CrmService.fetchPins).toHaveBeenCalled())

        // The map container div is always mounted (visibility toggled via display style).
        // In cards mode it should be visible (display !== 'none').
        const mapWrapper = container.querySelector('[style*="display: block"]')
        expect(mapWrapper).toBeTruthy()
    })

    it('shows the empty state in map mode when there are no pins', async () => {
        const { useCrmViewMode } = await import('../../../../hooks/useCrmViewMode')
        useCrmViewMode.mockReturnValue(['cards', vi.fn()])

        CrmService.fetchPins.mockResolvedValue([])

        render(<CrmPinsPage accentColor="#2563eb" />)

        await waitFor(() => expect(screen.getByText(/no pins dropped yet/i)).toBeInTheDocument())
    })
})
