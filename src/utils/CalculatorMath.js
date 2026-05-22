/* Concrete-industry calculator math.
 *
 * Every formula in this file is sourced from a specific ACI publication
 * so the calculators can be traced back to a normative reference. The
 * primary documents:
 *
 *   • ACI 318-19  — "Building Code Requirements for Structural Concrete"
 *   • ACI 211.1   — "Standard Practice for Selecting Proportions for
 *                    Normal, Heavyweight, and Mass Concrete"
 *   • ACI 308.1   — "Specification for Curing Concrete"
 *   • ASTM C1074  — "Standard Practice for Estimating Concrete Strength
 *                    by the Maturity Method" (referenced by ACI 306R)
 *
 * Helpers are pure — no I/O, no React — so they can be unit-tested
 * directly. Each export carries an `// REF:` comment pointing back to
 * the section it implements.
 */

/* ─── Units / constants ─────────────────────────────────────────── */

/** Standard weight of water at 60 °F (15.6 °C). */
export const WATER_LBS_PER_GALLON = 8.34
/** Approximate weight of one cubic yard of normal-weight concrete. */
export const POUNDS_PER_CUBIC_YARD = 3915 // ACI 211.1 typical: ~145 pcf × 27 ft³/yd³
/** Cubic feet in a cubic yard. */
export const CUBIC_FEET_PER_CUBIC_YARD = 27
/** Convergence tolerance for iterative balancers. */
export const RATIO_CONVERGENCE_TOLERANCE = 0.001
/** Additions below this threshold (in lbs) are treated as negligible. */
export const NEGLIGIBLE_ADDITION_THRESHOLD = 0.5

/* ─── Required average compressive strength (f'cr) ───────────────
 * REF: ACI 318-19 §26.4.3.1 — over-design above specified f'c so
 * the actual mix meets the strength requirement with high
 * statistical confidence (no more than 1 in 100 sub-strength tests). */

/** Sample-size correction factor on the standard deviation s.
 *  REF: ACI 318-19 Table 26.4.3.1.1 — linear interpolation between
 *  the listed sample counts; ≥30 tests → 1.00, fewer tests inflate s. */
export function strengthDevModificationFactor(sampleCount) {
    if (!Number.isFinite(sampleCount) || sampleCount < 15) return null
    if (sampleCount >= 30) return 1.0
    const anchors = [
        [15, 1.16],
        [20, 1.08],
        [25, 1.03],
        [30, 1.0]
    ]
    for (let i = 0; i < anchors.length - 1; i++) {
        const [n1, f1] = anchors[i]
        const [n2, f2] = anchors[i + 1]
        if (sampleCount >= n1 && sampleCount <= n2) {
            const t = (sampleCount - n1) / (n2 - n1)
            return f1 + t * (f2 - f1)
        }
    }
    return 1.0
}

/**
 * Required average compressive strength f'cr (psi).
 *
 * REF: ACI 318-19 §26.4.3.1 + Table 26.4.3.2.1.
 *
 *   • When standard deviation s is established (≥15 tests):
 *       - f'c ≤ 5000 psi:  f'cr = max(f'c + 1.34·s, f'c + 2.33·s − 500)
 *       - f'c >  5000 psi: f'cr = max(f'c + 1.34·s, 0.90·f'c + 2.33·s)
 *   • When s is unknown (or <15 tests): use the table:
 *       - f'c <  3000:  f'cr = f'c + 1000
 *       - 3000-5000:    f'cr = f'c + 1200
 *       - f'c >  5000:  f'cr = 1.10·f'c + 700
 *
 * @param {number} fc             Specified compressive strength, psi
 * @param {number} [stdDev]       Standard deviation of strength tests, psi.
 *                                Pass null/undefined when s isn't established.
 * @param {number} [sampleCount]  Number of strength tests behind stdDev. Used
 *                                only to apply the §Table 26.4.3.1.1 modifier.
 * @returns {{
 *   fcr: number,
 *   method: 'known-deviation' | 'estimated',
 *   sUsed: number | null,
 *   formula: string
 * } | null}
 */
