-- Replace `dispatch_upsert_data` with the conditional-merge behavior the
-- import code's comments already promise: a DetailDriver-only ticket row
-- carries a load-size *estimate* in its `quantity` column. That estimate
-- must never overwrite a real value already written by DetailOrderAnalysis,
-- which parses the actual delivered yardage from the per-plant detail HTML.
--
-- The previous version of this RPC was applied via the Studio (no
-- migration in the repo) and unconditionally clobbered `quantity` on every
-- upsert. Result: a 36-yd order with 4 confirmed tickets at 8/10/10/10
-- showed up as 10/10/10/10=40 in the modal, because the third-stage
-- DetailDriver pass overwrote the 8 with the 10-yd load-size estimate.
--
-- Rules implemented here:
--
--   1. `quantity` — incoming wins UNLESS the incoming row's only source
--      report is DetailDriver (estimate-only) AND the existing row already
--      has a non-null quantity (confirmed). In that case keep the existing.
--   2. `source_reports` — union of existing and incoming, deduplicated.
--   3. Every other column — coalesce(incoming, existing). Lets each report
--      pass contribute its own fields without nulling out values another
--      pass already wrote.
--   4. `updated_at` — bumped to `now()` on every successful upsert.

CREATE OR REPLACE FUNCTION dispatch_upsert_data(rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item jsonb;
    incoming_sources text[];
    incoming_is_estimate_only boolean;
    upserted_count integer := 0;
BEGIN
    IF rows IS NULL OR jsonb_typeof(rows) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'rows must be a JSON array';
    END IF;

    FOR item IN SELECT * FROM jsonb_array_elements(rows)
    LOOP
        incoming_sources := ARRAY(
            SELECT jsonb_array_elements_text(coalesce(item->'source_reports', '[]'::jsonb))
        );
        incoming_is_estimate_only :=
            'DetailDriver' = ANY(incoming_sources)
            AND NOT ('DetailOrderAnalysis' = ANY(incoming_sources));

        INSERT INTO dispatch_data (
            order_date, order_id, order_num, ticket_num, ticket_id,
            home_plant_code, loaded_plant_code,
            customer, customer_num, job_number,
            address, city, contact, phone, po_number,
            product_code, product_description,
            start_time, rate, scheduled_yardage, load_size,
            truck_count, truck_class, truck_num,
            driver_num, driver_name,
            ticket_time, loaded_time,
            sched_to_job_time, sched_to_plant_time,
            quantity, source_reports
        )
        VALUES (
            (item->>'order_date')::date,
            item->>'order_id',
            item->>'order_num',
            coalesce(item->>'ticket_num', ''),
            item->>'ticket_id',
            item->>'home_plant_code',
            item->>'loaded_plant_code',
            item->>'customer',
            item->>'customer_num',
            item->>'job_number',
            item->>'address',
            item->>'city',
            item->>'contact',
            item->>'phone',
            item->>'po_number',
            item->>'product_code',
            item->>'product_description',
            item->>'start_time',
            item->>'rate',
            (item->>'scheduled_yardage')::numeric,
            (item->>'load_size')::numeric,
            (item->>'truck_count')::numeric,
            item->>'truck_class',
            item->>'truck_num',
            item->>'driver_num',
            item->>'driver_name',
            item->>'ticket_time',
            item->>'loaded_time',
            item->>'sched_to_job_time',
            item->>'sched_to_plant_time',
            (item->>'quantity')::numeric,
            incoming_sources
        )
        ON CONFLICT (order_date, order_id, ticket_num) DO UPDATE SET
            -- Quantity rule: estimates never clobber confirmed values.
            -- The local variable `incoming_is_estimate_only` was computed
            -- from the incoming row above so the CASE knows whether the
            -- inbound quantity should be trusted.
            quantity = CASE
                WHEN incoming_is_estimate_only AND dispatch_data.quantity IS NOT NULL
                    THEN dispatch_data.quantity
                ELSE coalesce(EXCLUDED.quantity, dispatch_data.quantity)
            END,
            -- Source-report list grows monotonically — union, dedupe, sort.
            source_reports = ARRAY(
                SELECT DISTINCT s
                FROM unnest(coalesce(dispatch_data.source_reports, ARRAY[]::text[]) || EXCLUDED.source_reports) AS s
                ORDER BY s
            ),
            -- Header / context columns: take the incoming value when non-null,
            -- otherwise keep what's already there. Lets each pass fill in the
            -- columns it knows about without nulling fields earlier passes wrote.
            order_num            = coalesce(EXCLUDED.order_num,            dispatch_data.order_num),
            ticket_id            = coalesce(EXCLUDED.ticket_id,            dispatch_data.ticket_id),
            home_plant_code      = coalesce(EXCLUDED.home_plant_code,      dispatch_data.home_plant_code),
            loaded_plant_code    = coalesce(EXCLUDED.loaded_plant_code,    dispatch_data.loaded_plant_code),
            customer             = coalesce(EXCLUDED.customer,             dispatch_data.customer),
            customer_num         = coalesce(EXCLUDED.customer_num,         dispatch_data.customer_num),
            job_number           = coalesce(EXCLUDED.job_number,           dispatch_data.job_number),
            address              = coalesce(EXCLUDED.address,              dispatch_data.address),
            city                 = coalesce(EXCLUDED.city,                 dispatch_data.city),
            contact              = coalesce(EXCLUDED.contact,              dispatch_data.contact),
            phone                = coalesce(EXCLUDED.phone,                dispatch_data.phone),
            po_number            = coalesce(EXCLUDED.po_number,            dispatch_data.po_number),
            product_code         = coalesce(EXCLUDED.product_code,         dispatch_data.product_code),
            product_description  = coalesce(EXCLUDED.product_description,  dispatch_data.product_description),
            start_time           = coalesce(EXCLUDED.start_time,           dispatch_data.start_time),
            rate                 = coalesce(EXCLUDED.rate,                 dispatch_data.rate),
            scheduled_yardage    = coalesce(EXCLUDED.scheduled_yardage,    dispatch_data.scheduled_yardage),
            load_size            = coalesce(EXCLUDED.load_size,            dispatch_data.load_size),
            truck_count          = coalesce(EXCLUDED.truck_count,          dispatch_data.truck_count),
            truck_class          = coalesce(EXCLUDED.truck_class,          dispatch_data.truck_class),
            truck_num            = coalesce(EXCLUDED.truck_num,            dispatch_data.truck_num),
            driver_num           = coalesce(EXCLUDED.driver_num,           dispatch_data.driver_num),
            driver_name          = coalesce(EXCLUDED.driver_name,          dispatch_data.driver_name),
            ticket_time          = coalesce(EXCLUDED.ticket_time,          dispatch_data.ticket_time),
            loaded_time          = coalesce(EXCLUDED.loaded_time,          dispatch_data.loaded_time),
            sched_to_job_time    = coalesce(EXCLUDED.sched_to_job_time,    dispatch_data.sched_to_job_time),
            sched_to_plant_time  = coalesce(EXCLUDED.sched_to_plant_time,  dispatch_data.sched_to_plant_time),
            updated_at           = now();

        upserted_count := upserted_count + 1;
    END LOOP;

    RETURN upserted_count;
END;
$$;

REVOKE ALL ON FUNCTION dispatch_upsert_data(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dispatch_upsert_data(jsonb) TO service_role;
