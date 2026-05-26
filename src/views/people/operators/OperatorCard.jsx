import React from 'react'

import OperatorClockIndicator from '../../../app/components/common/OperatorClockIndicator'
import PhoneLink from '../../../app/components/common/PhoneLink'
import CardSection from '../../../app/components/sections/CardSection'
import DateUtility from '../../../utils/DateUtility'

/** Maps operator lifecycle statuses to their card accent colors. */
const STATUS_COLORS = {
    active: '#10b981',
    default: '#64748b',
    inactive: '#ef4444',
    terminated: '#6b7280'
}

/**
 * Grid-mode card for a single operator. Displays plant, status, employee ID,
 * phone, trainer badge, position, star rating, scheduled-off icon, and a
 * duplicate-name warning when applicable.
 */
function OperatorCard({
    operator,
    plantName,
    onSelect,
    onDelete: _onDelete,
    trainers,
    children,
    rating,
    isDuplicateName
}) {
    if (!operator) return null
    const statusColor = STATUS_COLORS[operator.status] || STATUS_COLORS.default
    let trainerName = 'None'
    if (operator.assignedTrainer && operator.assignedTrainer !== '0' && Array.isArray(trainers)) {
        const trainerObj = trainers.find((t) => t.employeeId === operator.assignedTrainer)
        trainerName = trainerObj ? trainerObj.name : 'Unknown'
    }
    const hasScheduledOff = Array.isArray(operator.daysOff) && operator.daysOff.length > 0
    const displayRating =
        typeof rating === 'number'
            ? rating
            : typeof operator.rating === 'number'
              ? operator.rating
              : Number(operator.rating) || 0
    return (
        <CardSection
            item={operator}
            itemType="Operator"
            itemNumber={
                <span className="inline-flex items-center gap-1.5">
                    <OperatorClockIndicator badge={operator.smyrnaId || operator.employeeId} size="md" />
                    {operator.name}
                </span>
            }
            onSelect={onSelect ? () => onSelect(operator) : undefined}
            statusColor={statusColor}
        >
            {hasScheduledOff && (
                <span className="absolute top-2 right-2 text-text-primary text-xs">
                    <i className="fas fa-calendar-alt"></i>
                </span>
            )}
            {isDuplicateName && (
                <i
                    className="fas fa-exclamation-triangle absolute top-2 right-8 text-text-primary text-xs"
                    title="Duplicate name"
                    aria-label="Duplicate name"
                ></i>
            )}
            {children}
            <div className="flex justify-between items-center py-1">
                <div className="text-sm text-text-secondary">Plant</div>
                <div className="text-sm font-medium">{plantName || 'None'}</div>
            </div>
            <div className="flex justify-between items-center py-1">
                <div className="text-sm text-text-secondary">Status</div>
                <div className="text-sm font-medium">{operator.status || 'Unknown'}</div>
            </div>
            <div className="flex justify-between items-center py-1">
                <div className="text-sm text-text-secondary">Employee ID</div>
                <div className="text-sm font-medium">{operator.smyrnaId || 'Not Assigned'}</div>
            </div>
            <div className="flex justify-between items-center py-1">
                <div className="text-sm text-text-secondary">Phone</div>
                <div className="text-sm font-medium">
                    {operator.phone ? <PhoneLink phone={operator.phone} /> : 'Not Set'}
                </div>
            </div>
            {operator.status === 'Pending Start' && (
                <div className="flex justify-between items-center py-1">
                    <div className="text-sm text-text-secondary">Pending Start Date</div>
                    <div className="text-sm font-medium">
                        {operator.pendingStartDate ? DateUtility.formatDate(operator.pendingStartDate) : 'Not Set'}
                    </div>
                </div>
            )}
            <div className="flex justify-between items-center py-1">
                <div className="text-sm text-text-secondary">Role</div>
                <div className="text-sm font-medium">
                    {operator.isTrainer ? (
                        <span className="bg-blue-100 text-text-primary text-xs font-semibold px-2 py-0.5 rounded">
                            Trainer
                        </span>
                    ) : (
                        'Operator'
                    )}
                </div>
            </div>
            {operator.position && (
                <div className="flex justify-between items-center py-1">
                    <div className="text-sm text-text-secondary">Position</div>
                    <div className="text-sm font-medium">{operator.position || 'Not Specified'}</div>
                </div>
            )}
            {!operator.isTrainer && operator.status !== 'Active' && (
                <div className="flex justify-between items-center py-1">
                    <div className="text-sm text-text-secondary">Trainer</div>
                    <div className="text-sm font-medium">{trainerName}</div>
                </div>
            )}
            <div className="flex justify-between items-center py-1">
                <div className="text-sm text-text-secondary">Rating</div>
                <div className="text-sm font-medium">
                    <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                            <i
                                key={i}
                                className={`fas fa-star ${i < displayRating ? 'text-text-primary' : 'text-border-light'}`}
                                aria-hidden="true"
                            ></i>
                        ))}
                    </div>
                </div>
            </div>
        </CardSection>
    )
}
export default OperatorCard
