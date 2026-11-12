import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import CommentModalSection from '../sections/CommentModalSection'

vi.mock('../../../services/UserService', () => ({
    UserService: {
        getCurrentUser: vi.fn(async () => ({ id: 'u1' })),
        getUserDisplayName: vi.fn(async () => 'James Scott')
    }
}))

vi.mock('../../hooks/useUserAccent', () => ({ useUserAccent: () => null }))

const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString()

const makeService = (comments) => ({
    addComment: vi.fn(async () => ({})),
    deleteComment: vi.fn(async () => ({})),
    fetchComments: vi.fn(async () => comments)
})

const renderPopup = (service) =>
    render(<CommentModalSection itemId="m1" itemNumber="1042" itemType="Mixer" onClose={() => {}} service={service} />)

describe('CommentModalSection', () => {
    it('shows each comment its own status and no way to change it', async () => {
        renderPopup(
            makeService([
                { author: 'u1', created_at: daysAgo(1), id: 'a', permanent: false, text: 'Drum seal leaking.' },
                { author: 'u1', created_at: daysAgo(40), id: 'b', permanent: true, text: 'Assigned to Smyrna.' },
                { author: 'u1', created_at: daysAgo(45), id: 'c', permanent: false, text: 'Waiting on tires.' }
            ])
        )
        expect(await screen.findByText('Drum seal leaking.')).toBeInTheDocument()
        expect(screen.getByText(/^Resolves /)).toBeInTheDocument()
        expect(screen.getByText('Permanent')).toBeInTheDocument()
        expect(screen.getByText('May be out of date')).toBeInTheDocument()
        // The only switch is the composer's, for the comment being written.
        expect(screen.getAllByRole('switch')).toHaveLength(1)
    })

    it('sends permanent only with the comment being posted, then turns it back off', async () => {
        const service = makeService([])
        renderPopup(service)
        await screen.findByText('No comments yet')

        const keep = screen.getByRole('switch')
        expect(keep).toHaveAttribute('aria-checked', 'false')
        fireEvent.click(keep)
        expect(keep).toHaveAttribute('aria-checked', 'true')
        expect(screen.getByText('On: this comment is never auto-resolved')).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('Write a comment'), { target: { value: 'Keep on file.' } })
        fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))

        await waitFor(() => expect(service.addComment).toHaveBeenCalledWith('m1', 'Keep on file.', 'u1', true))
        await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false'))
    })

    it('keeps resolved comments on the Resolved tab and says when one timed out', async () => {
        renderPopup(
            makeService([
                { author: 'u1', created_at: daysAgo(2), id: 'a', permanent: false, text: 'Brakes checked.' },
                {
                    auto_resolved: true,
                    author: 'u1',
                    created_at: daysAgo(100),
                    id: 'b',
                    permanent: false,
                    resolved_at: daysAgo(8),
                    text: 'Needs a new mirror.'
                }
            ])
        )
        expect(await screen.findByText('Brakes checked.')).toBeInTheDocument()
        expect(screen.queryByText('Needs a new mirror.')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /^Resolved/ }))
        expect(await screen.findByText('Needs a new mirror.')).toBeInTheDocument()
        expect(screen.getByText('Timed out')).toBeInTheDocument()
        expect(screen.getByText(/^Auto-resolved .* after 3 months$/)).toBeInTheDocument()
        expect(screen.queryByText('Brakes checked.')).not.toBeInTheDocument()
        // Nothing is written from the Resolved tab.
        expect(screen.queryByLabelText('Write a comment')).not.toBeInTheDocument()
    })
})
