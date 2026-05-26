import React from 'react'

import DetailViewSection from '../../../../app/components/sections/DetailViewSection'

const RATING_LABELS = [null, 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

/**
 * Star-rating editor card for trailer cleanliness. Tapping the current value
 * clears the rating; tapping any other star sets it.
 */
export default function TrailerCleanlinessCard({ cleanlinessRating, onCleanlinessRatingChange, canEditTrailer }) {
    return (
        <DetailViewSection.Card title="Cleanliness Rating" icon="fas fa-broom">
            <div className="form-group">
                <label>Cleanliness Rating</label>
                <div className="cleanliness-rating-editor">
                    <div className="star-input">
                        {[1, 2, 3, 4, 5].map((star) => {
                            const isLit = star <= cleanlinessRating
                            return (
                                <button
                                    key={star}
                                    type="button"
                                    className={`star-button ${isLit ? 'active' : ''} ${!canEditTrailer ? 'disabled' : ''} rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-transform duration-150 ease-out active:scale-[0.97] disabled:active:scale-100 motion-reduce:transition-none`}
                                    onClick={() =>
                                        canEditTrailer &&
                                        onCleanlinessRatingChange(star === cleanlinessRating ? 0 : star)
                                    }
                                    aria-label={`Rate ${star} of 5 stars`}
                                    aria-pressed={isLit}
                                    disabled={!canEditTrailer}
                                >
                                    <i className={`fas fa-star ${isLit ? 'filled !text-text-primary' : ''}`} />
                                </button>
                            )
                        })}
                    </div>
                    {cleanlinessRating > 0 && (
                        <div className="rating-value-display">
                            <span className="rating-label">{RATING_LABELS[cleanlinessRating]}</span>
                        </div>
                    )}
                </div>
            </div>
        </DetailViewSection.Card>
    )
}
