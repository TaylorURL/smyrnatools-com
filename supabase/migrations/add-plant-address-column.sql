-- Add a free-text street address column to the plants table.
-- Used by the Plan view to render plant -> job -> plant route maps and as a
-- starting point for driving-time estimates. Nullable because most plants
-- didn't have one before this migration.

ALTER TABLE plants
    ADD COLUMN IF NOT EXISTS plant_address TEXT;

-- Optional case-insensitive index — handy if a future geocoding cache keys
-- off the lowercased address. Safe to skip.
CREATE INDEX IF NOT EXISTS plants_plant_address_lower_idx
    ON plants ((lower(plant_address)))
    WHERE plant_address IS NOT NULL;

-- Verification query
SELECT plant_code, plant_name, plant_address
FROM plants
ORDER BY plant_code;