export function requiredAverageStrength(fc, stdDev, sampleCount) {
    if (!Number.isFinite(fc) || fc <= 0) return null
    const hasDev = Number.isFinite(stdDev) && stdDev > 0 && Number.isFinite(sampleCount) && sampleCount >= 15
    if (hasDev) {
        const k = strengthDevModificationFactor(sampleCount) ?? 1.0
        const sUsed = stdDev * k
        let fcr
        let formula
        if (fc <= 5000) {
            const a = fc + 1.34 * sUsed
            const b = fc + 2.33 * sUsed - 500
            fcr = Math.max(a, b)
            formula =
                a >= b
                    ? `f'cr = f'c + 1.34·s = ${fc} + 1.34·${sUsed.toFixed(0)} = ${a.toFixed(0)}`
                    : `f'cr = f'c + 2.33·s − 500 = ${fc} + 2.33·${sUsed.toFixed(0)} − 500 = ${b.toFixed(0)}`
        } else {
            const a = fc + 1.34 * sUsed
            const b = 0.9 * fc + 2.33 * sUsed
            fcr = Math.max(a, b)
            formula =
                a >= b
                    ? `f'cr = f'c + 1.34·s = ${fc} + 1.34·${sUsed.toFixed(0)} = ${a.toFixed(0)}`
                    : `f'cr = 0.90·f'c + 2.33·s = ${(0.9 * fc).toFixed(0)} + 2.33·${sUsed.toFixed(0)} = ${b.toFixed(0)}`
        }
        return { fcr: Math.round(fcr), formula, method: 'known-deviation', sUsed }
    }
    let fcr
    let formula
    if (fc < 3000) {
        fcr = fc + 1000
        formula = `f'cr = f'c + 1000 = ${fc} + 1000 = ${fcr}`
    } else if (fc <= 5000) {
        fcr = fc + 1200
        formula = `f'cr = f'c + 1200 = ${fc} + 1200 = ${fcr}`
    } else {
        fcr = 1.1 * fc + 700
        formula = `f'cr = 1.10·f'c + 700 = ${(1.1 * fc).toFixed(0)} + 700 = ${fcr.toFixed(0)}`
    }
    return { fcr: Math.round(fcr), formula, method: 'estimated', sUsed: null }
}

/* ─── Volume calculations ────────────────────────────────────────
 * Plain geometry, but the calculator surface still needs a consistent
 * waste-factor + units convention so all shapes report yd³. */

/** Convert any ft³ value to yd³. */
export const cubicFeetToYards = (cubicFeet) => cubicFeet / CUBIC_FEET_PER_CUBIC_YARD

/** Volume of a rectangular slab: length × width × thickness.
 *  Inputs in feet (thickness commonly passed as inches — convert before
 *  calling). Returns cubic yards. */
export function slabVolume({ lengthFt, widthFt, thicknessFt }) {
    const args = [lengthFt, widthFt, thicknessFt]
    if (args.some((v) => !Number.isFinite(v) || v <= 0)) return null
    return cubicFeetToYards(lengthFt * widthFt * thicknessFt)
}

/** Volume of a rectangular footing: length × width × depth. */
export function footingVolume({ lengthFt, widthFt, depthFt }) {
    return slabVolume({ lengthFt, thicknessFt: depthFt, widthFt })
}

/** Rectangular column volume: width × depth × height. */
export function rectangularColumnVolume({ widthFt, depthFt, heightFt }) {
    return slabVolume({ lengthFt: heightFt, thicknessFt: depthFt, widthFt })
}

/** Round column volume: π · r² · h. Diameter in feet. */
export function roundColumnVolume({ diameterFt, heightFt }) {
    if (!Number.isFinite(diameterFt) || diameterFt <= 0) return null
    if (!Number.isFinite(heightFt) || heightFt <= 0) return null
    const radius = diameterFt / 2
    return cubicFeetToYards(Math.PI * radius * radius * heightFt)
}

/** Apply a waste / over-order factor (e.g. 1.10 = 10% extra). */
export function applyWasteFactor(yards, wasteFactor) {
    if (!Number.isFinite(yards) || yards < 0) return null
    if (!Number.isFinite(wasteFactor) || wasteFactor < 1) return yards
    return yards * wasteFactor
}

