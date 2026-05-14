/* eslint-disable react/forbid-dom-props */
import React from 'react'

import { FIELD_STYLE, formatVerificationDate } from '../../constants/verificationModalConstants'
import LoadingScreen from '../common/LoadingScreen'
import { Banner, IconButton, Pill, Section } from './VerificationAtoms'

function CommentCard({ comment, onDelete, userNames }) {
    return (
        <div className="rounded p-2.5" style={FIELD_STYLE}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[10.5px] font-mono tabular-nums text-text-tertiary">
                    {formatVerificationDate(comment.createdAt)}
                </span>
                <IconButton
                    icon="fa-trash"
                    bg="#fee2e2"
                    fg="#b91c1c"
                    onClick={() => onDelete(comment.id)}
                    title="Delete comment"
                />
            </div>
            <div className="text-[12px] leading-snug text-text-primary">{comment.text}</div>
            {comment.author && userNames[comment.author] && (
                <div className="mt-1.5 flex items-center gap-1 text-[10.5px] text-text-secondary">
                    <i className="fas fa-user text-[9px]" />
                    {userNames[comment.author]}
                </div>
            )}
        </div>
    )
}

/** "Comments" section — read-only with delete actions. */
export default function VerificationCommentsSection({
    accentColor,
    comments,
    expanded,
    isLoadingComments,
    onDeleteComment,
    onToggle,
    userNames
}) {
    const pill =
        comments.length === 0 ? (
            <Pill bg="#dcfce7" fg="#166534">
                Complete
            </Pill>
        ) : (
            <Pill bg="#dbeafe" fg="#1e40af">
                {comments.length}
            </Pill>
        )

    return (
        <Section
            icon="fa-comments"
            title="Comments"
            accentColor={accentColor}
            expanded={expanded}
            onToggle={onToggle}
            pill={pill}
        >
            <Banner tone="warn" icon="fa-info-circle">
                Comments are shown for awareness only. Deleting them is optional.
            </Banner>
            {isLoadingComments ? (
                <LoadingScreen message="Loading comments..." inline={true} />
            ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-text-tertiary">
                    <i className="fas fa-info-circle text-2xl mb-1.5" />
                    <span className="text-[12px]">No comments</span>
                </div>
            ) : (
                <div className="flex flex-col gap-1.5">
                    {comments.map((comment) => (
                        <CommentCard
                            key={comment.id}
                            comment={comment}
                            onDelete={onDeleteComment}
                            userNames={userNames}
                        />
                    ))}
                </div>
            )}
        </Section>
    )
}
