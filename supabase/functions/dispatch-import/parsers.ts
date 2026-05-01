// @ts-ignore
import { DOMParser, Element } from 'deno-dom'

// ============================================================================
// Shared helpers
// ============================================================================

const ROW_TOL = 4
const COLUMN_TOL = 6

interface PositionedDiv {
    el: Element
    left: number
    top: number
    text: string
    page: Element | null
}

const getPageWrapper = (el: Element): Element | null => {
    let cur: Element | null = el
    while (cur) {
        const cls = cur.getAttribute('class') || ''
        if (/(^|\s)frpage\d/.test(cls)) return cur
        cur = cur.parentElement
    }
    return null
}

const parsePositionedDivs = (root: Element | Document): PositionedDiv[] => {
    const out: PositionedDiv[] = []
    for (const el of root.querySelectorAll('div') as unknown as Element[]) {
        const style = el.getAttribute('style') || ''
        const leftMatch = style.match(/left:\s*([\d.]+)/)
        const topMatch = style.match(/top:\s*([\d.]+)/)
        if (!leftMatch || !topMatch) continue
        const text = (el.textContent || '').trim()
        if (!text) continue
        out.push({
            el,
            left: parseFloat(leftMatch[1]),
            top: parseFloat(topMatch[1]),
            text,
            page: getPageWrapper(el)
        })
    }
    return out
}

const findCellText = (
    cells: PositionedDiv[],
    targetLeft: number,
    targetTop: number,
    leftTol = COLUMN_TOL,
    topTol = ROW_TOL,
    page: Element | null = null
): string => {
    const m = cells.find(
        (d) =>
            (!page || d.page === page) &&
            Math.abs(d.left - targetLeft) <= leftTol &&
            Math.abs(d.top - targetTop) <= topTol &&
            d.text.length > 0
    )
    return m?.text || ''
}

const HHMM_RE = /^\d{1,2}:\d{2}$/
const ALL_DIGITS_RE = /^\d+$/
const cleanTime = (t: string): string => (HHMM_RE.test((t || '').trim()) ? t.trim() : '')
const cleanIdentifier = (t: string): string => (ALL_DIGITS_RE.test((t || '').trim()) ? t.trim() : '')

// FastReport occasionally splits a numeric cell across two stacked divs at
// the same left position — e.g. "8528" rendered as "85" on one div and "28"
// on another a few px below. Single-cell lookup grabs only one fragment,
// which is why truck numbers sometimes show up as "28" or as "—" when no
// fragment lands inside the standard row tolerance. This helper widens the
// row tolerance, gathers every digit-only fragment at the column, and
// concatenates them top-to-bottom to reassemble the original value.
const findIdentifierAt = (
    cells: PositionedDiv[],
    targetLeft: number,
    targetTop: number,
    leftTol = COLUMN_TOL,
    topTol = ROW_TOL * 2,
    page: Element | null = null
): string => {
    const matches: PositionedDiv[] = []
    for (const d of cells) {
        if (page && d.page !== page) continue
        if (Math.abs(d.left - targetLeft) > leftTol) continue
        if (Math.abs(d.top - targetTop) > topTol) continue
        if (!ALL_DIGITS_RE.test(d.text.trim())) continue
        matches.push(d)
    }
    if (matches.length === 0) return ''
    if (matches.length === 1) return matches[0].text.trim()
    return matches
        .slice()
        .sort((a, b) => a.top - b.top)
        .map((m) => m.text.trim())
        .join('')
}

const normalizeDispatchPlantCode = (code: string): string => {
    const c = String(code || '').trim()
    if (!c) return ''
    if (c.length === 5 && c[2] === '0') return c[1] + c.slice(3)
    if (c.length === 6 && c[2] === '0' && /[A-Z]$/i.test(c)) return c[1] + c.slice(3)
    if (c.length >= 3 && c[1] === '0') return c[0] + c.slice(2)
    if (c.length >= 3) return c.slice(2)
    return c
}

const extractPlantCodeFromCell = (cellText: string): string => {
    if (!cellText) return ''
    const m = cellText.match(/^(\d{3,6})/)
    return m ? normalizeDispatchPlantCode(m[1]) : ''
}

