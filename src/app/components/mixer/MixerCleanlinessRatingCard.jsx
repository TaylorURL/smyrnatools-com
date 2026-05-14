/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { MIXER_CLEANLINESS_LABELS } from '../../constants/mixerDetailConstants'
import DetailViewSection from '../sections/DetailViewSection'

const STARS = [1, 2, 3, 4, 5]
const ACTIVE_STAR_STYLE = { color: '#f59e0b' }

/** Star-rating selector. Clicking a lit star toggles it off (sets to 0). */
export default function MixerCleanlinessRatingCard({ canEditMixer, cleanlinessRating, setCleanlinessRating }) {
    return (
        <DetailViewSection.Card title="Cleanliness Rating" icon="fas fa-broom">
            <div className="form-group">
                <label>Cleanliness Rating</label>
                <div className="cleanliness-rating-editor">
                    <div className="star-input">
                        {STARS.map((star) => {
                            const isActive = star <= cleanlinessRating
                            return (
                                <button
                                    key={star}
                                    type="button"
                                    className={`star-button ${isActive ? 'active' : ''} ${!canEditMixer ? 'disabled' : ''}`}
                                    onClick={() =>
                                        canEditMixer && setCleanlinessRating(star === cleanlinessRating ? 0 : star)
                                    }
                                    aria-label={`Rate ${star} of 5 stars`}
                                    disabled={!canEditMixer}
                                >
                                    <i
                                        className={`fas fa-star ${isActive ? 'filled' : ''}`}
                                        style={isActive ? ACTIVE_STAR_STYLE : {}}
                                    ></i>
                                </button>
                            )
                        })}
                    </div>
                    {cleanlinessRating > 0 && (
                        <div className="rating-value-display">
                            <span className="rating-label">{MIXER_CLEANLINESS_LABELS[cleanlinessRating]}</span>
                        </div>
                    )}
                </div>
            </div>
        </DetailViewSection.Card>
    )
}
