-- Pinpoint coordinates for plant 455 (51 Champion Woodyard Rd, Huntsville, TX).
-- OSM doesn't have the street indexed, so the geocoder was falling back to
-- the city centre — these authoritative coords override that and place the
-- marker exactly at the yard.

update public.plants
set latitude  = 30.723526,
    longitude = -95.550777
where plant_code = '455';
