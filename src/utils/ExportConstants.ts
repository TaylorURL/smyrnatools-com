/**
 * Shared constants for the Excel export pipeline — color palette, font name,
 * workbook metadata, column lists for report queries, and the empty result
 * sentinel returned when a week window cannot be resolved.
 */

export const LOCALE_COMPARE_OPTIONS = { numeric: true, sensitivity: 'base' }
export const REPORT_COLUMNS_FULL = 'id,data,week,submitted_at,report_date_range_start,completed'
export const REPORT_COLUMNS_SHORT = 'id,data,week,submitted_at,completed'
export const FONT_CALIBRI = 'Calibri'
export const WORKBOOK_CREATOR = 'Smyrna Ready Mix'
export const SITE_URL = 'https://smyrnatools.com'
export const EMPTY_WEEK_RESULT = { reports: [], targetMondayIso: '' }

export const COLORS = {
    accent: 'FF4B7BA8',
    brand: 'FF2C4A6B',
    brandLight: 'FF3B5F8A',
    cream: 'FFF8F9FA',
    danger: 'FFB93A3A',
    dangerLight: 'FFF5D9D9',
    slate100: 'FFD0D4D8',
    slate200: 'FFC8CDD2',
    slate300: 'FFB5BBC2',
    slate500: 'FF8B949E',
    slate700: 'FF5A6672',
    slate900: 'FF2D3748',
    snow: 'FFE0E3E6',
    subtleGray: 'FFE8EAED',
    success: 'FF2D7A5F',
    successLight: 'FFD4E8E0',
    warning: 'FFCA8A2B',
    white: 'FFFFFFFF'
}
