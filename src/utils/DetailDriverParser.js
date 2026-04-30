/**
 * Parses a "Detail Daily Driver Analysis" HTML export (FastReport output from
 * the dispatch system) into a flat list of per-ticket records.
 *
 * The report's `intPlantId` filter (set on the seat/session) selects which
 * plant the report is for. Each row is a ticket loaded BY a driver based at
 * that plant — regardless of the home plant of the order being delivered.
 * That's the whole point of pulling this report: it surfaces cross-plant
 * loads that `DetailOrderAnalysis` misses.
 *
 * Output shape:
 *   { plantCode, tickets: [{
 *       ticketNum, orderNum, truckNum, driverNum, driverName, customer,
 *       plantCode, ticketTime, loadedTime
 *   }] }
 *
 * Quantity (yards) is NOT in this report — it shows times only. Yards must
 * be filled in from a DetailOrderAnalysis match by ticketNum, or left as 0
 * for true cross-plant tickets where DetailOrderAnalysis has no entry.
 */

// Column lefts derived from the FastReport HTML layout. All fields share a
// few consistent columns; only the row-block top changes per ticket.
const TICKET_NUM_LEFT = 411.7
const TRUCK_NUM_LEFT = 68.15
const ORDER_NUM_LEFT = 247.7
const CUSTOMER_LEFT = 592.9
const DRIVER_NUM_LEFT = 126.55
const DRIVER_NAME_LEFT = 289.75
// Times row sits ~37.8px below the ticket-info row (Truck/Order/Ticket/Customer
// are at top T; the times values are at top T + TIMES_ROW_OFFSET).
const TIMES_ROW_OFFSET = 37.8
const TKT_TIME_LEFT = 33.15
const LOADED_TIME_LEFT = 104.75
// Plant header on the report: a "DDDDD - PLANT NAME" cell at top ≈ 185.
const PLANT_HEADER_TOP = 185
const COLUMN_TOL = 6
const ROW_TOL = 4

const HHMM_RE = /^\d{1,2}:\d{2}$/
const ALL_DIGITS_RE = /^\d+$/
const PLANT_HEADER_RE = /^(\d{4,6}[A-Z]?)\s*-\s*[A-Z]/

const cleanTime = (text) => (HHMM_RE.test(String(text || '').trim()) ? String(text).trim() : '')
const cleanIdentifier = (text) => {
    const s = String(text || '').trim()
    return ALL_DIGITS_RE.test(s) ? s : ''
}

/** Maps the dispatch system's internal 5-digit plant code (e.g. "14001") to
 *  the 3-digit DB code we use throughout the app (e.g. "401"). Mirrors the
 *  helper in `DetailOrderParser` so plant attribution is consistent. */
const normalizeDispatchPlantCode = (code) => {
    const c = String(code || '').trim()
    if (!c) return ''
    if (c.length === 5 && c[2] === '0') return c[1] + c.slice(3) // "14001" → "401"
    if (c.length === 6 && c[2] === '0' && /[A-Z]$/i.test(c)) return c[1] + c.slice(3) // "14008B" → "408B"
    if (c.length >= 3 && c[1] === '0') return c[0] + c.slice(2)
    if (c.length >= 3) return c.slice(2)
    return c
}

const getPageWrapper = (el) => el.closest('[class^="frpage"], [class*=" frpage"]')

const parsePositionedDivs = (root) => {
    const out = []
    for (const el of root.querySelectorAll('div')) {
        const style = el.getAttribute('style') || ''
        const leftMatch = style.match(/left:\s*([\d.]+)/)
        const topMatch = style.match(/top:\s*([\d.]+)/)
        if (!leftMatch || !topMatch) continue
        const text = el.textContent.trim()
        if (!text) continue
        out.push({
            el,
            left: parseFloat(leftMatch[1]),
            page: getPageWrapper(el),
            text,
            top: parseFloat(topMatch[1])
        })
    }
    return out
}

