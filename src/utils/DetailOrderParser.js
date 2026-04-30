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
 * Decides whether a product line should be COUNTED as concrete yardage.
 *
 * Inverted from the old "is this a surcharge?" gate because surcharge
 * detection alone misses non-concrete additive lines (FIBER, ICE, PUMP,
 * ACCEL, RETARD, COLOR, etc.) that have no hyphen and no surcharge keyword
 * in the description. Those additive lines have their own qty in the same
 * column as concrete and were silently inflating ticket totals (e.g. a
 * 10 yd concrete ticket reading as 11 because a 1-unit fiber line tagged
 * along).
 *
 * Real concrete-mix codes from the dispatch system are PSI ratings — at
 * least 4 leading digits, optionally followed by a short alpha suffix
 * (`30250`, `4500SP`, `350503500`). Anything that doesn't fit that shape
 * is treated as a non-concrete line and skipped from the yardage sum.
 *
 * Description fallback: if the code is hyphenated or starts with letters
 * but the description clearly says "CONCRETE", we still count it (rare
 * regional code variations).
 */
const CONCRETE_CODE_RE = /^\d{4,}[A-Z]{0,4}$/i
const SURCHARGE_DESC_RE =
    /SURCHARGE|FUEL|ENVIRONMENT|FREIGHT|ADMIN|HAUL|MIN(IMUM)?\s*LOAD|WASH(\s|OUT)|OVERTIME|RETAIN|RETURN|STAND[\s-]?BY|FEE\b/
const ADDITIVE_DESC_RE = /\b(FIBER|FIBR|ICE|PUMP|ACCEL|RETARD|COLOR|PIGMENT|AIR\s*ENT|ADMIX|ADDITIVE|FLY\s*ASH|SLAG)\b/

/** Hard blocklist of product descriptions that are categorically NOT concrete
 *  yardage. Any qty paired with a description matching this regex is dropped
 *  before any other concrete-detection logic runs — belt-and-suspenders for
 *  the surcharge filter so a fuel surcharge can never inflate loaded yards. */
const HARD_NON_YARDAGE_DESC_RE =
    /\b(ENVIRONMENTAL[\s\\/]+FUEL\s+SURCHARGE|FUEL\s+SURCHARGE|ENVIRONMENTAL\s+SURCHARGE|FUEL\s+CHARGE|ENV\s+CHARGE)\b/

const isConcreteProduct = (code, description) => {
    const c = String(code || '')
        .trim()
        .toUpperCase()
    const d = String(description || '').toUpperCase()
    if (!c) return false
    if (HARD_NON_YARDAGE_DESC_RE.test(d)) return false
    if (SURCHARGE_DESC_RE.test(d) || ADDITIVE_DESC_RE.test(d)) return false
    if (CONCRETE_CODE_RE.test(c)) return true
    // Last-chance fallback for plants whose mix codes don't match the
    // numeric pattern but whose description explicitly says CONCRETE.
    if (/CONCRETE/.test(d) && !c.includes('-')) return true
    return false
}

// Field format validators — every per-ticket field has a known shape; if the
// position-based lookup falls through to a neighboring cell, these reject
// the garbage so we never display "SC-1015" or "Loaded" in the time/truck
// columns.
const HHMM_RE = /^\d{1,2}:\d{2}$/
const ALL_DIGITS_RE = /^\d+$/

const cleanTime = (text) => (HHMM_RE.test(String(text || '').trim()) ? String(text).trim() : '')
const cleanIdentifier = (text) => {
    const s = String(text || '').trim()
    return ALL_DIGITS_RE.test(s) ? s : ''
}

/** Returns the FastReport page wrapper (`<div class="frpageN">`) that
 *  contains this element, or null if the element isn't inside a page. Each
 *  page has its own absolute-positioned coordinate system, so position-based
 *  lookups MUST be scoped per page — otherwise top=103.95 on page 4 collides
 *  with top=103.95 on page 1 and the wrong product code/description gets
 *  paired with the quantity. */
const getPageWrapper = (el) => el.closest('[class^="frpage"], [class*=" frpage"]')

