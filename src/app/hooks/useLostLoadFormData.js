import { useEffect, useMemo, useState } from 'react'

import { MixerService } from '../../services/MixerService'
import { OperatorService } from '../../services/OperatorService'
import { UserService } from '../../services/UserService'

/**
 * Fetches mixers / operators for the lost load modal and exposes the derived
 * lookups (operator map, selected mixer + operator, regional truck options).
 * Also auto-populates the plant from the user when in create mode.
 */
export function useLostLoadFormData({ user, plants, isEditing, truckNumber, truckSearch, setPlant }) {
    const [mixers, setMixers] = useState([])
    const [operators, setOperators] = useState([])

    useEffect(() => {
        if (!user?.id || isEditing) return
        UserService.getUserPlant(user.id)
            .then((code) => {
                if (code) setPlant(code)
            })
            .catch((e) => console.error('Failed to fetch user plant:', e))
    }, [user?.id, isEditing, setPlant])

    useEffect(() => {
        MixerService.getAllMixers()
            .then(setMixers)
            .catch((e) => console.error('Failed to fetch mixers for lost load modal:', e))
    }, [])

    useEffect(() => {
        if (!plants?.length) return
        Promise.all(plants.map((p) => OperatorService.fetchOperatorsByPlant(p.plant_code)))
            .then((results) => setOperators(results.flat()))
            .catch((e) => console.error('Failed to fetch operators by plant:', e))
    }, [plants])

    const operatorMap = useMemo(() => {
        const map = {}
        operators.forEach((op) => {
            map[op.employeeId] = op.name
        })
        return map
    }, [operators])

    const selectedMixer = useMemo(() => {
        const target = truckNumber.trim().toLowerCase()
        if (!target) return null
        return (
            mixers.find(
                (m) =>
                    String(m.truckNumber || '')
                        .trim()
                        .toLowerCase() === target
            ) || null
        )
    }, [mixers, truckNumber])

    const selectedOperatorId = selectedMixer?.assignedOperator || null
    const selectedOperatorName = selectedOperatorId ? operatorMap[selectedOperatorId] || '' : ''

    const regionalMixers = useMemo(() => {
        const plantCodes = new Set((plants || []).map((p) => String(p.plant_code).toUpperCase()))
        let filtered = mixers.filter(
            (m) => plantCodes.has(String(m.assignedPlant).toUpperCase()) && String(m.status).toLowerCase() !== 'retired'
        )
        if (truckSearch.trim()) {
            const q = truckSearch.toLowerCase()
            filtered = filtered.filter((m) => {
                const num = String(m.truckNumber || '').toLowerCase()
                const opName = (operatorMap[m.assignedOperator] || '').toLowerCase()
                const plantCode = String(m.assignedPlant || '').toLowerCase()
                return num.includes(q) || opName.includes(q) || plantCode.includes(q)
            })
        }
        return filtered.sort((a, b) => {
            const aHasOp = operatorMap[a.assignedOperator] ? 0 : 1
            const bHasOp = operatorMap[b.assignedOperator] ? 0 : 1
            if (aHasOp !== bHasOp) return aHasOp - bHasOp
            return String(a.truckNumber).localeCompare(String(b.truckNumber), undefined, { numeric: true })
        })
    }, [mixers, plants, operatorMap, truckSearch])

    return { operatorMap, regionalMixers, selectedOperatorId, selectedOperatorName }
}
