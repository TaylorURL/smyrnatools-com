import { ensure } from '../../../../../../utils/ExportUtility'

/** Flattens the RMI snapshot into combined trainer/pending/training arrays
 *  tagged with `{ type: 'Mixer' | 'Tractor' }`. Returns hiring goals + the
 *  total number of hires needed across all plants. */
export function buildRmiSummary(rmiData, form, sortedPlants) {
    const snapshot = rmiData?.snapshot_data || {}
    const hiringGoals = rmiData?.hiring_goals || {}
    const tagAs = (type) => (entry) => ({ ...entry, type })

    const allTrainers = [
        ...(snapshot.mixer_trainers || []).map(tagAs('Mixer')),
        ...(snapshot.tractor_trainers || []).map(tagAs('Tractor'))
    ]
    const allPending = [
        ...(snapshot.mixer_pending || []).map(tagAs('Mixer')),
        ...(snapshot.tractor_pending || []).map(tagAs('Tractor'))
    ]
    const allTraining = [
        ...(snapshot.mixer_training || []).map(tagAs('Mixer')),
        ...(snapshot.tractor_training || []).map(tagAs('Tractor'))
    ]

    let totalHiringNeeded = 0
    sortedPlants.forEach((p) => {
        const goal = Number(hiringGoals[p.plant_code]) || 0
        const currentOps = ensure(form[`active_operators_${p.plant_code}`], true)
        const needed = goal - currentOps
        if (needed > 0) totalHiringNeeded += needed
    })

    return { allPending, allTrainers, allTraining, hiringGoals, totalHiringNeeded }
}
