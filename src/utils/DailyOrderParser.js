/**
 * Parses a Daily Order Listing HTML export (FastReport output from the dispatch
 * system) into a production object keyed by DB plant_code.
 *
 * The HTML lays every order out on a fixed pixel grid. We locate per-plant
 * header rows, then for each `<a href="/orders/concrete/...">` link within a
 * plant section we read each field at its known (left, top) offset.
 */

/** A plant header is a single-entry `<code> - <n>` row anchored to end of line.
 *  The `[^,]+$` clause rejects the TOC row that comma-separates every plant. */
const PLANT_HEADER_RE = /^(\d{3,6})\s*-\s*(.+)$/

/** Loose name key used to match HTML plant names (e.g. "LONGHORN HOUSTON")
 *  against DB plant names (e.g. "Longhorn") when the numeric codes differ. */
const plantNameKey = (name) =>
    String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()

// Column map from the report's header row — top:268.8/288, see
// `<div class="s20" style="left:307.2...">Start Time</div>` etc.
const COLS = {
    description: 96,
    loadSize: 614.4,
    orderQty: 566.4,
    productCode: 0,
    productPrice: 508.8,
    rate: 249.6,
    startTime: 307.2,
    tktTime: 355.2,
    toJobTime: 403.2,
    toPlantTime: 451.2,
    truckCount: 662.4
}

// Header-block offsets, relative to the order-link's row top.
const HEAD_OFFSETS = {
    address: { left: 297.6, top: 19.2 },
    city: { left: 480, top: 19.2 },
    contact: { left: 432, top: 57.6 },
    customer: { left: 115.2, top: 0 },
    customerNum: { left: 57.6, top: 0 },
    details: { top: 86.4 },
    jobNumber: { left: 345.6, top: 57.6 },
    phone: { left: 124.8, top: 57.6 },
    poNumber: { left: 345.6, top: 38.4 },
    truckClass: { left: 662.4, top: 19.2 }
}

const parsePositionedDivs = (root) =>
    [...root.querySelectorAll('div')]
        .map((el) => {
            const style = el.getAttribute('style') || ''
            const leftMatch = style.match(/left:\s*([\d.]+)/)
            const topMatch = style.match(/top:\s*([\d.]+)/)
            return {
                el,
                left: leftMatch ? parseFloat(leftMatch[1]) : null,
                text: el.textContent.trim(),
                top: topMatch ? parseFloat(topMatch[1]) : null
            }
        })
        .filter((d) => d.left != null && d.top != null)

const findCellText = (positionedDivs, targetLeft, targetTop, leftTol = 6, topTol = 4) => {
    const match = positionedDivs.find(
        (d) => Math.abs(d.left - targetLeft) <= leftTol && Math.abs(d.top - targetTop) <= topTol && d.text.length > 0
    )
    return match?.text || ''
}

/**
 * Parses the Daily Order Listing HTML into a production object.
 *
 * @param {string} htmlString - Raw HTML from the dispatch report
 * @param {Array} plants - Known plant records from DB (for code/name mapping)
 * @returns {Object} production - { [plantCode]: { firstJobTime, lastJobTime, orders, totalYardage } }
 */
