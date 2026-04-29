-- Cache for live driving-time lookups so the same plant→job pair within a
-- given departure window doesn't re-hit the paid Distance Matrix API every
-- time the modal opens. Keyed by hashed origin/destination + a 15-min
-- departure bucket so traffic-aware results stay fresh enough.

CREATE TABLE IF NOT EXISTS travel_time_cache
(
    cache_key
    TEXT
    PRIMARY
    KEY,
    origin
    TEXT
    NOT
    NULL,
    destination
    TEXT
    NOT
    NULL,
    departure_bucket
    TIMESTAMPTZ
    NOT
    NULL,
    duration_seconds
    INTEGER
    NOT
    NULL,
    duration_in_traffic_seconds
    INTEGER,
    distance_meters
    INTEGER,
    provider
    TEXT
    NOT
    NULL
    DEFAULT
    'google',
    fetched_at
    TIMESTAMPTZ
    NOT
    NULL
    DEFAULT
    NOW
(
)
    );

CREATE INDEX IF NOT EXISTS travel_time_cache_fetched_at_idx
    ON travel_time_cache (fetched_at DESC);

CREATE
OR REPLACE FUNCTION purge_stale_travel_cache() RETURNS void AS $$
BEGIN
DELETE
FROM travel_time_cache
WHERE fetched_at < NOW() - INTERVAL '7 days';
END;
$$
LANGUAGE plpgsql;