const precedes = (a: Element, b: Element): boolean => {
    // PRECEDING bit = 2: b precedes a → returns true
    return (a.compareDocumentPosition(b) & 2) !== 0
}

const inRange = (el: Element, startEl: Element, endEl: Element | null): boolean => {
    if (!precedes(el, startEl)) return false
    if (!endEl) return true
    return precedes(endEl, el)
}

// ============================================================================
// DailyOrder parser
// ============================================================================

const PLANT_HEADER_RE = /^(\d{3,6}[A-Z]?)\s*-\s*(.*[A-Za-z].*)$/
const PLANT_NAME_MIN_LETTERS = 3

// HOME-plant overrides for DailyOrder. Orders are only ever booked at the
// canonical sibling (403, 408) — 404 and 409 are loading-only plants. If a
// DailyOrder ever shows up under a sibling code (rare, usually a dispatch
// data-entry slip), we fold it to the canonical so the schedule filter
// doesn't surface 404/409 as bookable plants.
//
// Loading-plant attribution on tickets stays DISTINCT — see
// `DD_DISPATCH_CODE_OVERRIDES` below.
const DISPATCH_CODE_OVERRIDES: Record<string, string> = {
    '14003': '403',
    '14004': '403',
    '14008': '408',
    '14008B': '408'
}

const plantNameKey = (name: string): string =>
    String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()

