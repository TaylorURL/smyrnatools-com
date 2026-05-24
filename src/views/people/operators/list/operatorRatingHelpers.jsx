import React from 'react'

const RATING_ELIGIBLE_STATUSES = ['Active', 'Light Duty', 'Training']

/** Renders the 5-star rating block or an italic "Not Rated" fallback. */
export const renderStars = (val) => {
    const rating = Math.round(Number(val) || 0)
    if (!rating || rating <= 0) {
        return <span className="text-text-secondary text-sm italic">Not Rated</span>
    }
    const stars = []
    for (let i = 1; i <= 5; i++) {
        stars.push(
            <i
                key={i}
                className={`fas fa-star text-base ${i <= rating ? 'text-text-primary' : 'text-border-light'} ${i < 5 ? 'mr-0.5' : ''}`}
            ></i>
        )
    }
    return <div className="flex items-center gap-0.5">{stars}</div>
}

/** Shows stars only for statuses where rating is meaningful; everyone else gets N/A. */
export const renderStarsOrNA = (operator) => {
    if (!RATING_ELIGIBLE_STATUSES.includes(operator.status)) {
        return <span className="text-text-secondary text-sm italic">N/A</span>
    }
    return renderStars(operator.rating)
}
