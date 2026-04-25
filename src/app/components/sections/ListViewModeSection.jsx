import React from 'react'

import { useIsMobile } from '../../hooks/useIsMobile'

const BASE_ROW_DELAY_MS = 80
const MIN_ROW_DELAY_MS = 6
const DECAY_FACTOR = 0.88

/**
 * Computes cumulative animation delay for a row index using exponential decay.
 * Early rows cascade slowly; later rows arrive almost simultaneously.
 */
function getRowDelay(index) {
    let total = 0
    for (let i = 0; i < index; i++) {
        total += Math.max(MIN_ROW_DELAY_MS, BASE_ROW_DELAY_MS * Math.pow(DECAY_FACTOR, i))
    }
    return Math.round(total)
}

/**
 * Status badge — colors sourced from mixerConfig.statusBadgeClasses so the
 * list view reads identically to Fleet Overview / Schedule tab.
 */
const STATUS_BADGE_COLORS = {
    Active: 'bg-[#dcfce7] text-[#166534]',
    'Down In Yard': 'bg-[#fee2e2] text-[#dc2626]',
    'In Shop': 'bg-[#dbeafe] text-[#1e40af]',
    Spare: 'bg-[#f3e8ff] text-[#7c3aed]',
    'Third Party Work': 'bg-[#fef9c3] text-[#a16207]',
    'Waiting For Shop': 'bg-[#ffedd5] text-[#c2410c]'
}

