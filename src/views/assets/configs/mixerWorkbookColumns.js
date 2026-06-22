import {
    MIXER_CLEANLINESS_LABELS,
    MIXER_SHOP_STATUS_OPTIONS
} from '../../../app/constants/mixerDetailConstants'
import DateUtility from '../../../utils/DateUtility'

const SHOP_STATUS_LABEL_MAP = Object.fromEntries(
    MIXER_SHOP_STATUS_OPTIONS.map(({ label, value }) => [value, label])
)

function resolveOperatorName(employeeId, _row, lookups) {
    if (!employeeId) return { display: 'Unassigned', sortValue: '' }
    const operator = lookups?.operators?.find((op) => op.employeeId === employeeId)
    return {
        display: operator?.name || 'Unknown',
        sortValue: operator?.name?.toLowerCase() || ''
    }
}

function resolvePlantName(plantCode, _row, lookups) {
    if (!plantCode) return { display: '—', sortValue: '' }
    const plant = lookups?.plants?.find(
        (p) => p.plantCode === plantCode || p.plant_code === plantCode
    )
    return {
        display: plant?.plantName || plant?.plant_name || plantCode,
        sortValue: (plant?.plantName || plant?.plant_name || plantCode).toLowerCase()
    }
}

function resolveStatus(status, row) {
    if (status === 'In Shop' && row.shopStatus) {
        const subLabel = SHOP_STATUS_LABEL_MAP[row.shopStatus]
        return {
            display: subLabel || 'In Shop',
            sortValue: subLabel?.toLowerCase() || 'in shop'
        }
    }
    return status || '—'
}

function resolveCleanlinessRating(rating) {
    if (rating == null || rating === 0) return { display: 'Not Rated', sortValue: 0 }
    const label = MIXER_CLEANLINESS_LABELS[rating]
    return {
        display: label ? `${rating} — ${label}` : String(rating),
        sortValue: rating
    }
}

function formatDateColumn(dateStr) {
    if (!dateStr) return { display: '—', sortValue: '' }
    return {
        display: DateUtility.formatDate(dateStr),
        sortValue: dateStr
    }
}

function formatDateTimeColumn(dateStr) {
    if (!dateStr) return { display: '—', sortValue: '' }
    return {
        display: DateUtility.formatDateTime(dateStr),
        sortValue: dateStr
    }
}

function formatHours(hours) {
    if (hours == null || !Number.isFinite(hours)) return { display: '—', sortValue: -1 }
    return {
        display: hours.toLocaleString(),
        sortValue: hours
    }
}

function formatBoolean(val) {
    if (val === true) return 'Yes'
    if (val === false) return 'No'
    return '—'
}

function formatYear(year) {
    if (!year) return '—'
    return String(year)
}

function formatVin(vin) {
    if (!vin) return '—'
    return vin.toUpperCase()
}

export const MIXER_WORKBOOK_COLUMNS = [
    { header: 'Truck #', key: 'truckNumber', minWidth: 90 },
    {
        header: 'Plant',
        key: 'assignedPlant',
        minWidth: 140,
        transform: resolvePlantName
    },
    {
        header: 'Status',
        key: 'status',
        minWidth: 130,
        transform: resolveStatus
    },
    {
        header: 'Operator',
        key: 'assignedOperator',
        minWidth: 160,
        transform: resolveOperatorName
    },
    {
        header: 'Cleanliness',
        key: 'cleanlinessRating',
        minWidth: 120,
        transform: resolveCleanlinessRating
    },
    {
        header: 'Hours',
        key: 'hours',
        minWidth: 90,
        transform: formatHours
    },
    {
        header: 'VIN',
        key: 'vin',
        minWidth: 170,
        transform: formatVin
    },
    { header: 'Make', key: 'make', minWidth: 100 },
    { header: 'Model', key: 'model', minWidth: 100 },
    {
        header: 'Year',
        key: 'year',
        minWidth: 70,
        transform: formatYear
    },
    {
        header: 'Last Service Date',
        key: 'lastServiceDate',
        minWidth: 150,
        transform: formatDateColumn
    },
    {
        header: 'Last Chip Date',
        key: 'lastChipDate',
        minWidth: 150,
        transform: formatDateColumn
    },
    {
        header: 'Shop Status',
        key: 'shopStatus',
        minWidth: 130,
        transform: (val) => {
            if (!val) return '—'
            return SHOP_STATUS_LABEL_MAP[val] || val
        }
    },
    {
        header: 'Status Changed',
        key: 'statusChangedAt',
        minWidth: 160,
        transform: formatDateTimeColumn
    },
    {
        header: 'Open Issues',
        key: 'openIssuesCount',
        minWidth: 90,
        transform: (val) => ({ display: val ?? 0, sortValue: val ?? 0 })
    },
    {
        header: 'Comments',
        key: 'commentsCount',
        minWidth: 90,
        transform: (val) => ({ display: val ?? 0, sortValue: val ?? 0 })
    },
    {
        header: 'Created',
        key: 'createdAt',
        minWidth: 160,
        transform: formatDateTimeColumn
    },
    {
        header: 'Updated',
        key: 'updatedAt',
        minWidth: 160,
        transform: formatDateTimeColumn
    },
    {
        header: 'Last Verified',
        key: 'updatedLast',
        minWidth: 160,
        transform: formatDateTimeColumn
    }
]
