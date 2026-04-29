/**
 * Parses a Detail Order Analysis HTML export (FastReport output from the
 * dispatch system) into a per-order summary keyed by orderId, including the
 * full ticket list under each order.
 *
 * The dispatch system only accepts a single plant per request, so each report
 * file covers one plant. Callers fetch every plant file for a date and merge
 * the results — orderId is the join key against DailyOrder data.
 *
 * Output shape: [{ orderId, orderNum, ticketCount, loadedYardage, tickets }]
 *  - ticketCount: number of trucks loaded for the order so far
 *  - loadedYardage: sum of concrete-product quantities across all tickets
 *    (surcharges and other non-yardage line items are excluded)
 *  - tickets[]: { ticketId, ticketNum, truckNum, driverNum, ticketTime,
 *                  loadedTime, quantity }
 */

const QTY_LEFT = 463.05
const PRODUCT_CODE_LEFT = 94.5
const DESCRIPTION_LEFT = 226.8
// Per-ticket header / times row offsets, derived from the FastReport layout.
const TRUCK_LEFT = 236.25
const DRIVER_LEFT = 406.35
const PLANT_LEFT = 567 // "14003 - BAYTOWN A" cell — the truck's loading plant.
const TIMES_ROW_OFFSET = 47.25
const LOADED_TIME_LEFT = 89.77
const TICKET_TIME_LEFT = 0
const COLUMN_TOL = 6
const ROW_TOL = 4

/**
 * Maps the dispatch system's internal 5-digit plant code (e.g. "14003") to
 * the 3-digit DB code we use throughout the app (e.g. "403"). Mirrors the
 * heuristic in `DailyOrderParser.deriveCodeCandidates` so per-ticket plant
 * attribution stays consistent with the schedule's plant column.
 *
 * Returns the first non-empty candidate, or the original string if none apply.
 */
const normalizeDispatchPlantCode = (code) => {
    const c = String(code || '').trim()
    if (!c) return ''
    if (c.length === 5 && c[2] === '0') return c[1] + c.slice(3) // "14003" → "403"
    if (c.length >= 3 && c[1] === '0') return c[0] + c.slice(2) // "1403" → "143"
    if (c.length >= 3) return c.slice(2)
    return c
}

const extractPlantCodeFromCell = (cellText) => {
    if (!cellText) return ''
    const m = String(cellText).match(/^(\d{3,6})/)
    if (!m) return ''
    return normalizeDispatchPlantCode(m[1])
}

/**
 * Decides whether a product line is a surcharge / fee / non-yardage charge
 * that must be excluded from "loaded yards". The dispatch system uses
 * hyphenated codes (`SC-*`, `FU-*`, `EN-*`, `WT-*`, etc.) for every fee, and
 * concrete-product codes are always pure alphanumeric (`30250`, `4500SP`).
 *
 * The description-keyword check is a safety net for one-off codes that
 * happen to lack a hyphen — without it, a "FUEL" line at 1.00 would land
 * on a real ticket as +1 yard and silently inflate the loaded total.
 */
