/** Monday-anchored ISO normalization for weekly reports. */
const ReportUtility = {
    getMondayISO(dateInput) {
        const monday = mondayOf(dateInput || new Date())
        return monday ? monday.toISOString().slice(0, 10) : ''
    }
}

function mondayOf(dateInput) {
    const d = dateInput instanceof Date ? new Date(dateInput) : new Date(dateInput)
    if (isNaN(d.getTime())) return null
    const day = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((day + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    return monday
}

export default ReportUtility
export { ReportUtility }
