import DetailViewSection from '../../../../app/components/sections/DetailViewSection'
import GrammarUtility from '../../../../utils/GrammarUtility'
import { RATING_LABELS } from './operatorDetailConstants'

/**
 * Basic information section: employee id / name / phone fields and the
 * rating star control + automatic-only CDL restriction toggle.
 */
function BasicInfoSection({
    automaticRestriction,
    canEditOperator,
    name,
    phone,
    rating,
    setAutomaticRestriction,
    setName,
    setPhone,
    setRating,
    setSmyrnaId,
    smyrnaId
}) {
    return (
        <DetailViewSection.Section id="basic" title="Basic Information" icon="fas fa-user">
            <DetailViewSection.Card title="Personal Details" icon="fas fa-id-card">
                <div className="flex flex-col gap-1.5">
                    <label>Employee ID</label>
                    <input
                        type="text"
                        value={smyrnaId}
                        onChange={(e) => setSmyrnaId(e.target.value)}
                        className="w-full rounded border border-border-light bg-bg-secondary px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-accent"
                        disabled={!canEditOperator}
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label>Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded border border-border-light bg-bg-secondary px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-accent"
                        disabled={!canEditOperator}
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label>Phone</label>
                    <input
                        type="tel"
                        value={GrammarUtility.formatPhone(phone)}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded border border-border-light bg-bg-secondary px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-accent"
                        placeholder="(555) 555-5555"
                        disabled={!canEditOperator}
                    />
                </div>
            </DetailViewSection.Card>
            <DetailViewSection.Card title="Rating" icon="fas fa-star">
                <div className="flex flex-col gap-1.5">
                    <label>Rating</label>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    className={`p-1 bg-transparent border-none text-xl transition-colors ${!canEditOperator ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                    onClick={() => canEditOperator && setRating(star === rating ? 0 : star)}
                                    aria-label={`Rate ${star} of 5 stars`}
                                    disabled={!canEditOperator}
                                >
                                    <i
                                        className={`fas fa-star ${star <= rating ? 'text-text-primary' : 'text-border-light'}`}
                                    ></i>
                                </button>
                            ))}
                        </div>
                        {rating > 0 && (
                            <span className="text-sm font-medium text-text-secondary">{RATING_LABELS[rating]}</span>
                        )}
                    </div>
                </div>
                <div className="mt-2">
                    <label
                        className={`flex items-center gap-3 ${!canEditOperator ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        <div className="relative inline-flex items-center">
                            <input
                                type="checkbox"
                                checked={automaticRestriction}
                                onChange={(e) => {
                                    if (canEditOperator) {
                                        setAutomaticRestriction(e.target.checked)
                                    }
                                }}
                                disabled={!canEditOperator}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 rounded-full peer-checked:bg-accent transition-colors"></div>
                            <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5"></div>
                        </div>
                        <span className="text-sm font-medium text-text-primary">Automatic Only (CDL)</span>
                    </label>
                    <p className="text-xs text-text-secondary mt-2">
                        Enable this if the operator has a CDL restriction that only allows them to drive automatic
                        transmission trucks
                    </p>
                </div>
            </DetailViewSection.Card>
        </DetailViewSection.Section>
    )
}

export default BasicInfoSection