/* ─── Air content (ACI 318-19 Table 19.3.3.1) ────────────────────
 * Total air content for concrete exposed to freezing-and-thawing. The
 * table is keyed by nominal max aggregate size + severity of exposure
 * (F1 moderate, F2/F3 severe / very severe). */

/** Aggregate size in inches → severe-exposure (F2 / F3) total air content. */
const AIR_TABLE_SEVERE_PERCENT = [
    { aggInches: 0.375, percent: 7.5 },
    { aggInches: 0.5, percent: 7.0 },
    { aggInches: 0.75, percent: 6.0 },
    { aggInches: 1.0, percent: 6.0 },
    { aggInches: 1.5, percent: 5.5 },
    { aggInches: 2.0, percent: 5.0 },
    { aggInches: 3.0, percent: 4.5 }
]

/**
 * Required total air content (%) for a frost-resistant mix.
 *
 * REF: ACI 318-19 Table 19.3.3.1.
 *
 *   • F0 — no exposure → not required (returns null).
 *   • F1 — moderate exposure → table value − 1 % (per the table note).
 *   • F2 / F3 — severe / very severe → exact table value.
 *
 * @param {number} aggInches  Nominal max aggregate size in inches
 * @param {'F0'|'F1'|'F2'|'F3'} exposureClass
 */
export function requiredAirContentPercent(aggInches, exposureClass) {
    if (exposureClass === 'F0' || !exposureClass) return null
    const row = AIR_TABLE_SEVERE_PERCENT.find((r) => Math.abs(r.aggInches - aggInches) < 0.05)
    if (!row) return null
    if (exposureClass === 'F1') return Math.max(0, row.percent - 1)
    return row.percent
}

/* ─── Max water-cementitious ratio (ACI 318-19 Table 19.3.2.1) ─── */

/** Maximum w/cm by exposure class.  `null` = no limit imposed. */
const MAX_WCM_BY_EXPOSURE = {
    C0: null,
    C1: null,
    C2: 0.4,
    F0: null,
    F1: 0.55,
    F2: 0.45,
    F3: 0.4,
    S0: null,
    S1: 0.5,
    S2: 0.45,
    S3: 0.45,
    W0: null,
    W1: null,
    W2: 0.5
}

/**
 * Maximum allowable w/cm ratio across a set of exposure classes — the
 * governing limit is the smallest of the per-class maxima.
 *
 * REF: ACI 318-19 §19.3.2 + Table 19.3.2.1.
 */
export function maxWaterCementRatio(exposureClasses) {
    if (!Array.isArray(exposureClasses) || exposureClasses.length === 0) return null
    const limits = exposureClasses.map((c) => MAX_WCM_BY_EXPOSURE[c]).filter((v) => Number.isFinite(v))
    if (limits.length === 0) return null
    return Math.min(...limits)
}

/* ─── Curing duration (ACI 308.1) ────────────────────────────────
 * §6.3.4 Curing duration — the minimum period the concrete must be
 * maintained at ≥50 °F (10 °C) and kept moist for the strength /
 * durability spec to hold. */

const CURING_BASE_DAYS = {
    'high-early': 3, // Type III (or any mix with HE accelerator)
    normal: 7, // Type I/II/V w/ no accelerator
    pozzolan: 14 // Mass concrete or mixes with fly ash / slag > 20 %
}

/** Minimum curing days, with adjustments for cold weather and durability. */
export function minimumCuringDays({ mixType = 'normal', exposureSevere = false, averageTempF = 70 } = {}) {
    let days = CURING_BASE_DAYS[mixType] ?? CURING_BASE_DAYS.normal
    // Cold weather extension (ACI 306) — below 50°F the curing window
    // must stretch because hydration slows. Rough rule: add a day for
    // every 10°F below 50.
    if (Number.isFinite(averageTempF) && averageTempF < 50) {
        const extra = Math.ceil((50 - averageTempF) / 10)
        days += extra
    }
    // Severe exposure (F2/F3 freeze-thaw, marine, chloride) — extend by
    // 3 days per ACI 308.1 §6.3.4.2 commentary.
    if (exposureSevere) days += 3
    return days
}

