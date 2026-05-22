import { describe, expect, it } from 'vitest'

import {
    ACI_EXPOSURE_CLASSES,
    ACI_SLUMP_RANGES,
    applyWasteFactor,
    cubicFeetToYards,
    footingVolume,
    maxWaterCementRatio,
    minimumCuringDays,
    nurseSaulMaturity,
    rectangularColumnVolume,
    requiredAirContentPercent,
    requiredAverageStrength,
    roundColumnVolume,
    slabVolume,
    strengthDevModificationFactor
} from '../CalculatorMath'

/* ──────────────────────────────────────────────────────────────────
 * Required average strength f'cr — ACI 318-19 §26.4.3.1
 * ──────────────────────────────────────────────────────────────── */

describe('requiredAverageStrength (ACI 318-19 §26.4.3)', () => {
    it("returns null for non-finite or non-positive f'c", () => {
        expect(requiredAverageStrength(0)).toBeNull()
        expect(requiredAverageStrength(-1000)).toBeNull()
        expect(requiredAverageStrength(NaN)).toBeNull()
    })

    /* ── Table 26.4.3.2.1 — sample size insufficient / s unknown ── */
    it('uses Table 26.4.3.2.1 when standard deviation is unknown', () => {
        expect(requiredAverageStrength(2500).fcr).toBe(3500) // f'c + 1000
        expect(requiredAverageStrength(3000).fcr).toBe(4200) // f'c + 1200
        expect(requiredAverageStrength(4000).fcr).toBe(5200)
        expect(requiredAverageStrength(5000).fcr).toBe(6200)
        // f'c > 5000 uses the 1.10·f'c + 700 rule.
        expect(requiredAverageStrength(6000).fcr).toBe(Math.round(1.1 * 6000 + 700))
        expect(requiredAverageStrength(8000).fcr).toBe(Math.round(1.1 * 8000 + 700))
    })

    it('flags the unknown-deviation branch with method:"estimated"', () => {
        expect(requiredAverageStrength(4000).method).toBe('estimated')
        expect(requiredAverageStrength(4000).sUsed).toBeNull()
    })

    /* ── Equation set 1: f'c ≤ 5000 ── */
    it('picks the controlling formula at and below 5000 psi', () => {
        // ACI 318-19 §26.4.3.1.1(a) — f'c ≤ 5000:
        //   f'cr = max(f'c + 1.34s, f'c + 2.33s − 500)
        // At s = 400, sampleCount ≥ 30 (k=1):
        //   a = 4000 + 1.34·400 = 4536
        //   b = 4000 + 2.33·400 − 500 = 4432
        // a > b → f'cr = 4536.
        const out = requiredAverageStrength(4000, 400, 30)
        expect(out.fcr).toBe(4536)
        expect(out.method).toBe('known-deviation')
        expect(out.sUsed).toBe(400)
    })

    it('switches to the b-formula when s is large enough to make 2.33s − 500 govern', () => {
        // s = 800, f'c = 4000:
        //   a = 4000 + 1.34·800 = 5072
        //   b = 4000 + 2.33·800 − 500 = 5364
        // b > a.
        const out = requiredAverageStrength(4000, 800, 30)
        expect(out.fcr).toBe(5364)
    })

    /* ── Equation set 2: f'c > 5000 ── */
    it('uses the high-strength branch above 5000 psi', () => {
        // f'c = 7000, s = 500, k = 1:
        //   a = 7000 + 1.34·500 = 7670
        //   b = 0.90·7000 + 2.33·500 = 6300 + 1165 = 7465
        // a > b → 7670.
        const out = requiredAverageStrength(7000, 500, 30)
        expect(out.fcr).toBe(7670)
    })

    /* ── Sample size correction (Table 26.4.3.1.1) ── */
    it('inflates s by the sample-count modifier when 15 ≤ n < 30', () => {
        // At 15 tests: k = 1.16 → effective s = 400 · 1.16 = 464.
        // a = 4000 + 1.34·464 = 4621.76 → 4622
        // b = 4000 + 2.33·464 − 500 = 4581.12 → 4581
        const out = requiredAverageStrength(4000, 400, 15)
        expect(out.fcr).toBe(4622)
        expect(out.sUsed).toBeCloseTo(464, 5)
    })

    it('falls back to the estimated branch when sampleCount < 15', () => {
        // s is given but the test count is too low → treat as unknown.
        const out = requiredAverageStrength(4000, 400, 12)
        expect(out.method).toBe('estimated')
        expect(out.fcr).toBe(5200) // f'c + 1200
    })

    it('exposes a formula string suitable for display', () => {
        const out = requiredAverageStrength(4000, 800, 30)
        expect(out.formula).toMatch(/f'cr/)
        expect(out.formula).toMatch(/5364|2\.33/)
    })
})

describe('strengthDevModificationFactor (Table 26.4.3.1.1)', () => {
    it('returns null when fewer than 15 tests', () => {
        expect(strengthDevModificationFactor(0)).toBeNull()
        expect(strengthDevModificationFactor(14)).toBeNull()
    })
    it('matches anchor values exactly', () => {
        expect(strengthDevModificationFactor(15)).toBeCloseTo(1.16, 5)
        expect(strengthDevModificationFactor(20)).toBeCloseTo(1.08, 5)
        expect(strengthDevModificationFactor(25)).toBeCloseTo(1.03, 5)
        expect(strengthDevModificationFactor(30)).toBe(1.0)
    })
    it('linearly interpolates between anchors', () => {
        // Halfway between 15 (1.16) and 20 (1.08) → 1.12.
        expect(strengthDevModificationFactor(17.5)).toBeCloseTo(1.12, 5)
    })
    it('clamps to 1.0 for ≥ 30 samples', () => {
        expect(strengthDevModificationFactor(50)).toBe(1.0)
        expect(strengthDevModificationFactor(1000)).toBe(1.0)
    })
})

/* ──────────────────────────────────────────────────────────────────
 * Volume math
 * ──────────────────────────────────────────────────────────────── */

describe('volume calculations', () => {
    it('slab volume returns yd³ from ft × ft × ft', () => {
        // 27 ft³ = 1 yd³ exactly.
        expect(slabVolume({ lengthFt: 3, thicknessFt: 3, widthFt: 3 })).toBe(1)
    })
    it('slab volume handles a 10x10x6" slab', () => {
        // 6" = 0.5 ft → 10·10·0.5 = 50 ft³ → 1.852 yd³.
        const yards = slabVolume({ lengthFt: 10, thicknessFt: 0.5, widthFt: 10 })
        expect(yards).toBeCloseTo(50 / 27, 5)
    })
    it('returns null on bad inputs', () => {
        expect(slabVolume({ lengthFt: 0, thicknessFt: 1, widthFt: 1 })).toBeNull()
        expect(slabVolume({ lengthFt: 10, thicknessFt: NaN, widthFt: 10 })).toBeNull()
    })
    it('round column matches π·r²·h within float precision', () => {
        // d = 2 ft → r = 1; h = 10 → π·10 = 31.4159… ft³ → /27 yd³.
        const yards = roundColumnVolume({ diameterFt: 2, heightFt: 10 })
        expect(yards).toBeCloseTo((Math.PI * 1 * 1 * 10) / 27, 5)
    })
    it('rectangular column delegates to slab math', () => {
        expect(rectangularColumnVolume({ depthFt: 3, heightFt: 3, widthFt: 3 })).toBe(1)
    })
    it('footing delegates to slab math', () => {
        expect(footingVolume({ depthFt: 3, lengthFt: 3, widthFt: 3 })).toBe(1)
    })
    it('cubicFeetToYards is exact for 27 ft³', () => {
        expect(cubicFeetToYards(27)).toBe(1)
    })
    it('applyWasteFactor multiplies and ignores < 1 factors', () => {
        expect(applyWasteFactor(10, 1.1)).toBeCloseTo(11, 5)
        expect(applyWasteFactor(10, 0.5)).toBe(10) // refuses to shrink
        expect(applyWasteFactor(10, NaN)).toBe(10)
    })
})

/* ──────────────────────────────────────────────────────────────────
 * Exposure / mix-design lookups
 * ──────────────────────────────────────────────────────────────── */

describe('requiredAirContentPercent (ACI 318-19 Table 19.3.3.1)', () => {
    it('returns null for F0 (no freeze-thaw exposure)', () => {
        expect(requiredAirContentPercent(0.75, 'F0')).toBeNull()
    })
    it('returns the severe-exposure table value for F2 / F3', () => {
        expect(requiredAirContentPercent(0.375, 'F2')).toBe(7.5)
        expect(requiredAirContentPercent(0.75, 'F3')).toBe(6.0)
        expect(requiredAirContentPercent(1.0, 'F3')).toBe(6.0)
        expect(requiredAirContentPercent(1.5, 'F3')).toBe(5.5)
        expect(requiredAirContentPercent(2.0, 'F2')).toBe(5.0)
        expect(requiredAirContentPercent(3.0, 'F2')).toBe(4.5)
    })
    it('subtracts 1 % for moderate (F1) exposure', () => {
        expect(requiredAirContentPercent(0.75, 'F1')).toBeCloseTo(5.0, 5)
        expect(requiredAirContentPercent(0.375, 'F1')).toBeCloseTo(6.5, 5)
    })
    it('returns null for an aggregate size not in the table', () => {
        expect(requiredAirContentPercent(0.625, 'F2')).toBeNull()
        expect(requiredAirContentPercent(5.0, 'F2')).toBeNull()
    })
})

describe('maxWaterCementRatio (ACI 318-19 Table 19.3.2.1)', () => {
    it('returns null when none of the classes impose a limit', () => {
        expect(maxWaterCementRatio(['F0', 'S0', 'W0', 'C0'])).toBeNull()
    })
    it('selects the most restrictive limit across multiple classes', () => {
        // F1 (0.55) + C2 (0.40) → governing is C2 = 0.40.
        expect(maxWaterCementRatio(['F1', 'C2'])).toBe(0.4)
        // F3 (0.40) + S1 (0.50) → governing is F3 = 0.40.
        expect(maxWaterCementRatio(['F3', 'S1'])).toBe(0.4)
    })
    it('returns the single class limit when only one applies', () => {
        expect(maxWaterCementRatio(['F2'])).toBe(0.45)
        expect(maxWaterCementRatio(['S2'])).toBe(0.45)
        expect(maxWaterCementRatio(['W2'])).toBe(0.5)
    })
    it('handles empty / invalid input', () => {
        expect(maxWaterCementRatio([])).toBeNull()
        expect(maxWaterCementRatio(null)).toBeNull()
    })
})

/* ──────────────────────────────────────────────────────────────────
 * Curing duration
 * ──────────────────────────────────────────────────────────────── */

describe('minimumCuringDays (ACI 308.1)', () => {
    it('defaults to 7 days for normal cement at warm temps', () => {
        expect(minimumCuringDays({ averageTempF: 70, mixType: 'normal' })).toBe(7)
    })
    it('drops to 3 days for high-early-strength mixes', () => {
        expect(minimumCuringDays({ averageTempF: 70, mixType: 'high-early' })).toBe(3)
    })
    it('extends to 14 days for pozzolan-heavy mixes', () => {
        expect(minimumCuringDays({ averageTempF: 70, mixType: 'pozzolan' })).toBe(14)
    })
    it('adds days for cold-weather curing (< 50 °F)', () => {
        // 40 °F → 1 day extra (ceil((50-40)/10) = 1).
        expect(minimumCuringDays({ averageTempF: 40, mixType: 'normal' })).toBe(8)
        // 30 °F → 2 days extra.
        expect(minimumCuringDays({ averageTempF: 30, mixType: 'normal' })).toBe(9)
    })
    it('adds 3 days for severe exposure', () => {
        expect(minimumCuringDays({ exposureSevere: true, mixType: 'normal' })).toBe(10)
    })
    it('stacks cold-weather + severe-exposure adjustments', () => {
        expect(minimumCuringDays({ averageTempF: 40, exposureSevere: true, mixType: 'normal' })).toBe(11)
    })
})

/* ──────────────────────────────────────────────────────────────────
 * Maturity (Nurse-Saul) — ASTM C1074 §8
 * ──────────────────────────────────────────────────────────────── */

describe('nurseSaulMaturity', () => {
    it('returns 0 (or null on empty) for trivial inputs', () => {
        expect(nurseSaulMaturity([])).toBeNull()
        // All sub-datum segments contribute 0.
        expect(nurseSaulMaturity([{ hours: 24, tempF: 32 }])).toBe(0)
    })
    it('matches the Σ(T−T₀)·Δt definition with a 0 °C datum', () => {
        // 24h at 50°F → 10°C above datum → 240 °C·h.
        expect(nurseSaulMaturity([{ hours: 24, tempF: 50 }])).toBeCloseTo(240, 5)
        // 24h at 68°F → 20°C above datum → 480 °C·h.
        expect(nurseSaulMaturity([{ hours: 24, tempF: 68 }])).toBeCloseTo(480, 5)
    })
    it('accumulates multiple segments', () => {
        const total = nurseSaulMaturity([
            { hours: 12, tempF: 50 }, // 10°C × 12 = 120
            { hours: 12, tempF: 68 } // 20°C × 12 = 240
        ])
        expect(total).toBeCloseTo(360, 5)
    })
    it('skips segments with non-finite or zero hours', () => {
        const total = nurseSaulMaturity([
            { hours: 24, tempF: 68 },
            { hours: 0, tempF: 80 },
            { hours: NaN, tempF: 80 }
        ])
        expect(total).toBeCloseTo(480, 5)
    })
})

/* ──────────────────────────────────────────────────────────────────
 * Reference tables (sanity checks so consumers can rely on shape)
 * ──────────────────────────────────────────────────────────────── */

describe('reference tables', () => {
    it('exposure-class catalog covers every ACI 318 group', () => {
        const groups = new Set(ACI_EXPOSURE_CLASSES.map((e) => e.group))
        expect(groups).toContain('Frost')
        expect(groups).toContain('Sulfate')
        expect(groups).toContain('Water')
        expect(groups).toContain('Chloride')
    })
    it('slump ranges sort cleanly low-to-high', () => {
        for (const row of ACI_SLUMP_RANGES) {
            expect(row.maxIn).toBeGreaterThanOrEqual(row.minIn)
        }
    })
})
