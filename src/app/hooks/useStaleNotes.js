import { useCallback, useEffect, useMemo, useState } from 'react'

import { Database } from '../../services/DatabaseService'
import { EquipmentService } from '../../services/EquipmentService'
import { MixerService } from '../../services/MixerService'
import { OperatorService } from '../../services/OperatorService'
import { PickupTruckService } from '../../services/PickupTruckService'
import { getSessionUserId } from '../../services/SessionService'
import { TractorService } from '../../services/TractorService'
import { TrailerService } from '../../services/TrailerService'
import { UserService } from '../../services/UserService'
import { isPlantManagerRole, staleNoteCutoff } from '../../utils/StaleNoteUtility'
import { STALE_NOTES_ASKED_KEY, STALE_NOTES_KEPT_KEY } from '../constants/dashboardConstants'

/** Kept ids are capped so the list can't grow without bound on one device. */
const KEPT_LIMIT = 1000

/**
 * Every place a comment or an issue lives. `ref` names the dashboard's list
 * for that kind of record; operators keep comments but no issues, and are
 * keyed by employee id rather than row id.
 */
const SOURCES = [
    {
        commentsTable: 'mixers_comments',
        fk: 'mixer_id',
        issuesTable: 'mixers_maintenance',
        label: (a) => a.truckNumber,
        ref: 'mixers',
        service: MixerService,
        type: 'Mixer'
    },
    {
        commentsTable: 'tractors_comments',
        fk: 'tractor_id',
        issuesTable: 'tractors_maintenance',
        label: (a) => a.truckNumber,
        ref: 'tractors',
        service: TractorService,
        type: 'Tractor'
    },
    {
        commentsTable: 'trailers_comments',
        fk: 'trailer_id',
        issuesTable: 'trailers_maintenance',
        label: (a) => a.identifyingNumber,
        ref: 'trailers',
        service: TrailerService,
        type: 'Trailer'
    },
    {
        commentsTable: 'heavy_equipment_comments',
        fk: 'equipment_id',
        issuesTable: 'heavy_equipment_maintenance',
        label: (a) => a.identifyingNumber,
        ref: 'equipment',
        service: EquipmentService,
        type: 'Equipment'
    },
    {
        commentsTable: 'pickup_trucks_comments',
        fk: 'truck_id',
        issuesTable: 'pickup_trucks_maintenance',
        label: (a) => a.assigned || a.vin,
        ref: 'pickups',
        service: PickupTruckService,
        type: 'Pickup Truck'
    },
    {
        commentsTable: 'operators_comments',
        fk: 'operator_id',
        idOf: (a) => a.employeeId,
        label: (a) => a.name,
        ref: 'operators',
        service: OperatorService,
        type: 'Operator'
    }
]

const readKept = (uid) => {
    try {
        const list = JSON.parse(localStorage.getItem(STALE_NOTES_KEPT_KEY + uid) || '[]')
        return new Set(Array.isArray(list) ? list : [])
    } catch {
        return new Set()
    }
}

const writeKept = (uid, kept) => {
    try {
        localStorage.setItem(STALE_NOTES_KEPT_KEY + uid, JSON.stringify([...kept].slice(-KEPT_LIMIT)))
    } catch {
        /* storage full or blocked: the note just comes back next visit */
    }
}

const wasAsked = (uid) => {
    try {
        return sessionStorage.getItem(STALE_NOTES_ASKED_KEY + uid) === '1'
    } catch {
        return false
    }
}

const markAsked = (uid) => {
    try {
        sessionStorage.setItem(STALE_NOTES_ASKED_KEY + uid, '1')
    } catch {
        /* blocked storage: the prompt may show again on reload */
    }
}

/** The old comments and open issues on one kind of record, for the records
 *  given. A failed query yields nothing rather than failing the rest. */
