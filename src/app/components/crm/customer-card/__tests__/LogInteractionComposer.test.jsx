import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LogInteractionComposer } from '../LogInteractionComposer'

describe('LogInteractionComposer', () => {
    it('submits the chosen type, lens and comment', () => {
        const onSubmit = vi.fn()
        render(<LogInteractionComposer defaultLens="sales" accentColor="#2563eb" onSubmit={onSubmit} />)
        fireEvent.change(screen.getByLabelText(/note/i), { target: { value: 'Met on site' } })
        fireEvent.click(screen.getByRole('button', { name: /log interaction/i }))
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                comment: 'Met on site',
                interactionType: 'call',
                roleLens: 'sales'
            })
        )
    })

    it('lets the user switch interaction type', () => {
        const onSubmit = vi.fn()
        render(<LogInteractionComposer defaultLens="general" accentColor="#2563eb" onSubmit={onSubmit} />)
        fireEvent.click(screen.getByRole('button', { name: /site visit/i }))
        fireEvent.click(screen.getByRole('button', { name: /log interaction/i }))
        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ interactionType: 'site_visit' }))
    })
})
