import { LOCALE_COMPARE_OPTIONS } from './ExportConstants'

/**
 * Plant code normalization + ordering helpers shared across export pipelines.
 * `normUpper` and `normNumeric` produce comparison keys for matching against
 * report payloads where plant codes may carry leading zeros or letter prefixes
 * (e.g. "404", "RMX_TX_404"). `sortPlants` orders plant arrays numerically
 * first, then alphabetically for non-numeric codes.
 */

/** A record that carries a plant code, whatever else it holds. */
interface PlantCodeRecord {
    plant_code?: string | null
}

export function normUpper(code: string | null | undefined): string {
    return String(code || '')
        .trim()
        .toUpperCase()
}

export function normNumeric(code: string | null | undefined): string {
    const trimmed = String(code || '').trim()
    const stripped = trimmed.replace(/^0+/, '')
    return stripped.length ? stripped : trimmed.toUpperCase()
}

export function numericPlantComparator(plantCodeA: string, plantCodeB: string): number {
    const numA = parseInt(plantCodeA.replace(/\D/g, ''), 10)
    const numB = parseInt(plantCodeB.replace(/\D/g, ''), 10)
    const isNumA = Number.isFinite(numA)
    const isNumB = Number.isFinite(numB)
    if (isNumA && isNumB && numA !== numB) return numA - numB
    if (isNumA && !isNumB) return -1
    if (!isNumA && isNumB) return 1
    return plantCodeA.localeCompare(plantCodeB, undefined, LOCALE_COMPARE_OPTIONS)
}

export function sortPlants<T extends PlantCodeRecord>(plants: readonly T[]): T[] {
    return [...plants].sort((a, b) =>
        numericPlantComparator(String(a.plant_code || '').trim(), String(b.plant_code || '').trim())
    )
}
