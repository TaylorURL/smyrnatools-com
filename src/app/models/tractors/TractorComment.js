import { createAssetComment } from '../createAssetComment'

/** Tractor comment record with snake_case API mapping. */
export const TractorComment = createAssetComment({
    foreignKey: 'tractorId',
    foreignKeyColumn: 'tractor_id'
})
