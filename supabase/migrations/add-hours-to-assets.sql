-- Adds an `hours` column to mixers, tractors, and heavy_equipment so that
-- service hours can be tracked alongside the existing service date / mileage
-- fields. Nullable because most existing records don't have an authoritative
-- value yet; backfill is done manually as crews verify each asset.

ALTER TABLE mixers
    ADD COLUMN IF NOT EXISTS hours NUMERIC;

ALTER TABLE tractors
    ADD COLUMN IF NOT EXISTS hours NUMERIC;

ALTER TABLE heavy_equipment
    ADD COLUMN IF NOT EXISTS hours NUMERIC;

-- Verification queries
SELECT id, truck_number, hours FROM mixers ORDER BY truck_number LIMIT 5;
SELECT id, truck_number, hours FROM tractors ORDER BY truck_number LIMIT 5;
SELECT id, identifying_number, hours FROM heavy_equipment ORDER BY identifying_number LIMIT 5;
