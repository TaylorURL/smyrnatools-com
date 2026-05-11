/** Plant location record with code, display name, physical address, and
 *  optional latitude/longitude (consumed by the Plan → Map tab). */
export class Plant {
    constructor(data = {}) {
        this.plantCode = data.plant_code ?? ''
        this.plantName = data.plant_name ?? ''
        this.plantAddress = data.plant_address ?? ''
        this.latitude = data.latitude != null ? Number(data.latitude) : null
        this.longitude = data.longitude != null ? Number(data.longitude) : null
        this.createdAt = data.created_at ?? new Date().toISOString()
        this.updatedAt = data.updated_at ?? new Date().toISOString()
    }
    static fromRow(row) {
        if (!row) return null
        return new Plant(row)
    }
}