const parsePositionedDivs = (root) =>
    [...root.querySelectorAll('div')]
        .map((el) => {
            const style = el.getAttribute('style') || ''
            const leftMatch = style.match(/left:\s*([\d.]+)/)
            const topMatch = style.match(/top:\s*([\d.]+)/)
            return {
                el,
                left: leftMatch ? parseFloat(leftMatch[1]) : null,
                page: getPageWrapper(el),
                text: el.textContent.trim(),
                top: topMatch ? parseFloat(topMatch[1]) : null
            }
        })
        .filter((d) => d.left != null && d.top != null)

const findCellText = (positionedDivs, targetLeft, targetTop, leftTol = COLUMN_TOL, topTol = ROW_TOL, page = null) => {
    const match = positionedDivs.find(
        (d) =>
            (!page || d.page === page) &&
            Math.abs(d.left - targetLeft) <= leftTol &&
            Math.abs(d.top - targetTop) <= topTol &&
            d.text.length > 0
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
     *  anchors; per-ticket use passes ticket anchors.
     *
     *  Code/desc lookups are scoped to BOTH the same FastReport page wrapper
     *  AND the same DOM range as the qty cell. Page scoping alone isn't
     *  enough: a single page can contain multiple tickets, and product rows
     *  on different tickets within the same page can still share top values.
     *  Adding the DOM-range check ensures the code/desc we pair with a qty
     *  belongs to the same ticket (or order) that the qty is being attributed
     *  to.
     */
    const findRowMate = (cell, targetLeft, startEl, endEl) =>
        positionedDivs.find(
            (d) =>
                d.page === cell.page &&
                Math.abs(d.left - targetLeft) <= COLUMN_TOL &&
                Math.abs(d.top - cell.top) <= ROW_TOL &&
                d.text.length > 0 &&
                inRange(d.el, startEl, endEl)
        )

    const sumQuantitiesBetween = (startEl, endEl) => {
        let total = 0
        for (const cell of positionedDivs) {
            if (Math.abs(cell.left - QTY_LEFT) > COLUMN_TOL) continue
            if (!inRange(cell.el, startEl, endEl)) continue
            const qty = parseFloat(cell.text.replace(/,/g, ''))
            if (!Number.isFinite(qty) || qty <= 0) continue
            const codeMate = findRowMate(cell, PRODUCT_CODE_LEFT, startEl, endEl)
            const code = codeMate?.text || ''
            if (!code) continue
            const descMate = findRowMate(cell, DESCRIPTION_LEFT, startEl, endEl)
            if (!isConcreteProduct(code, descMate?.text)) continue
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
            // Scope every per-ticket field lookup to the same FastReport page
            // as the ticket's anchor — same coordinate-collision concern as
            // above. Without this, when a ticket starts near the top of a
            // new page, its truck/driver/times/plant cells get pulled from
            // an earlier page that happens to have content at the same top.
            const ticketPage = getPageWrapper(ticketAnchor)
            // Tighter leftTol on the times row (4 instead of 8) so the Loaded
            // column at left:89.77 can't bleed into the Product Code column
            // at left:94.5 when the dispatch report's times row is missing
            // for a cancelled/voided ticket — tol of 8 made the windows
            // overlap and let "SC-1015" land in the load-time field.
            const truckNum = Number.isFinite(ticketTop)
                ? cleanIdentifier(findCellText(positionedDivs, TRUCK_LEFT, ticketTop, 6, ROW_TOL, ticketPage))
                : ''
            const driverNum = Number.isFinite(ticketTop)
                ? cleanIdentifier(findCellText(positionedDivs, DRIVER_LEFT, ticketTop, 6, ROW_TOL, ticketPage))
                : ''
            const ticketTime =
                timesTop != null
                    ? cleanTime(findCellText(positionedDivs, TICKET_TIME_LEFT, timesTop, 4, ROW_TOL, ticketPage))
                    : ''
            const loadedTime =
                timesTop != null
                    ? cleanTime(findCellText(positionedDivs, LOADED_TIME_LEFT, timesTop, 4, ROW_TOL, ticketPage))
                    : ''
            // Loading plant text on the ticket header row, e.g. "14003 - BAYTOWN A".
            // We extract the leading numeric code and normalize to the 3-digit DB
            // code used throughout the app — this is the plant that actually
            // loaded the truck, which can differ from the file's intPlantId
            // (Baytown 403/404, Conroe 408/409 share trucks).
            const plantCellText = Number.isFinite(ticketTop)
                ? findCellText(positionedDivs, PLANT_LEFT, ticketTop, 12, ROW_TOL, ticketPage)
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