/** Minimal row icon button — 20px tap target, no chrome, hover brightness. */
const RowIconButton = ({ icon, title, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        title={title}
        className="flex items-center justify-center w-5 h-5 rounded text-[11px] cursor-pointer border-none bg-transparent hover:brightness-90 transition-colors"
        style={{ color: 'var(--text-tertiary)' }}
    >
        <i className={`fas ${icon}`} />
    </button>
)

/**
 * Asset list — dense, single-line rows on a solid `var(--bg-primary)`
 * surface with hairline dividers. Tightened from the previous version:
 * cell padding 1.5/2.5 (was 2/3), 12px body (was 12.5px), 9.5px status
 * pills, 5×5 row icons. Hover darkens the row to `var(--bg-tertiary)`.
 */
function ListViewModeSection({
    filteredItems,
    operators,
    plants,
    handleSelectItem,
    renderRow,
    onShowCommentModal,
    onShowIssueModal,
    onShowHistoryModal,
    onVerify
}) {
    const isMobile = useIsMobile()
    const cellBase = 'text-[12px] font-medium text-left align-middle whitespace-nowrap py-1.5 px-2.5'
    const cellHighlight = `font-bold text-left align-middle whitespace-nowrap font-mono tabular-nums py-1.5 ${
        isMobile ? 'text-[12px] px-2' : 'text-[12.5px] px-2.5'
    }`
    const cellSecondary = `text-left align-middle whitespace-nowrap py-1.5 ${
        isMobile ? 'text-[11px] px-2' : 'text-[12px] px-2.5'
    }`

    const statusBadge = (status) => {
        const colors = STATUS_BADGE_COLORS[status] || 'bg-bg-tertiary text-text-secondary'
        return `inline-flex items-center rounded text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${colors}`
    }

    const verifyBtnClass = (isVerified) => {
        const colors = isVerified ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fef3c7] text-[#92400e] hover:brightness-95'
        const cursor = isVerified ? 'cursor-default' : 'cursor-pointer'
        return `inline-flex items-center gap-1 border-none rounded text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${cursor} ${colors}`
    }

    const wrapperClasses = `mb-5 ${isMobile ? 'mx-1 mt-2' : 'mx-4 lg:mx-6 mt-3'}`
    const containerStyle = {
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-light)',
        borderRadius: 6,
        overflow: 'hidden'
    }
    const containerClasses = `w-full overflow-x-auto box-border ${isMobile ? 'min-w-[1100px]' : ''}`

    if (!filteredItems || filteredItems.length === 0) {
        return (
            <div className={wrapperClasses} style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className={containerClasses} style={containerStyle}>
                    <div className="text-center py-6 px-4 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                        No items match the current filters.
                    </div>
                </div>
            </div>
        )
    }

    if (renderRow) {
        return (
            <div className={wrapperClasses} style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className={containerClasses} style={containerStyle}>
                    <table className="border-collapse w-full">
                        <tbody>
                            {filteredItems.map((item, index) => {
                                const row = renderRow(
                                    item,
                                    handleSelectItem,
                                    onShowCommentModal,
                                    onShowIssueModal,
                                    onVerify,
                                    onShowHistoryModal,
                                    index,
                                    'var(--bg-primary)'
                                )
                                return React.cloneElement(row, {
                                    className:
                                        `animate-slide-in-row hover:[&>td]:bg-bg-tertiary ${row.props.className || ''}`.trim(),
                                    key: row.key || item.id,
                                    style: {
                                        backgroundColor: 'var(--bg-primary)',
                                        borderBottom: '1px solid var(--border-light)',
                                        cursor: 'pointer',
                                        animationDelay: `${getRowDelay(index)}ms`,
                                        ...row.props.style
                                    }
                                })
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }

    const renderStars = (rating) => {
        if (!rating) {
            return (
                <span className="text-[10px] italic" style={{ color: 'var(--text-tertiary)' }}>
                    —
                </span>
            )
        }
        const stars = []
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <i
                    key={i}
                    className="fas fa-star text-[9px]"
                    style={{ color: i <= rating ? '#f59e0b' : 'var(--bg-tertiary)' }}
                />
            )
        }
        return <div className="flex items-center gap-px">{stars}</div>
    }

    return (
        <div className={wrapperClasses} style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className={containerClasses} style={containerStyle}>
                <table className="border-collapse w-full">
                    <tbody>
                        {filteredItems.map((item, index) => {
                            const operator = operators?.find((op) => op.employeeId === item.assignedOperator)
                            const plant = plants?.find((p) => p.code === item.assignedPlant)
                            const number = item.identifyingNumber || item.truckNumber || item.trailerNumber || ''
                            const isVerified = typeof item.isVerified === 'function' ? item.isVerified() : item.verified
                            return (
                                <tr
                                    key={item.id}
                                    className="animate-slide-in-row cursor-pointer hover:[&>td]:bg-bg-tertiary"
                                    style={{
                                        animationDelay: `${getRowDelay(index)}ms`,
                                        backgroundColor: 'var(--bg-primary)',
                                        borderBottom: '1px solid var(--border-light)'
                                    }}
                                    onClick={() => handleSelectItem(item.id)}
                                >
                                    <td className={cellBase} style={{ color: 'var(--text-primary)' }}>
                                        {plant?.name || item.assignedPlant || '—'}
                                    </td>
                                    <td className={cellHighlight} style={{ color: 'var(--text-primary)' }}>
                                        {item.truckNumber || item.trailerNumber || '—'}
                                    </td>
                                    <td className={cellSecondary} style={{ color: 'var(--text-secondary)' }}>
                                        <span className={statusBadge(item.status)}>{item.status}</span>
                                    </td>
                                    <td className={cellSecondary} style={{ color: 'var(--text-secondary)' }}>
                                        {operator?.name || (
                                            <span className="italic" style={{ color: 'var(--text-tertiary)' }}>
                                                —
                                            </span>
                                        )}
                                    </td>
                                    <td className={cellSecondary}>{renderStars(item.cleanlinessRating)}</td>
                                    <td className={cellSecondary} style={{ color: 'var(--text-secondary)' }}>
                                        {item.vinNumber || item.vin ? (
                                            <span
                                                className="rounded font-mono text-[10.5px] py-0.5 px-1 tabular-nums"
                                                style={{
                                                    background: 'var(--bg-tertiary)',
                                                    color: 'var(--text-secondary)'
                                                }}
                                            >
                                                {item.vinNumber || item.vin}
                                            </span>
                                        ) : (
                                            <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                                        )}
                                    </td>
                                    <td className={cellSecondary}>
                                        {item.status === 'Retired' ? (
                                            <span
                                                className="inline-flex items-center rounded text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5"
                                                style={{
                                                    background: 'var(--bg-tertiary)',
                                                    color: 'var(--text-tertiary)'
                                                }}
                                            >
                                                N/A
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    if (!isVerified && onVerify) {
                                                        onVerify(item.id, number)
                                                    }
                                                }}
                                                title={isVerified ? 'Verified' : 'Click to verify'}
                                                className={verifyBtnClass(isVerified)}
                                                disabled={isVerified}
                                            >
                                                <i
                                                    className={`fas ${
                                                        isVerified ? 'fa-check-circle' : 'fa-exclamation-circle'
                                                    } text-[8px]`}
                                                />
                                                <span>{isVerified ? 'Verified' : 'Verify'}</span>
                                            </button>
                                        )}
                                    </td>
                                    <td className={cellSecondary}>
                                        <div className="flex items-center gap-0.5">
                                            <RowIconButton
                                                icon="fa-comment"
                                                title="Comments"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onShowCommentModal && onShowCommentModal(item.id, number)
                                                }}
                                            />
                                            <RowIconButton
                                                icon="fa-wrench"
                                                title="Issues"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onShowIssueModal && onShowIssueModal(item.id, number)
                                                }}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default ListViewModeSection