/* ─── Maturity (Nurse-Saul, ASTM C1074) ─────────────────────────
 * Maturity index M = Σ(T − T₀) · Δt where T₀ is the datum (typically
 * 0 °C / 32 °F for OPC mixes). Inputs come in as °F so we shift to °C
 * for the standard datum. */

const DEFAULT_DATUM_C = 0
const F_TO_C = (f) => ((f - 32) * 5) / 9

/**
 * Nurse-Saul temperature-time factor (°C·hours).
 *
 * REF: ASTM C1074 §8 (referenced by ACI 306R-16 ch. 8).
 *
 * @param {Array<{tempF: number, hours: number}>} segments
 * @param {number} [datumC=0]  Datum temperature in °C (typical 0 for OPC)
 */
export function nurseSaulMaturity(segments, datumC = DEFAULT_DATUM_C) {
    if (!Array.isArray(segments) || segments.length === 0) return null
    let total = 0
    for (const { hours, tempF } of segments) {
        if (!Number.isFinite(tempF) || !Number.isFinite(hours) || hours <= 0) continue
        const tempC = F_TO_C(tempF)
        const above = tempC - datumC
        if (above > 0) total += above * hours
    }
    return total
}

/* ─── ACI 211.1 reference tables (read-only constants) ───────── */

/** Suggested slump ranges (in.) — REF: ACI 211.1 Table 6.3.1. */
export const ACI_SLUMP_RANGES = [
    { application: 'Reinforced foundation walls / footings', maxIn: 3, minIn: 1 },
    { application: 'Plain footings / caissons / substructure walls', maxIn: 3, minIn: 1 },
    { application: 'Beams / reinforced walls', maxIn: 4, minIn: 1 },
    { application: 'Building columns', maxIn: 4, minIn: 1 },
    { application: 'Pavements / slabs', maxIn: 3, minIn: 1 },
    { application: 'Mass concrete', maxIn: 3, minIn: 1 }
]

/** Exposure-class catalog for the UI dropdowns + tooltips.
 *  REF: ACI 318-19 §19.3. */
export const ACI_EXPOSURE_CLASSES = [
    { code: 'F0', description: 'Concrete not exposed to freezing-and-thawing cycles', group: 'Frost' },
    {
        code: 'F1',
        description: 'Concrete exposed to freezing-and-thawing cycles with limited exposure to water',
        group: 'Frost'
    },
    {
        code: 'F2',
        description: 'Concrete exposed to freezing-and-thawing cycles with frequent exposure to water',
        group: 'Frost'
    },
    {
        code: 'F3',
        description: 'Concrete exposed to freezing-and-thawing cycles plus exposure to deicing chemicals',
        group: 'Frost'
    },
    { code: 'S0', description: 'No exposure to sulfates in soil or water', group: 'Sulfate' },
    {
        code: 'S1',
        description: 'Moderate sulfate exposure (SO₄ 0.10–0.20 % in soil / 150–1500 ppm in water)',
        group: 'Sulfate'
    },
    {
        code: 'S2',
        description: 'Severe sulfate exposure (SO₄ 0.20–2.00 % in soil / 1500–10000 ppm in water)',
        group: 'Sulfate'
    },
    {
        code: 'S3',
        description: 'Very severe sulfate exposure (SO₄ > 2.00 % in soil / > 10000 ppm in water)',
        group: 'Sulfate'
    },
    { code: 'W0', description: 'Dry in service', group: 'Water' },
    { code: 'W1', description: 'In contact with water — no req. low permeability', group: 'Water' },
    { code: 'W2', description: 'In contact with water — req. low permeability', group: 'Water' },
    { code: 'C0', description: 'Dry / protected from moisture — no chloride concern', group: 'Chloride' },
    { code: 'C1', description: 'Moist but no external chloride exposure', group: 'Chloride' },
    { code: 'C2', description: 'Exposed to chlorides (deicing salts, salt water, brackish water)', group: 'Chloride' }
]