async function fetchSourceNotes(source, records, cutoff) {
    const idOf = source.idOf || ((a) => a.id)
    const byId = new Map(records.map((a) => [idOf(a), a]).filter(([id]) => id))
    const ids = [...byId.keys()]
    if (!ids.length) return []
    const [comments, issues] = await Promise.all([
        Database.from(source.commentsTable)
            .select(`id, ${source.fk}, text, author, created_at`)
            .in(source.fk, ids)
            .eq('permanent', false)
            .lt('created_at', cutoff),
        source.issuesTable
            ? Database.from(source.issuesTable)
                  .select(`id, ${source.fk}, issue, severity, created_by, time_created`)
                  .in(source.fk, ids)
                  .is('time_completed', null)
                  .eq('permanent', false)
                  .lt('time_created', cutoff)
            : Promise.resolve({ data: [] })
    ])
    const asset = (row) => {
        const record = byId.get(row[source.fk])
        return {
            assetLabel: source.label(record || {}) || '',
            assetType: source.type,
            plantCode: record?.plantCode || '',
            service: source.service
        }
    }
    return [
        ...(comments.error ? [] : comments.data || []).map((row) => ({
            ...asset(row),
            authorId: row.author,
            createdAt: row.created_at,
            id: row.id,
            key: `comment:${row.id}`,
            kind: 'comment',
            text: row.text
        })),
        ...(issues.error ? [] : issues.data || []).map((row) => ({
            ...asset(row),
            authorId: row.created_by,
            createdAt: row.time_created,
            id: row.id,
            key: `issue:${row.id}`,
            kind: 'issue',
            severity: row.severity,
            text: row.issue
        }))
    ]
}

/**
 * Old comments and open issues at a plant manager's own plants, for the
 * dashboard to offer once per visit. Nothing loads for anyone else, before the
 * dashboard's records are in, or after this visit has already asked.
 *
 * `remove` deletes a note for good, `keep` hides it from the prompt on this
 * device from now on, and `dismiss` stops asking until the next visit.
 */
export function useStaleNotes({ dataReady, plantCodes, recordRefs }) {
    const [notes, setNotes] = useState([])
    const [asked, setAsked] = useState(false)
    const uid = getSessionUserId() || ''
    const plantKey = useMemo(() => [...(plantCodes || [])].sort().join(','), [plantCodes])

    useEffect(() => {
        if (!dataReady || !plantKey || !uid || wasAsked(uid)) return
        let cancelled = false
        async function load() {
            const roles = await UserService.getUserRoles(uid).catch(() => [])
            if (cancelled || !roles.some((role) => isPlantManagerRole(role?.name))) return
            const plants = new Set(plantKey.split(','))
            const atMyPlants = (record) => plants.has(String(record?.plantCode || '').trim())
            const cutoff = staleNoteCutoff()
            const found = (
                await Promise.all(
                    SOURCES.map((source) =>
                        fetchSourceNotes(
                            source,
                            (recordRefs[source.ref]?.current || []).filter(atMyPlants),
                            cutoff
                        ).catch(() => [])
                    )
                )
            ).flat()
            const kept = readKept(uid)
            const fresh = found.filter((note) => !kept.has(note.key))
            if (cancelled || !fresh.length) return
            const authorIds = [...new Set(fresh.map((note) => note.authorId).filter(Boolean))]
            const names = Object.fromEntries(
                await Promise.all(
                    authorIds.map(async (id) => [id, await UserService.getUserDisplayName(id).catch(() => 'Unknown')])
                )
            )
            if (cancelled) return
            setNotes(
                fresh
                    .map((note) => ({ ...note, authorName: names[note.authorId] || 'Unknown' }))
                    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
            )
        }
        load()
        return () => {
            cancelled = true
        }
        // recordRefs is a fresh object each render; the refs inside it are stable.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataReady, plantKey, uid])

    const remove = useCallback(async (note) => {
        if (note.kind === 'issue') await note.service.deleteIssue(note.id)
        else await note.service.deleteComment(note.id)
        setNotes((list) => list.filter((n) => n.key !== note.key))
    }, [])

    const keep = useCallback(
        (note) => {
            const kept = readKept(uid)
            kept.add(note.key)
            writeKept(uid, kept)
            setNotes((list) => list.filter((n) => n.key !== note.key))
        },
        [uid]
    )

    const dismiss = useCallback(() => {
        markAsked(uid)
        setAsked(true)
    }, [uid])

    return { dismiss, keep, notes: asked ? [] : notes, remove }
}