const DAILY_COLS = {
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

export interface DailyOrderRecord {
    orderId: string
    orderNum: string
    homePlantCode: string
    customer: string
    customerNum: string
    jobNumber: string
    address: string
    city: string
    contact: string
    phone: string
    poNumber: string
    productCode: string
    description: string
    startTime: string
    rate: string
    yardage: number | null
    loadSize: number | null
    truckCount: number | null
    truckClass: string
    tktTime: string
    toJobTime: string
    toPlantTime: string
}

const numOrNull = (v: string): number | null => {
    if (!v) return null
    const n = parseFloat(String(v).replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
}

const deriveCodeCandidates = (code: string): string[] => {
    const c = String(code || '')
    if (!c) return []
    const out: string[] = [c]
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

interface PlantsRow {
    plant_code?: string
    plant_name?: string
}

export function parseDailyOrderHtml(htmlString: string, plants: PlantsRow[] = []): DailyOrderRecord[] {
    if (!htmlString) return []

    const doc = new DOMParser().parseFromString(htmlString, 'text/html')
    if (!doc) return []
    const allDivs = [...(doc.querySelectorAll('div') as unknown as Element[])]

    const knownCodes = new Set(plants.map((p) => String(p?.plant_code || '').trim()).filter(Boolean))
    const plantsByNameKey = new Map<string, string>()
    for (const p of plants) {
        const key = plantNameKey(p?.plant_name || '')
        if (key && !plantsByNameKey.has(key) && p.plant_code) plantsByNameKey.set(key, p.plant_code)
    }

    const resolveDbCode = (htmlCode: string, htmlName: string): string | null => {
        const override = DISPATCH_CODE_OVERRIDES[(htmlCode || '').toUpperCase()]
        if (override) return override
        for (const candidate of deriveCodeCandidates(htmlCode)) {
            if (knownCodes.has(candidate)) return candidate
        }
        const nameKey = plantNameKey(htmlName)
        if (!nameKey) return null
        if (plantsByNameKey.has(nameKey)) return plantsByNameKey.get(nameKey)!
        const MIN = 4
        if (nameKey.length < MIN) return null
        for (const [key, code] of plantsByNameKey) {
            if (key.length < MIN) continue
            if (nameKey.startsWith(key) || key.startsWith(nameKey)) return code
            if (nameKey.includes(key) || key.includes(nameKey)) return code
        }
        return null
    }

    const plantHeaders = allDivs.filter((d) => {
        const text = (d.textContent || '').trim()
        const m = text.match(PLANT_HEADER_RE)
        if (!m) return false
        if (text.includes(',')) return false
        const letters = (m[2].match(/[A-Za-z]/g) || []).length
        return letters >= PLANT_NAME_MIN_LETTERS
    })

    const seenCodes = new Set<string>()
    const uniqueHeaders = plantHeaders.filter((h) => {
        const code = (h.textContent || '').trim().match(PLANT_HEADER_RE)?.[1]
        if (!code || seenCodes.has(code)) return false
        seenCodes.add(code)
        return true
    })

    const orderLinksByPlant = new Map<Element, Element[]>()
    uniqueHeaders.forEach((h) => orderLinksByPlant.set(h, []))
    const orderLinks = [...(doc.querySelectorAll('a[href*="/orders/concrete/"]') as unknown as Element[])]
    for (const a of orderLinks) {
        const innerDiv = a.querySelector('div')
        if (!innerDiv) continue
        let owner: Element | null = null
        for (let i = uniqueHeaders.length - 1; i >= 0; i--) {
            const h = uniqueHeaders[i]
            if ((innerDiv.compareDocumentPosition(h) & 2) !== 0) {
                owner = h
                break
            }
        }
        if (owner) orderLinksByPlant.get(owner)!.push(a)
    }

    const result: DailyOrderRecord[] = []
    uniqueHeaders.forEach((header) => {
        const headerText = (header.textContent || '').trim()
        const m = headerText.match(PLANT_HEADER_RE)
        if (!m) return
        const dbCode = resolveDbCode(m[1], m[2] || '')
        if (!dbCode) return

        const links = orderLinksByPlant.get(header) || []
        for (const a of links) {
            const innerDiv = a.querySelector('div')
            if (!innerDiv) continue
            const inner = innerDiv.getAttribute('style') || ''
            const topMatch = inner.match(/top:\s*([\d.]+)/)
            if (!topMatch) continue
            const rowTop = parseFloat(topMatch[1])

            // Page-scope the lookups so cross-page top collisions don't poison fields.
            const page = getPageWrapper(a) || null
            const pageDivs = page ? parsePositionedDivs(page) : parsePositionedDivs(doc)
            const orderId = (a.getAttribute('href') || '').match(/\/orders\/concrete\/(\d+)/)?.[1] || ''
            const orderNum = (innerDiv.textContent || '').trim()
            const detailTop = rowTop + HEAD_OFFSETS.details.top

            result.push({
                orderId,
                orderNum,
                homePlantCode: dbCode,
                address: findCellText(pageDivs, HEAD_OFFSETS.address.left, rowTop + HEAD_OFFSETS.address.top, 8),
                city: findCellText(pageDivs, HEAD_OFFSETS.city.left, rowTop + HEAD_OFFSETS.city.top, 8),
                contact: findCellText(pageDivs, HEAD_OFFSETS.contact.left, rowTop + HEAD_OFFSETS.contact.top, 8),
                customer: findCellText(pageDivs, HEAD_OFFSETS.customer.left, rowTop + HEAD_OFFSETS.customer.top, 8),
                customerNum: findCellText(pageDivs, HEAD_OFFSETS.customerNum.left, rowTop + HEAD_OFFSETS.customerNum.top),
                jobNumber: findCellText(pageDivs, HEAD_OFFSETS.jobNumber.left, rowTop + HEAD_OFFSETS.jobNumber.top),
                phone: findCellText(pageDivs, HEAD_OFFSETS.phone.left, rowTop + HEAD_OFFSETS.phone.top, 8),
                poNumber: findCellText(pageDivs, HEAD_OFFSETS.poNumber.left, rowTop + HEAD_OFFSETS.poNumber.top),
                truckClass: findCellText(pageDivs, HEAD_OFFSETS.truckClass.left, rowTop + HEAD_OFFSETS.truckClass.top),
                description: findCellText(pageDivs, DAILY_COLS.description, detailTop, 8),
                productCode: findCellText(pageDivs, DAILY_COLS.productCode, detailTop),
                rate: findCellText(pageDivs, DAILY_COLS.rate, detailTop),
                startTime: findCellText(pageDivs, DAILY_COLS.startTime, detailTop),
                tktTime: findCellText(pageDivs, DAILY_COLS.tktTime, detailTop),
                toJobTime: findCellText(pageDivs, DAILY_COLS.toJobTime, detailTop),
                toPlantTime: findCellText(pageDivs, DAILY_COLS.toPlantTime, detailTop),
                truckCount: numOrNull(findCellText(pageDivs, DAILY_COLS.truckCount, detailTop)),
                yardage: numOrNull(findCellText(pageDivs, DAILY_COLS.orderQty, detailTop)),
                loadSize: numOrNull(findCellText(pageDivs, DAILY_COLS.loadSize, detailTop))
            })
        }
    })

    return result
}

// ============================================================================
// DetailOrderAnalysis parser
// ============================================================================

const DETAIL_QTY_LEFT = 463.05
const DETAIL_PRODUCT_CODE_LEFT = 94.5
const DETAIL_DESCRIPTION_LEFT = 226.8
const DETAIL_TRUCK_LEFT = 236.25
const DETAIL_DRIVER_LEFT = 406.35
const DETAIL_PLANT_LEFT = 567
const DETAIL_TIMES_ROW_OFFSET = 47.25
const DETAIL_LOADED_TIME_LEFT = 89.77
const DETAIL_TICKET_TIME_LEFT = 0

const HARD_NON_YARDAGE_DESC_RE =
    /\b(ENVIRONMENTAL[\s\\/]+FUEL\s+SURCHARGE|FUEL\s+SURCHARGE|ENVIRONMENTAL\s+SURCHARGE|FUEL\s+CHARGE|ENV\s+CHARGE)\b/
const SURCHARGE_DESC_RE =
    /SURCHARGE|FUEL|ENVIRONMENT|FREIGHT|ADMIN|HAUL|MIN(IMUM)?\s*LOAD|WASH(\s|OUT)|OVERTIME|RETAIN|RETURN|STAND[\s-]?BY|FEE\b/
const ADDITIVE_DESC_RE = /\b(FIBER|FIBR|ICE|PUMP|ACCEL|RETARD|COLOR|PIGMENT|AIR\s*ENT|ADMIX|ADDITIVE|FLY\s*ASH|SLAG)\b/
const CONCRETE_CODE_RE = /^\d{4,}[A-Z]{0,4}$/i

// Strongest positive signal a row is concrete: a PSI strength rating in
// the description ("4000 PSI", "3000 PSI", "4500 PSI STRT", etc).
// Dispatch systems use this naming consistently, even when the product
// code carries a regional prefix (e.g. "TX40927") that breaks the
// pure-numeric heuristic.
const PSI_DESC_RE = /\b\d{3,5}\s*PSI\b/

const isConcreteProduct = (code: string, desc: string): boolean => {
    const c = (code || '').trim().toUpperCase()
    const d = (desc || '').toUpperCase()
    if (!c) return false
    if (HARD_NON_YARDAGE_DESC_RE.test(d)) return false
    if (SURCHARGE_DESC_RE.test(d) || ADDITIVE_DESC_RE.test(d)) return false
    if (PSI_DESC_RE.test(d)) return true
    if (CONCRETE_CODE_RE.test(c)) return true
    if (/CONCRETE/.test(d) && !c.includes('-')) return true
    return false
}

const getAnchorTop = (anchor: Element): number | null => {
    const inner = anchor.querySelector('div')
    const style = inner?.getAttribute('style') || anchor.getAttribute('style') || ''
    const m = style.match(/top:\s*([\d.]+)/)
    return m ? parseFloat(m[1]) : null
}

export interface DetailTicketRecord {
    orderId: string
    orderNum: string
    ticketId: string
    ticketNum: string
    truckNum: string
    driverNum: string
    ticketTime: string
    loadedTime: string
    quantity: number
    loadedPlantCode: string
}

export function parseDetailOrderHtml(htmlString: string): DetailTicketRecord[] {
    if (!htmlString) return []
    const doc = new DOMParser().parseFromString(htmlString, 'text/html')
    if (!doc) return []
    const orderAnchors = [...(doc.querySelectorAll('a[href*="/orders/audit/"]') as unknown as Element[])]
    if (!orderAnchors.length) return []
    const ticketAnchors = [...(doc.querySelectorAll('a[href*="/ticketing/edit-tickets/"]') as unknown as Element[])]
    const cells = parsePositionedDivs(doc)

    const findRowMate = (cell: PositionedDiv, targetLeft: number, startEl: Element, endEl: Element | null) =>
        cells.find(
            (d) =>
                d.page === cell.page &&
                Math.abs(d.left - targetLeft) <= COLUMN_TOL &&
                Math.abs(d.top - cell.top) <= ROW_TOL &&
                d.text.length > 0 &&
                inRange(d.el, startEl, endEl)
        )

    const sumQuantities = (startEl: Element, endEl: Element | null): number => {
        let total = 0
        for (const cell of cells) {
            if (Math.abs(cell.left - DETAIL_QTY_LEFT) > COLUMN_TOL) continue
            if (!inRange(cell.el, startEl, endEl)) continue
            const qty = parseFloat(cell.text.replace(/,/g, ''))
            if (!Number.isFinite(qty) || qty <= 0) continue
            const codeMate = findRowMate(cell, DETAIL_PRODUCT_CODE_LEFT, startEl, endEl)
            const code = codeMate?.text || ''
            if (!code) continue
            const descMate = findRowMate(cell, DETAIL_DESCRIPTION_LEFT, startEl, endEl)
            if (!isConcreteProduct(code, descMate?.text || '')) continue
            total += qty
        }
        return total
    }

    const result: DetailTicketRecord[] = []
    for (let i = 0; i < orderAnchors.length; i++) {
        const orderAnchor = orderAnchors[i]
        const nextOrderAnchor = orderAnchors[i + 1] || null
        const orderId = (orderAnchor.getAttribute('href') || '').match(/\/orders\/audit\/(\d+)/)?.[1]
        if (!orderId) continue
        const orderNum = (orderAnchor.querySelector('div')?.textContent || '').trim()

        const orderTickets = ticketAnchors.filter((t) => inRange(t, orderAnchor, nextOrderAnchor))
        for (let j = 0; j < orderTickets.length; j++) {
            const ticketAnchor = orderTickets[j]
            const nextBoundary = orderTickets[j + 1] || nextOrderAnchor
            const ticketId =
                (ticketAnchor.getAttribute('href') || '').match(/\/ticketing\/edit-tickets\/(\d+)/)?.[1] || ''
            const ticketNum = (ticketAnchor.querySelector('div')?.textContent || '').trim()
            const ticketTop = getAnchorTop(ticketAnchor)
            const timesTop = Number.isFinite(ticketTop || NaN) ? (ticketTop as number) + DETAIL_TIMES_ROW_OFFSET : null
            const ticketPage = getPageWrapper(ticketAnchor)

            const truckNum = ticketTop != null
                ? findIdentifierAt(cells, DETAIL_TRUCK_LEFT, ticketTop, 6, ROW_TOL * 2, ticketPage)
                : ''
            const driverNum = ticketTop != null
                ? cleanIdentifier(findCellText(cells, DETAIL_DRIVER_LEFT, ticketTop, 6, ROW_TOL, ticketPage))
                : ''
            const ticketTime = timesTop != null
                ? cleanTime(findCellText(cells, DETAIL_TICKET_TIME_LEFT, timesTop, 4, ROW_TOL, ticketPage))
                : ''
            const loadedTime = timesTop != null
                ? cleanTime(findCellText(cells, DETAIL_LOADED_TIME_LEFT, timesTop, 4, ROW_TOL, ticketPage))
                : ''
            const plantCellText = ticketTop != null
                ? findCellText(cells, DETAIL_PLANT_LEFT, ticketTop, 12, ROW_TOL, ticketPage)
                : ''

            result.push({
                orderId,
                orderNum,
                ticketId,
                ticketNum,
                truckNum,
                driverNum,
                ticketTime,
                loadedTime,
                quantity: sumQuantities(ticketAnchor, nextBoundary),
                loadedPlantCode: extractPlantCodeFromCell(plantCellText)
            })
        }
    }

    return result
}

// ============================================================================
// DetailDriver parser
// ============================================================================

const DD_TICKET_NUM_LEFT = 411.7
const DD_TRUCK_NUM_LEFT = 68.15
const DD_ORDER_NUM_LEFT = 247.7
const DD_CUSTOMER_LEFT = 592.9
const DD_DRIVER_NUM_LEFT = 126.55
const DD_DRIVER_NAME_LEFT = 289.75
const DD_PLANT_GROUP_LEFT = 68.4 // "Plant: 14XXX - NAME" group header that precedes drivers based at that plant
const DD_TIMES_ROW_OFFSET = 37.8
const DD_TKT_TIME_LEFT = 33.15
const DD_LOADED_TIME_LEFT = 104.75
const PLANT_HEADER_DD_RE = /^(\d{4,6}[A-Z]?)\s*-\s*[A-Z]/

// Sibling pairs are kept DISTINCT so a ticket loaded from 404 reads as
// 404 (not 403) in the modal — same for 409 vs 408. Only override needed
// is for 14008B since it doesn't fall out of the standard derive heuristic.
const DD_DISPATCH_CODE_OVERRIDES: Record<string, string> = {
    '14003': '403',
    '14004': '404',
    '14008': '408',
    '14008B': '409'
}

const resolveDriverPlantCode = (cellText: string): string => {
    if (!cellText) return ''
    const m = cellText.match(/^(\d{4,6}[A-Z]?)/)
    if (!m) return ''
    const code = m[1].toUpperCase()
    if (DD_DISPATCH_CODE_OVERRIDES[code]) return DD_DISPATCH_CODE_OVERRIDES[code]
    return normalizeDispatchPlantCode(code)
}

export interface DetailDriverRecord {
    ticketNum: string
    orderNum: string
    truckNum: string
    driverNum: string
    driverName: string
    customer: string
    plantCode: string
    ticketTime: string
    loadedTime: string
}

/**
 * Streaming regex-based parser for DetailDriver HTML.
 *
 * The full file is ~2.5 MB with 67 FastReport pages, ~167 drivers, and
 * ~270 tickets. Loading it into deno-dom blows past the edge runtime's
 * memory cap (WORKER_RESOURCE_LIMIT). We sidestep the DOM entirely:
 * the report's structure is regular enough that a single-pass regex
 * walk over the source text yields the same data with a tiny memory
 * footprint.
 *
 * Per-cell pattern (positioned absolute divs, FastReport-emitted):
 *   `<div ... style="...left:NN.NNpx; ...top:NN.NNpx; ..." ...>INNER</div>`
 * INNER may contain a nested `<div class="sNN">TEXT</div>` or be plain text.
 *
 * Algorithm: walk every cell match in DOM order. Track the current plant
 * section (from "Plant: 14XXX - NAME" headers at left ≈ 68), the current
 * driver # (left ≈ 126), and emit a ticket whenever a Ticket # cell
 * (left ≈ 411) is seen. For each ticket, look ahead/behind the current
 * cell index for siblings on the same row (truck, order, customer) and
 * the times row ~37 pixels below.
 */
export function parseDetailDriverHtml(
    htmlString: string,
    fileLoadingPlant = ''
): { plantCode: string; tickets: DetailDriverRecord[] } {
    if (!htmlString) return { plantCode: '', tickets: [] }

    interface Cell {
        left: number
        top: number
        text: string
    }

    // Single regex extracts every positioned div + its inner text. We then
    // strip nested tags from the inner content. A non-greedy capture keeps
    // memory bounded since we never materialize a DOM tree.
    const cellRe = /<div[^>]*style="([^"]*)"[^>]*>([\s\S]*?)<\/div>/g
    const cells: Cell[] = []
    let m: RegExpExecArray | null
    while ((m = cellRe.exec(htmlString)) !== null) {
        const style = m[1]
        const left = style.match(/left:\s*([\d.]+)/)
        const top = style.match(/top:\s*([\d.]+)/)
        if (!left || !top) continue
        // Strip any nested HTML and decode &nbsp;
        const text = m[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
        if (!text) continue
        cells.push({ left: parseFloat(left[1]), top: parseFloat(top[1]), text })
    }

    // Helper: scan cells near (top ± topTol, left ± leftTol) starting from
    // a given anchor index outward. The scan bound (windowSize) keeps it
    // fast on a large cell list.
    const findNearby = (anchorIdx: number, targetLeft: number, targetTop: number, leftTol: number, windowSize = 60) => {
        const lo = Math.max(0, anchorIdx - windowSize)
        const hi = Math.min(cells.length, anchorIdx + windowSize)
        for (let i = lo; i < hi; i++) {
            const c = cells[i]
            if (Math.abs(c.left - targetLeft) > leftTol) continue
            if (Math.abs(c.top - targetTop) > ROW_TOL) continue
            return c.text
        }
        return ''
    }

    // Like findNearby, but gathers every digit-only fragment at the column
    // within a widened row tolerance and concatenates them top-to-bottom —
    // recovers truck numbers FastReport split across stacked divs (e.g.
    // "8528" → "85" + "28").
    const collectIdentifierNearby = (
        anchorIdx: number,
        targetLeft: number,
        targetTop: number,
        leftTol: number,
        topTol = ROW_TOL * 2,
        windowSize = 60
    ): string => {
        const lo = Math.max(0, anchorIdx - windowSize)
        const hi = Math.min(cells.length, anchorIdx + windowSize)
        const matches: { top: number; text: string }[] = []
        for (let i = lo; i < hi; i++) {
            const c = cells[i]
            if (Math.abs(c.left - targetLeft) > leftTol) continue
            if (Math.abs(c.top - targetTop) > topTol) continue
            const t = c.text.trim()
            if (!ALL_DIGITS_RE.test(t)) continue
            matches.push({ top: c.top, text: t })
        }
        if (matches.length === 0) return ''
        if (matches.length === 1) return matches[0].text
        matches.sort((a, b) => a.top - b.top)
        return matches.map((m) => m.text).join('')
    }

    const tickets: DetailDriverRecord[] = []
    const seen = new Set<string>()
    let currentDriverNum = ''
    let currentDriverName = ''
    let currentSectionPlant = ''
    const fallbackPlant = fileLoadingPlant ? String(fileLoadingPlant) : ''

    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i]

        // Plant section header: e.g. "14008B - CONROE" at left ≈ 68.
        if (Math.abs(cell.left - DD_PLANT_GROUP_LEFT) <= COLUMN_TOL && PLANT_HEADER_DD_RE.test(cell.text)) {
            const resolved = resolveDriverPlantCode(cell.text)
            if (resolved) currentSectionPlant = resolved
            continue
        }

        // Driver # cell (4-8 digit) at left ≈ 126.
        if (Math.abs(cell.left - DD_DRIVER_NUM_LEFT) <= COLUMN_TOL && /^\d{4,8}$/.test(cell.text)) {
            currentDriverNum = cleanIdentifier(cell.text)
            currentDriverName = findNearby(i, DD_DRIVER_NAME_LEFT, cell.top, 12).trim()
            continue
        }

        // Ticket # cell at left ≈ 411 (7+ digit).
        if (!(Math.abs(cell.left - DD_TICKET_NUM_LEFT) <= COLUMN_TOL && /^\d{7,}$/.test(cell.text))) continue
        const ticketNum = cell.text
        if (seen.has(ticketNum)) continue
        seen.add(ticketNum)

        const truckNum = collectIdentifierNearby(i, DD_TRUCK_NUM_LEFT, cell.top, COLUMN_TOL)
        const orderNum = cleanIdentifier(findNearby(i, DD_ORDER_NUM_LEFT, cell.top, COLUMN_TOL))
        const customer = findNearby(i, DD_CUSTOMER_LEFT, cell.top, 8).trim()
        const timesTop = cell.top + DD_TIMES_ROW_OFFSET
        const ticketTime = cleanTime(findNearby(i, DD_TKT_TIME_LEFT, timesTop, 8))
        const loadedTime = cleanTime(findNearby(i, DD_LOADED_TIME_LEFT, timesTop, 8))

        tickets.push({
            ticketNum,
            orderNum,
            truckNum,
            driverNum: currentDriverNum,
            driverName: currentDriverName,
            customer,
            plantCode: currentSectionPlant || fallbackPlant,
            ticketTime,
            loadedTime
        })
    }

    return { plantCode: currentSectionPlant || fallbackPlant, tickets }
}