export function parseDailyOrderHtml(htmlString, plants = []) {
    if (!htmlString || typeof htmlString !== 'string') return {}

    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlString, 'text/html')
    const allDivs = [...doc.querySelectorAll('div')]

    const plantHeaders = allDivs.filter((d) => {
        const text = d.textContent.trim()
        const m = text.match(PLANT_HEADER_RE)
        if (!m) return false
        if (text.includes(',')) return false
        // The name portion must contain at least one letter. A plant name is
        // always text like "LONGHORN HOUSTON", never all-digits. Rows like
        // "4823 - 113579361" (customer number + order/job number) happen to
        // match the ‹code› - ‹text› header shape but aren't plants.
        if (!/[A-Za-z]/.test(m[2])) return false
        return true
    })

    // Deduplicate — multiple nested divs often share the same text content.
    const seenCodes = new Set()
    const uniqueHeaders = plantHeaders.filter((h) => {
        const code = h.textContent.trim().match(PLANT_HEADER_RE)?.[1]
        if (!code || seenCodes.has(code)) return false
        seenCodes.add(code)
        return true
    })

    // HTML plant codes (e.g. "14001") may not match the DB's plant_code
    // (e.g. "401"). Build a lookup by normalized name so we can remap.
    const knownCodes = new Set((plants || []).map((p) => String(p?.plant_code || '').trim()).filter(Boolean))
    const plantsByNameKey = new Map()
    ;(plants || []).forEach((p) => {
        const key = plantNameKey(p?.plant_name)
        if (key && !plantsByNameKey.has(key)) plantsByNameKey.set(key, p.plant_code)
    })

    /** Numeric code candidates derived from the HTML code — covers the common
     *  case where the dispatch system prefixes a region digit and an internal
     *  "0" (e.g. HTML "14006" → DB "406", "14068" → "468"). */
    const deriveCodeCandidates = (code) => {
        const c = String(code || '')
        if (!c) return []
        const out = [c]
        if (c.length >= 2) out.push(c.slice(1))
        if (c.length >= 3) out.push(c.slice(2))
        for (let i = 1; i < c.length - 1; i++) {
            if (c[i] === '0') out.push(c.slice(0, i) + c.slice(i + 1))
        }
        if (c.length >= 3 && c[1] === '0') out.push(c[0] + c.slice(2))
        if (c.length >= 4 && c[2] === '0') out.push(c.slice(0, 1) + c.slice(1, 2) + c.slice(3))
        if (c.length === 5 && c[2] === '0') out.push(c[1] + c.slice(3))
        return [...new Set(out)]
    }

    /**
     * Resolves an HTML plant code to a DB plant_code.
     * Returns null if no match can be found — callers should skip these
     * entries rather than invent phantom plants (the header regex will
     * occasionally false-match random `<digits> - <text>` strings in the
     * report, e.g. customer numbers, line items, etc).
     */
    const resolveDbCode = (htmlCode, htmlName) => {
        for (const candidate of deriveCodeCandidates(htmlCode)) {
            if (knownCodes.has(candidate)) return candidate
        }
        const nameKey = plantNameKey(htmlName)
        if (!nameKey) return null
        if (plantsByNameKey.has(nameKey)) return plantsByNameKey.get(nameKey)
        for (const [key, dbCode] of plantsByNameKey) {
            if (nameKey.startsWith(key) || key.startsWith(nameKey)) return dbCode
            if (nameKey.includes(key) || key.includes(nameKey)) return dbCode
        }
        return null
    }

    // Map each order link to the plant section it lives in.
    const orderLinksByPlant = new Map()
    uniqueHeaders.forEach((header) => {
        orderLinksByPlant.set(header, [])
    })
    const orderLinks = [...doc.querySelectorAll('a[href*="/orders/concrete/"]')]
    orderLinks.forEach((a) => {
        const innerDiv = a.querySelector('div')
        if (!innerDiv) return
        let owner = null
        for (let i = uniqueHeaders.length - 1; i >= 0; i--) {
            const h = uniqueHeaders[i]
            const pos = innerDiv.compareDocumentPosition(h)
            // DOCUMENT_POSITION_PRECEDING = 2
            if (pos & 2) {
                owner = h
                break
            }
        }
        if (owner) orderLinksByPlant.get(owner).push(a)
    })

    const extractOrdersForPlant = (headerEl) => {
        const links = orderLinksByPlant.get(headerEl) || []
        if (!links.length) return []
        const orders = []
        for (const a of links) {
            const innerDiv = a.querySelector('div')
            const inner = innerDiv?.getAttribute('style') || ''
            const topMatch = inner.match(/top:\s*([\d.]+)/)
            const rowTop = topMatch ? parseFloat(topMatch[1]) : null
            if (rowTop == null) continue
            const page = a.closest('.frpage0') || doc
            const pageDivs = parsePositionedDivs(page)
            const orderId = (a.getAttribute('href') || '').match(/\/orders\/concrete\/(\d+)/)?.[1] || ''
            const orderNum = innerDiv?.textContent.trim() || ''
            const detailTop = rowTop + HEAD_OFFSETS.details.top
            orders.push({
                address: findCellText(pageDivs, HEAD_OFFSETS.address.left, rowTop + HEAD_OFFSETS.address.top, 8),
                city: findCellText(pageDivs, HEAD_OFFSETS.city.left, rowTop + HEAD_OFFSETS.city.top, 8),
                contact: findCellText(pageDivs, HEAD_OFFSETS.contact.left, rowTop + HEAD_OFFSETS.contact.top, 8),
                customer: findCellText(pageDivs, HEAD_OFFSETS.customer.left, rowTop + HEAD_OFFSETS.customer.top, 8),
                customerNum: findCellText(
                    pageDivs,
                    HEAD_OFFSETS.customerNum.left,
                    rowTop + HEAD_OFFSETS.customerNum.top
                ),
                description: findCellText(pageDivs, COLS.description, detailTop, 8),
                jobNumber: findCellText(pageDivs, HEAD_OFFSETS.jobNumber.left, rowTop + HEAD_OFFSETS.jobNumber.top),
                loadSize: findCellText(pageDivs, COLS.loadSize, detailTop),
                orderId,
                orderNum,
                phone: findCellText(pageDivs, HEAD_OFFSETS.phone.left, rowTop + HEAD_OFFSETS.phone.top, 8),
                poNumber: findCellText(pageDivs, HEAD_OFFSETS.poNumber.left, rowTop + HEAD_OFFSETS.poNumber.top),
                productCode: findCellText(pageDivs, COLS.productCode, detailTop),
                productPrice: findCellText(pageDivs, COLS.productPrice, detailTop),
                rate: findCellText(pageDivs, COLS.rate, detailTop),
                startTime: findCellText(pageDivs, COLS.startTime, detailTop),
                tktTime: findCellText(pageDivs, COLS.tktTime, detailTop),
                toJobTime: findCellText(pageDivs, COLS.toJobTime, detailTop),
                toPlantTime: findCellText(pageDivs, COLS.toPlantTime, detailTop),
                truckClass: findCellText(pageDivs, HEAD_OFFSETS.truckClass.left, rowTop + HEAD_OFFSETS.truckClass.top),
                truckCount: findCellText(pageDivs, COLS.truckCount, detailTop),
                yardage: findCellText(pageDivs, COLS.orderQty, detailTop)
            })
        }
        orders.sort((a, b) => {
            if (!a.startTime) return 1
            if (!b.startTime) return -1
            return a.startTime.localeCompare(b.startTime)
        })
        return orders
    }

    const production = {}
    // Skipped codes only logged once per parse run to avoid console spam
    // when the bucket re-syncs every 5 minutes with the same bad headers.
    const skipped = []
    uniqueHeaders.forEach((header, idx) => {
        const headerText = header.textContent.trim()
        const match = headerText.match(PLANT_HEADER_RE)
        const htmlCode = match?.[1]
        const htmlName = match?.[2] || ''
        if (!htmlCode) return
        const code = resolveDbCode(htmlCode, htmlName)
        if (!code) {
            // Header matched the pattern but doesn't correspond to any known DB plant.
            // Almost always junk text that incidentally looks like a plant header.
            skipped.push(`${htmlCode} - ${htmlName}`.trim())
            return
        }

        const headerIndex = allDivs.indexOf(header)
        const nextHeaderIndex =
            idx < uniqueHeaders.length - 1 ? allDivs.indexOf(uniqueHeaders[idx + 1]) : allDivs.length

        const orders = extractOrdersForPlant(header)

        const startTimes = orders
            .map((o) => (o.startTime || '').padStart(5, '0'))
            .filter((t) => /^\d{2}:\d{2}$/.test(t))
        if (!startTimes.length) {
            for (let i = headerIndex + 1; i < nextHeaderIndex; i++) {
                const d = allDivs[i]
                const time = d.textContent.trim()
                if (!/^\d{1,2}:\d{2}$/.test(time)) continue
                const style = d.getAttribute('style') || ''
                const leftMatch = style.match(/left:\s*([\d.]+)/)
                const left = leftMatch ? parseFloat(leftMatch[1]) : null
                if (left != null && left >= 305 && left <= 310) {
                    startTimes.push(time.padStart(5, '0'))
                }
            }
        }

        // Find total yardage — look for "Plant Total:" then search nearby for a number
        let totalYardage = ''
        for (let i = headerIndex + 1; i < nextHeaderIndex; i++) {
            const d = allDivs[i]
            const dt = d.textContent.trim()
            if (dt === 'Plant Total:' || dt === 'Plant Total') {
                for (let offset = 1; offset <= 10; offset++) {
                    for (const j of [i - offset, i + offset]) {
                        if (j > headerIndex && j < nextHeaderIndex) {
                            const val = allDivs[j].textContent.trim().replace(/,/g, '')
                            if (/^\d+(\.\d+)?$/.test(val) && parseFloat(val) > 0) {
                                totalYardage = val
                                break
                            }
                        }
                    }
                    if (totalYardage) break
                }
                break
            }
        }

        // Fallback: sum all numeric values near "total" rows
        if (!totalYardage) {
            let maxVal = 0
            for (let i = headerIndex + 1; i < nextHeaderIndex; i++) {
                const d = allDivs[i]
                const dt = d.textContent.trim()
                if (dt.toLowerCase().includes('total')) {
                    for (let j = i - 1; j > Math.max(headerIndex, i - 5); j--) {
                        const val = allDivs[j].textContent.trim().replace(/,/g, '')
                        if (/^\d+(\.\d+)?$/.test(val)) {
                            const num = parseFloat(val)
                            if (num > maxVal) maxVal = num
                            break
                        }
                    }
                }
            }
            if (maxVal > 0) totalYardage = String(maxVal)
        }

        const sorted = [...startTimes].sort()
        production[code] = {
            firstJobTime: sorted[0] || '',
            lastJobTime: sorted[sorted.length - 1] || '',
            orders,
            totalYardage
        }
    })

    if (skipped.length) {
        console.warn(`[DailyOrderParser] Ignored ${skipped.length} header(s) with no matching DB plant:`, skipped)
    }

    return production
}