const findOnSameRow = (cells, page, top, targetLeft, leftTol = COLUMN_TOL) =>
    cells.find(
        (c) =>
            c.page === page &&
            Math.abs(c.left - targetLeft) <= leftTol &&
            Math.abs(c.top - top) <= ROW_TOL &&
            c.text.length > 0
    )

/**
 * @param {string} htmlString - DetailDriver HTML
 * @param {string} [fileLoadingPlant] - Plant code we expect this file to be for.
 *        When provided, takes precedence over the in-document header so the
 *        bucket filename's plant binding wins over a possibly stale header.
 */
export function parseDetailDriverHtml(htmlString, fileLoadingPlant = '') {
    if (!htmlString || typeof htmlString !== 'string') return { plantCode: '', tickets: [] }

    const doc = new DOMParser().parseFromString(htmlString, 'text/html')
    const cells = parsePositionedDivs(doc)

    // Resolve the report's loading plant. The bridge knows the plant from
    // the filename; that's authoritative. As a fallback we read the report
    // header on page 0 (a "DDDDD - NAME" cell at top ≈ 185).
    let plantCode = fileLoadingPlant ? String(fileLoadingPlant) : ''
    if (!plantCode) {
        const headerCell = cells.find(
            (c) => Math.abs(c.top - PLANT_HEADER_TOP) <= ROW_TOL && PLANT_HEADER_RE.test(c.text)
        )
        if (headerCell) {
            const m = headerCell.text.match(PLANT_HEADER_RE)
            if (m) plantCode = normalizeDispatchPlantCode(m[1])
        }
    }

    // Walk every cell in DOM order, tracking the "current driver" as we go.
    // The dispatch report renders Driver # → that driver's tickets, repeating
    // for each driver. Walking in DOM order naturally attaches each ticket
    // to the right driver — including tickets at the top of a new page,
    // where same-page lookup would miss the driver header on the prior page.
    const tickets = []
    const seenTicketNums = new Set()
    let currentDriverNum = ''
    let currentDriverName = ''

    for (const cell of cells) {
        const isDriverCell = Math.abs(cell.left - DRIVER_NUM_LEFT) <= COLUMN_TOL && /^\d{4,8}$/.test(cell.text)
        if (isDriverCell) {
            currentDriverNum = cleanIdentifier(cell.text)
            const nameCell = findOnSameRow(cells, cell.page, cell.top, DRIVER_NAME_LEFT, 12)
            currentDriverName = nameCell?.text?.trim() || ''
            continue
        }

        const isTicketCell = Math.abs(cell.left - TICKET_NUM_LEFT) <= COLUMN_TOL && /^\d{7,}$/.test(cell.text)
        if (!isTicketCell) continue

        const ticketNum = cell.text
        // FastReport sometimes repeats sections across pages; dedupe so a
        // ticket that appears twice in the HTML doesn't get double-counted.
        if (seenTicketNums.has(ticketNum)) continue
        seenTicketNums.add(ticketNum)

        const top = cell.top
        const page = cell.page

        const truckNum = cleanIdentifier(findOnSameRow(cells, page, top, TRUCK_NUM_LEFT)?.text)
        const orderNum = cleanIdentifier(findOnSameRow(cells, page, top, ORDER_NUM_LEFT)?.text)
        const customer = (findOnSameRow(cells, page, top, CUSTOMER_LEFT, 8)?.text || '').trim()

        const timesTop = top + TIMES_ROW_OFFSET
        const ticketTime = cleanTime(findOnSameRow(cells, page, timesTop, TKT_TIME_LEFT, 8)?.text)
        const loadedTime = cleanTime(findOnSameRow(cells, page, timesTop, LOADED_TIME_LEFT, 8)?.text)

        tickets.push({
            customer,
            driverName: currentDriverName,
            driverNum: currentDriverNum,
            loadedTime,
            orderNum,
            plantCode,
            ticketNum,
            ticketTime,
            truckNum
        })
    }

    return { plantCode, tickets }
}
