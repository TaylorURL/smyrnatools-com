import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { InteractionTimeline } from '../InteractionTimeline'

describe('InteractionTimeline', () => {
    it('renders type, lens label, author and comment', () => {
        render(
            <InteractionTimeline
                interactions={[
                    {
                        id: 'i1',
                        interaction_type: 'site_visit',
                        role_lens: 'plant',
                        comment: 'Checked the pour',
                        created_by_name: 'Jane',
                        occurred_at: '2026-05-20T12:00:00Z'
                    }
                ]}
            />
        )
        expect(screen.getByText(/Checked the pour/)).toBeInTheDocument()
        expect(screen.getByText(/plant/i)).toBeInTheDocument()
        expect(screen.getByText(/Jane/)).toBeInTheDocument()
    })

    it('shows an empty state when there are no interactions', () => {
        render(<InteractionTimeline interactions={[]} />)
        expect(screen.getByText(/no interactions logged/i)).toBeInTheDocument()
    })
})
