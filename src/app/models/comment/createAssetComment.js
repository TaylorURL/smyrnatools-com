/**
 * Factory for asset-comment domain models (MixerComment, TractorComment,
 * EquipmentComment, ...). Each asset's comment row has the same shape — an
 * id, author, text, createdAt, plus a single FK to the parent asset. The
 * only thing that varies is the FK field name in API responses.
 *
 * @param {Object} config
 * @param {string} config.foreignKey       - camelCase instance property (e.g. 'mixerId')
 * @param {string} config.foreignKeyColumn - snake_case DB column (e.g. 'mixer_id')
 * @returns A class exposing a constructor, static fromRow(), and toRow().
 */
export function createAssetComment({ foreignKey, foreignKeyColumn }) {
    class AssetComment {
        constructor(data = {}) {
            this.id = data.id ?? null
            this[foreignKey] = data[foreignKeyColumn] ?? ''
            this.text = data.text ?? ''
            this.author = data.author ?? ''
            this.permanent = data.permanent === true
            const resolved = data.resolved_at ?? data.resolvedAt ?? null
            this.resolvedAt = typeof resolved === 'string' && !isNaN(Date.parse(resolved)) ? resolved : null
            this.autoResolved = (data.auto_resolved ?? data.autoResolved) === true
            const created = data.created_at
            this.createdAt =
                typeof created === 'string' && !isNaN(Date.parse(created)) ? created : new Date().toISOString()
        }

        static fromRow(row) {
            if (!row) return null
            return new AssetComment(row)
        }

        toRow() {
            return {
                author: this.author,
                created_at: this.createdAt,
                [foreignKeyColumn]: this[foreignKey],
                id: this.id,
                permanent: this.permanent,
                auto_resolved: this.autoResolved,
                resolved_at: this.resolvedAt,
                text: this.text
            }
        }
    }

    return AssetComment
}
