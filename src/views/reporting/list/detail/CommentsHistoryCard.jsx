import React from 'react'

import DetailViewSection from '../../../../app/components/sections/DetailViewSection'
import { ListService } from '../../../../services/ListService'
import GrammarUtility from '../../../../utils/GrammarUtility'

function CommentsHistoryCard({ canEdit, canEditList, completer, creator, formData, item, setFormData }) {
    const handleChange = (e) => setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    return (
        <DetailViewSection.Card title="Comments & History" icon="fas fa-comment-alt">
            <div className="form-group">
                <label htmlFor="comments">Comments</label>
                <textarea
                    id="comments"
                    name="comments"
                    value={formData.comments}
                    onChange={handleChange}
                    onBlur={() =>
                        setFormData((prev) => ({
                            ...prev,
                            comments: GrammarUtility.cleanComments(prev.comments)
                        }))
                    }
                    disabled={!canEdit || !canEditList}
                    className="form-control"
                    rows="4"
                />
            </div>
            <div className="form-group">
                <label>Created By</label>
                <input
                    type="text"
                    value={creator ? `${creator.first_name} ${creator.last_name}` : 'Unknown'}
                    disabled
                    className="form-control"
                />
            </div>
            <div className="form-group">
                <label>Created On</label>
                <input type="text" value={ListService.formatDate(item.created_at)} disabled className="form-control" />
            </div>
            {item.completed && (
                <>
                    <div className="form-group">
                        <label>Completed By</label>
                        <input
                            type="text"
                            value={completer ? `${completer.first_name} ${completer.last_name}` : 'Unknown'}
                            disabled
                            className="form-control"
                        />
                    </div>
                    <div className="form-group">
                        <label>Completed On</label>
                        <input
                            type="text"
                            value={ListService.formatDate(item.completed_at)}
                            disabled
                            className="form-control"
                        />
                    </div>
                </>
            )}
        </DetailViewSection.Card>
    )
}

export default CommentsHistoryCard
