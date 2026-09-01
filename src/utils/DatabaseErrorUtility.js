/** Formats a database error into a human-readable string with details, hint, and code. */
export const getDatabaseErrorDetails = (error) => {
    if (!error) return 'Unknown error'
    if (error.message) {
        if (error.details || error.hint || error.code) {
            return `${error.message}\nDetails: ${error.details || 'none'}\nHint: ${error.hint || 'none'}\nCode: ${error.code || 'none'}`
        }
        return error.message
    }
    try {
        return JSON.stringify(error)
    } catch {
        return 'Error object could not be stringified'
    }
}
/** Logs a database error with context label and full details to the console. */
export const logDatabaseError = (context, error) => {
    console.error(`Database error in ${context}:`, error)
    console.error('Details:', getDatabaseErrorDetails(error))
}
