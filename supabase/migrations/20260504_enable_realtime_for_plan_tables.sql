-- Enables Postgres logical-replication change events for the tables PlanView
-- subscribes to. Without this, `Database.channel(...).on('postgres_changes',
-- { table }, ...)` silently never fires — the WebSocket connects and the
-- channel reports SUBSCRIBED, but Postgres never publishes the change so
-- the JS handler never runs. PlanView ends up depending on the manual
-- refresh button + the 5-minute safety interval, which is what the user
-- saw.
--
-- `supabase_realtime` is the default publication Supabase's realtime
-- service consumes. We add the tables conditionally so re-running the
-- migration is a no-op (Postgres has no `ADD TABLE IF NOT EXISTS` syntax,
-- so we look up `pg_publication_tables` ourselves).

DO
$$
DECLARE
rel record;
BEGIN
FOR rel IN
SELECT unnest(ARRAY['dispatch_data', 'plans', 'plant_travel_times']) AS tablename
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = rel.tablename
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', rel.tablename);
RAISE
NOTICE 'Added public.% to supabase_realtime publication', rel.tablename;
ELSE
            RAISE NOTICE 'public.% already in supabase_realtime publication — skipped', rel.tablename;
END IF;
END LOOP;
END $$;
