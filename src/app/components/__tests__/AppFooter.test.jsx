import { render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AppFooter from '../common/AppFooter'

const mockVersion = vi.fn(() => '2026.34.1')

vi.mock('../../hooks/useVersion', () => ({
    __esModule: true,
    default: () => mockVersion(),
    useVersion: () => mockVersion()
}))

const renderFooter = (props) =>
    render(
        <MemoryRouter>
            <AppFooter {...props} />
        </MemoryRouter>
    )

describe('AppFooter', () => {
    beforeEach(() => {
        mockVersion.mockReturnValue('2026.34.1')
    })

    it('links out to the TaylorURL status page in a new tab', () => {
        renderFooter()

        const status = screen.getByRole('link', { name: /^status$/i })
        expect(status).toHaveAttribute('href', 'https://www.taylorurl.com/status')
        expect(status).toHaveAttribute('target', '_blank')
        expect(status).toHaveAttribute('rel', expect.stringContaining('noopener'))
    })

    it('mounts the shared bar inside the footer so it takes the surrounding palette', () => {
        const { container } = renderFooter()

        const rail = container.querySelector('[data-taylorurl-bar]')
        expect(rail).toBeInTheDocument()
        expect(rail.closest('footer')).not.toBeNull()
        expect(screen.getByRole('link', { name: /built by taylorurl/i })).toHaveAttribute(
            'href',
            'https://www.taylorurl.com'
        )
    })

    it('shows the deployed version', () => {
        renderFooter()

        expect(screen.getByText('v2026.34.1')).toBeInTheDocument()
    })

    it('still renders the status link when the version is unknown', () => {
        mockVersion.mockReturnValue('')
        renderFooter()

        expect(screen.queryByText(/^v/)).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: /^status$/i })).toBeInTheDocument()
    })

    it.each([
        ['Privacy', '/privacy'],
        ['Terms', '/terms'],
        ['Contact', '/contact']
    ])('links to the %s route', (label, href) => {
        renderFooter()

        expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href)
    })
})
