import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import StaleNotesPrompt from '../dashboard/StaleNotesPrompt'

const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString()

const NOTES = [
    {
        assetLabel: '2121',
        assetType: 'Mixer',
        atMyPlants: true,
        authorName: 'Derek Hollis',
        createdAt: daysAgo(45),
        id: 'c1',
        key: 'comment:c1',
        kind: 'comment',
        plantCode: '401',
        text: 'Backup alarm intermittent.'
    },
    {
        assetLabel: '2124',
        assetType: 'Mixer',
        atMyPlants: true,
        authorName: 'Derek Hollis',
        createdAt: daysAgo(60),
        id: 'c2',
        key: 'comment:c2',
        kind: 'comment',
        plantCode: '401',
        text: 'Needs new tires before winter.'
    },
    {
        assetLabel: '310',
        assetType: 'Tractor',
        atMyPlants: true,
        authorName: 'Priya Natarajan',
        createdAt: daysAgo(90),
        id: 'i1',
        key: 'issue:i1',
        kind: 'issue',
        plantCode: '401',
        severity: 'High',
        text: 'Hydraulic hose weeping.'
    }
]

/** Holds the list the way the dashboard's hook does, so removing and keeping
 *  actually take rows away. */
function Harness({ onChanged, onDismiss, onRemove }) {
    const [notes, setNotes] = useState(NOTES)
    const [asked, setAsked] = useState(false)
    const drop = (note) => setNotes((list) => list.filter((n) => n.key !== note.key))
    return (
        <StaleNotesPrompt
            notes={asked ? [] : notes}
            onChanged={onChanged}
            onDismiss={() => {
                setAsked(true)
                onDismiss()
            }}
            onKeep={drop}
            onRemove={async (note) => {
                await onRemove(note)
                drop(note)
            }}
        />
    )
}

const setup = () => {
    const props = { onChanged: vi.fn(), onDismiss: vi.fn(), onRemove: vi.fn(async () => {}) }
    render(<Harness {...props} />)
    return props
}

describe('StaleNotesPrompt', () => {
    it('sums up the old notes in the corner card', () => {
        setup()
        expect(screen.getByRole('status')).toHaveTextContent('Old notes at your plants')
        expect(screen.getByRole('status')).toHaveTextContent(
            '2 comments and 1 open issue are over 30 days old and may be out of date.'
        )
    })

    it("heads the card as the user's own notes when none is at a plant they manage", () => {
        const mine = NOTES.map((note) => ({ ...note, atMyPlants: false, mine: true }))
        render(<StaleNotesPrompt notes={mine} onDismiss={vi.fn()} onKeep={vi.fn()} onRemove={vi.fn()} />)
        expect(screen.getByRole('status')).toHaveTextContent('Your old notes')
        expect(screen.getByRole('status')).not.toHaveTextContent('at your plants')
    })

    it('stops asking for this visit on Not now', () => {
        const { onChanged, onDismiss } = setup()
        fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
        expect(onDismiss).toHaveBeenCalledTimes(1)
        expect(onChanged).not.toHaveBeenCalled()
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('removes and keeps notes from the review list', async () => {
        const { onChanged, onRemove } = setup()
        fireEvent.click(screen.getByRole('button', { name: 'Review' }))
        expect(screen.getByRole('dialog')).toHaveTextContent('Old comments and issues')
        expect(screen.getByText('Backup alarm intermittent.')).toBeInTheDocument()

        fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])
        await waitFor(() => expect(screen.queryByText('Backup alarm intermittent.')).not.toBeInTheDocument())
        expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', kind: 'comment' }))

        fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
        expect(screen.queryByText('Needs new tires before winter.')).not.toBeInTheDocument()
        expect(screen.getByText('The other tab still has some to look at.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Issues/ }))
        expect(screen.getByText('Hydraulic hose weeping.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Done' }))
        expect(onChanged).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('asks before removing everything on a tab', async () => {
        const { onRemove } = setup()
        fireEvent.click(screen.getByRole('button', { name: 'Review' }))
        fireEvent.click(screen.getByRole('button', { name: 'Remove all 2' }))
        expect(screen.getByText('Remove all 2 old comments?')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Remove all' }))
        await waitFor(() => expect(onRemove).toHaveBeenCalledTimes(2))
        expect(await screen.findByText('No old comments left')).toBeInTheDocument()
    })
})
