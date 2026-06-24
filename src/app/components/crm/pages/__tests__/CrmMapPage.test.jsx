import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Leaflet calls window.URL, requestAnimationFrame, and various DOM APIs
// that jsdom doesn't provide. Mock the entire leaflet module so the map
// init effect is a no-op and we can test the component's pure-React
// branches (empty state / non-empty state) without a real map.
vi.mock('leaflet', () => {
    const layerGroup = { addTo: vi.fn(), clearLayers: vi.fn() }
    const tileLayer = { _url: '', addTo: vi.fn() }
    const marker = { addTo: vi.fn(), bindPopup: vi.fn().mockReturnThis() }
    return {
        default: {
            divIcon: vi.fn(() => ({})),
            fitBounds: vi.fn(),
            latLngBounds: vi.fn(() => ({})),
            layerGroup: vi.fn(() => layerGroup),
            map: vi.fn(() => ({
                fitBounds: vi.fn(),
                invalidateSize: vi.fn(),
                off: vi.fn(),
                on: vi.fn(),
                remove: vi.fn(),
                removeLayer: vi.fn(),
                setView: vi.fn()
            })),
            marker: vi.fn(() => marker),
            tileLayer: vi.fn(() => tileLayer)
        }
    }
})

// flowMapShared uses `L` directly — mock it so the module can load.
vi.mock('../../../../../views/tools/plan/flow-map/flowMapShared', () => ({
    TENNESSEE_CENTER: [35.86, -86.66],
    buildTileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    isDarkTheme: vi.fn(() => false)
}))

import { CrmMapPage } from '../CrmMapPage'

const rosterWithNoCoords = [
    { account_id: 'a1', customer_name: 'Alpha Corp', lifecycle_stage: 'active' },
    { account_id: 'a2', customer_name: 'Beta LLC', lat: null, lifecycle_stage: 'prospect', lng: null }
]

const rosterWithCoords = [
    { account_id: 'a3', customer_name: 'Gamma Inc', lat: 36.17, lifecycle_stage: 'customer', lng: -86.78 },
    { account_id: 'a4', customer_name: 'Delta Co', lat: 35.46, lifecycle_stage: 'active', lng: -86.46 }
]

describe('CrmMapPage', () => {
    it('shows the empty-state message when no rows have lat/lng', () => {
        render(<CrmMapPage accentColor="#2563eb" roster={rosterWithNoCoords} />)
        expect(screen.getByText(/run the geocoder from the settings tab/i)).toBeInTheDocument()
    })

    it('does not show the empty state when rows have valid lat/lng', () => {
        render(<CrmMapPage accentColor="#2563eb" roster={rosterWithCoords} />)
        expect(screen.queryByText(/run the geocoder from the settings tab/i)).not.toBeInTheDocument()
    })

    it('shows the empty state for an empty roster', () => {
        render(<CrmMapPage accentColor="#2563eb" roster={[]} />)
        expect(screen.getByText(/run the geocoder from the settings tab/i)).toBeInTheDocument()
    })

    it('shows the empty state when roster is undefined', () => {
        render(<CrmMapPage accentColor="#2563eb" roster={undefined} />)
        expect(screen.getByText(/run the geocoder from the settings tab/i)).toBeInTheDocument()
    })
})
