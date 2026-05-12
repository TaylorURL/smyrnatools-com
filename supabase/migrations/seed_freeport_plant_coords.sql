-- Pinpoint coordinates for the Freeport plant
-- (2101 Oyster Creek Bend, Freeport, TX). OSM doesn't have the street
-- indexed cleanly, so the geocoder falls back to city centre / fails —
-- these authoritative coords override that and place the marker exactly
-- at the yard.
--
-- Run the SELECT first to confirm exactly one row matches before the
-- UPDATE. If multiple plants match, switch the WHERE to the specific
-- plant_code.

-- Verify match:
-- select plant_code, plant_name, plant_address from public.plants
-- where plant_address ilike '%oyster creek bend%' or plant_name ilike '%freeport%';

update public.plants
set latitude  = 28.996666,
    longitude = -95.331642
where plant_address ilike '%oyster creek bend%'
   or plant_name    ilike '%freeport%';
