-- Adds optional geographic coordinates to plants. The Plan -> Map tab uses
-- them when present to render plants at real-world relative positions;
-- when null, the map falls back to deterministic synthetic placement
-- derived from the plant code so the view still works on day one.

alter table public.plants
    add column if not exists latitude double precision,
    add column if not exists longitude double precision;

create index if not exists idx_plants_lat_lng
    on public.plants (latitude, longitude)
    where latitude is not null and longitude is not null;
