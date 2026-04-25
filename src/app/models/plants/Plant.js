/** Plant location record with code, display name, and physical address. */
export class Plant {
    constructor(data = {}) {
        this.plantCode = data.plant_code ?? ''
        this.plantName = data.plant_name ?? ''
        this.plantAddress = data.plant_address ?? ''
        this.createdAt = data.created_at ?? new Date().toISOString()
        this.updatedAt = data.updated_at ?? new Date().toISOString()
    }
    static fromRow(row) {
        if (!row) return null
        return new Plant(row)
    }
}