const isSurchargeProduct = (code, description) => {
    const c = String(code || '').trim()
    if (!c) return true
    if (c.includes('-')) return true
    const d = String(description || '').toUpperCase()
    if (!d) return false
    return /SURCHARGE|FUEL|ENVIRONMENT|FREIGHT|ADMIN|HAUL|MIN(IMUM)?\s*LOAD|WASH(\s|OUT)|OVERTIME|RETAIN|RETURN|STAND[\s-]?BY|FEE\b/.test(
        d
    )
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

const findCellText = (positionedDivs, targetLeft, targetTop, leftTol = COLUMN_TOL, topTol = ROW_TOL) => {
    const match = positionedDivs.find(
        (d) => Math.abs(d.left - targetLeft) <= leftTol && Math.abs(d.top - targetTop) <= topTol && d.text.length > 0
    )
    return match?.text || ''
}

const getAnchorTop = (anchor) => {
    const inner = anchor.querySelector('div')
    const style = inner?.getAttribute('style') || anchor.getAttribute('style') || ''
    const m = style.match(/top:\s*([\d.]+)/)
    return m ? parseFloat(m[1]) : null
}

export function parseDetailOrderHtml(htmlString) {
    if (!htmlString || typeof htmlString !== 'string') return []

    const doc = new DOMParser().parseFromString(htmlString, 'text/html')
    const orderAnchors = [...doc.querySelectorAll('a[href*="/orders/audit/"]')]
    if (!orderAnchors.length) return []

    const ticketAnchors = [...doc.querySelectorAll('a[href*="/ticketing/edit-tickets/"]')]
    const positionedDivs = parsePositionedDivs(doc)

    // DOCUMENT_POSITION_PRECEDING (= 2) is set on the bitmask returned by
    // `caller.compareDocumentPosition(arg)` when `arg` precedes `caller`.
    // i.e. `precedes(a, b)` is true when `b` precedes `a` in the DOM.
    const precedes = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING) !== 0
    // True when `el` falls between `startEl` (exclusive) and `endEl` (exclusive).
    const inRange = (el, startEl, endEl) => {
        if (!precedes(el, startEl)) return false
        if (!endEl) return true
        return precedes(endEl, el)
    }

    /** Sum every quantity cell whose row also has a non-surcharge product
     *  code, between two DOM-order anchors. Order-level use passes order
     *  anchors; per-ticket use passes ticket anchors. */
    const sumQuantitiesBetween = (startEl, endEl) => {
        let total = 0
        for (const cell of positionedDivs) {
            if (Math.abs(cell.left - QTY_LEFT) > COLUMN_TOL) continue
            if (!inRange(cell.el, startEl, endEl)) continue
            const qty = parseFloat(cell.text.replace(/,/g, ''))
            if (!Number.isFinite(qty) || qty <= 0) continue
            const productRow = positionedDivs.find(
                (d) =>
                    Math.abs(d.left - PRODUCT_CODE_LEFT) <= COLUMN_TOL &&
                    Math.abs(d.top - cell.top) <= ROW_TOL &&
                    d.text.length > 0
            )
            const code = productRow?.text || ''
            if (!code) continue
            const descriptionRow = positionedDivs.find(
                (d) =>
                    Math.abs(d.left - DESCRIPTION_LEFT) <= COLUMN_TOL &&
                    Math.abs(d.top - cell.top) <= ROW_TOL &&
                    d.text.length > 0
            )
            if (isSurchargeProduct(code, descriptionRow?.text)) continue
            total += qty
        }
        return total
    }

    const result = []
    for (let i = 0; i < orderAnchors.length; i++) {
        const orderAnchor = orderAnchors[i]
        const nextOrderAnchor = orderAnchors[i + 1] || null

        const orderId = (orderAnchor.getAttribute('href') || '').match(/\/orders\/audit\/(\d+)/)?.[1]
        if (!orderId) continue
        const orderNum = orderAnchor.querySelector('div')?.textContent.trim() || ''

        // Tickets that fall between this order anchor and the next, in DOM
        // order — preserved by `querySelectorAll` so a simple filter is fine.
        const orderTickets = ticketAnchors.filter((t) => inRange(t, orderAnchor, nextOrderAnchor))
        const tickets = []
        for (let j = 0; j < orderTickets.length; j++) {
            const ticketAnchor = orderTickets[j]
            const nextBoundary = orderTickets[j + 1] || nextOrderAnchor
            const ticketId =
                (ticketAnchor.getAttribute('href') || '').match(/\/ticketing\/edit-tickets\/(\d+)/)?.[1] || ''
            const ticketNum = ticketAnchor.querySelector('div')?.textContent.trim() || ''
            const ticketTop = getAnchorTop(ticketAnchor)
            const timesTop = Number.isFinite(ticketTop) ? ticketTop + TIMES_ROW_OFFSET : null
            const truckNum = Number.isFinite(ticketTop) ? findCellText(positionedDivs, TRUCK_LEFT, ticketTop, 8) : ''
            const driverNum = Number.isFinite(ticketTop) ? findCellText(positionedDivs, DRIVER_LEFT, ticketTop, 8) : ''
            const ticketTime = timesTop != null ? findCellText(positionedDivs, TICKET_TIME_LEFT, timesTop, 8) : ''
            const loadedTime = timesTop != null ? findCellText(positionedDivs, LOADED_TIME_LEFT, timesTop, 8) : ''
            // Loading plant text on the ticket header row, e.g. "14003 - BAYTOWN A".
            // We extract the leading numeric code and normalize to the 3-digit DB
            // code used throughout the app — this is the plant that actually
            // loaded the truck, which can differ from the file's intPlantId
            // (Baytown 403/404, Conroe 408/409 share trucks).
            const plantCellText = Number.isFinite(ticketTop)
                ? findCellText(positionedDivs, PLANT_LEFT, ticketTop, 12)
                : ''
            const loadedPlantCode = extractPlantCodeFromCell(plantCellText)
            const quantity = sumQuantitiesBetween(ticketAnchor, nextBoundary)
            tickets.push({
                driverNum,
                loadedPlantCode,
                loadedTime,
                quantity,
                ticketId,
                ticketNum,
                ticketTime,
                truckNum
            })
        }

        // Order-level loaded yardage is the sum of per-ticket quantities,
        // not a separate scan over the whole order range. A whole-range scan
        // can pick up phantom cells in the order's summary block (the
        // "Order Averages" footer or stray non-ticket product lines), which
        // makes the schedule's "Loaded / Total" column disagree with the
        // ticket modal — sum-of-tickets keeps both views in lockstep.
        const loadedYardage = tickets.reduce((sum, t) => sum + (t.quantity || 0), 0)
        result.push({
            loadedYardage,
            orderId,
            orderNum,
            ticketCount: orderTickets.length,
            tickets
        })
    }

    return result
}
