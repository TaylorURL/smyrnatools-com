/**
 * Parses a Detail Order Analysis HTML export (FastReport output from the
 * dispatch system) into a per-order summary keyed by orderId.
 *
 * The dispatch system only accepts a single plant per request, so each report
 * file covers one plant. Callers fetch all 12 plant files for a date and merge
 * the results — orderId is the join key against DailyOrder data.
 *
 * Output shape: [{ orderId, orderNum, ticketCount, loadedYardage }]
 *  - ticketCount: number of trucks loaded for the order so far
 *  - loadedYardage: sum of concrete-product quantities across all tickets
 *    (surcharges and other non-yardage line items are excluded)
 */

const QTY_LEFT = 463.05
const PRODUCT_CODE_LEFT = 94.5
const COLUMN_TOL = 6
const ROW_TOL = 4

const parsePositionedDivs = (root) =>
    [...root.querySelectorAll('div')]
        .map((el) => {
            const style = el.getAttribute('style') || ''
            const leftMatch = style.match(/left:\s*([\d.]+)/)
            const topMatch = style.match(/top:\s*([\d.]+)/)
            return {
                el,
                left: leftMatch ? parseFloat(leftMatch[1]) : null,
                top: topMatch ? parseFloat(topMatch[1]) : null,
                text: el.textContent.trim()
            }
        })
        .filter((d) => d.left != null && d.top != null)

const isSurchargeCode = (code) => /^sc-/i.test(String(code || '').trim())

export function parseDetailOrderHtml(htmlString) {
    if (!htmlString || typeof htmlString !== 'string') return []

    const doc = new DOMParser().parseFromString(htmlString, 'text/html')
    const orderAnchors = [...doc.querySelectorAll('a[href*="/orders/audit/"]')]
    if (!orderAnchors.length) return []

    const ticketAnchors = [...doc.querySelectorAll('a[href*="/ticketing/edit-tickets/"]')]
    const positionedDivs = parsePositionedDivs(doc)

    const result = []
    for (let i = 0; i < orderAnchors.length; i++) {
        const anchor = orderAnchors[i]
        const next = orderAnchors[i + 1] || null

        const orderId = (anchor.getAttribute('href') || '').match(/\/orders\/audit\/(\d+)/)?.[1]
        if (!orderId) continue
        const orderNum = anchor.querySelector('div')?.textContent.trim() || ''

        // DOCUMENT_POSITION_PRECEDING = 2, DOCUMENT_POSITION_FOLLOWING = 4.
        const isAfterAnchor = (el) => (el.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_PRECEDING) !== 0
        const isBeforeNext = (el) =>
            !next || (el.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
        const inOrderRange = (el) => isAfterAnchor(el) && isBeforeNext(el)

        const ticketCount = ticketAnchors.filter(inOrderRange).length

        let loadedYardage = 0
        for (const cell of positionedDivs) {
            if (Math.abs(cell.left - QTY_LEFT) > COLUMN_TOL) continue
            if (!inOrderRange(cell.el)) continue
            const qty = parseFloat(cell.text.replace(/,/g, ''))
            if (!Number.isFinite(qty) || qty <= 0) continue

            // Match this quantity to its product code on the same row. The
            // Order Averages section also has numeric cells near this column
            // but lacks a product code at left ≈ 94.5, so requiring one
            // filters those rows out automatically.
            const productRow = positionedDivs.find(
                (d) =>
                    Math.abs(d.left - PRODUCT_CODE_LEFT) <= COLUMN_TOL &&
                    Math.abs(d.top - cell.top) <= ROW_TOL &&
                    d.text.length > 0
            )
            const code = productRow?.text || ''
            if (!code || isSurchargeCode(code)) continue
            loadedYardage += qty
        }

        result.push({ orderId, orderNum, ticketCount, loadedYardage })
    }

    return result
}
