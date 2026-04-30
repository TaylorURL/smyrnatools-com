-- Fix: dispatch_upsert_data was letting DetailOrderAnalysis overwrite a real
-- quantity with 0 when the parser dropped a row's yardage cell (page-break /
-- code-mate miss). Replace the CASE with a GREATEST-based merge so any
-- positive yardage wins regardless of which report supplied it.
CREATE OR REPLACE FUNCTION public.dispatch_upsert_data(rows jsonb)
    RETURNS integer
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
AS
$function$
DECLARE
    affected INT := 0;
BEGIN
    INSERT INTO public.dispatch_data (order_date, order_id, ticket_num, ticket_id,
                                      order_num, home_plant_code,
                                      customer, customer_num, job_number, address, city, contact, phone,
                                      po_number, product_code, product_description,
                                      start_time, rate, scheduled_yardage, load_size, truck_count,
                                      truck_class, sched_to_job_time, sched_to_plant_time,
                                      loaded_plant_code, truck_num, driver_num, driver_name,
                                      ticket_time, loaded_time, quantity, source_reports)
    SELECT (r ->> 'order_date')::DATE,
           r ->> 'order_id',
           COALESCE(r ->> 'ticket_num', ''),
           r ->> 'ticket_id',
           r ->> 'order_num',
           r ->> 'home_plant_code',
           r ->> 'customer',
           r ->> 'customer_num',
           r ->> 'job_number',
           r ->> 'address',
           r ->> 'city',
           r ->> 'contact',
           r ->> 'phone',
           r ->> 'po_number',
           r ->> 'product_code',
           r ->> 'product_description',
           r ->> 'start_time',
           r ->> 'rate',
           NULLIF(r ->> 'scheduled_yardage', '')::NUMERIC,
           NULLIF(r ->> 'load_size', '')::NUMERIC,
           NULLIF(r ->> 'truck_count', '')::NUMERIC,
           r ->> 'truck_class',
           r ->> 'sched_to_job_time',
           r ->> 'sched_to_plant_time',
           r ->> 'loaded_plant_code',
           r ->> 'truck_num',
           r ->> 'driver_num',
           r ->> 'driver_name',
           r ->> 'ticket_time',
           r ->> 'loaded_time',
           NULLIF(r ->> 'quantity', '')::NUMERIC,
           COALESCE(
                   ARRAY(SELECT jsonb_array_elements_text(COALESCE(r -> 'source_reports', '[]'::jsonb))),
                   ARRAY []::TEXT[]
           )
    FROM jsonb_array_elements(rows) r
    ON CONFLICT (order_date, order_id, ticket_num) DO UPDATE SET
        ticket_id           = COALESCE(EXCLUDED.ticket_id, dispatch_data.ticket_id),
        order_num           = COALESCE(EXCLUDED.order_num, dispatch_data.order_num),
        home_plant_code     = COALESCE(EXCLUDED.home_plant_code, dispatch_data.home_plant_code),
        customer            = COALESCE(EXCLUDED.customer, dispatch_data.customer),
        customer_num        = COALESCE(EXCLUDED.customer_num, dispatch_data.customer_num),
        job_number          = COALESCE(EXCLUDED.job_number, dispatch_data.job_number),
        address             = COALESCE(EXCLUDED.address, dispatch_data.address),
        city                = COALESCE(EXCLUDED.city, dispatch_data.city),
        contact             = COALESCE(EXCLUDED.contact, dispatch_data.contact),
        phone               = COALESCE(EXCLUDED.phone, dispatch_data.phone),
        po_number           = COALESCE(EXCLUDED.po_number, dispatch_data.po_number),
        product_code        = COALESCE(EXCLUDED.product_code, dispatch_data.product_code),
        product_description = COALESCE(EXCLUDED.product_description, dispatch_data.product_description),
        start_time          = COALESCE(EXCLUDED.start_time, dispatch_data.start_time),
        rate                = COALESCE(EXCLUDED.rate, dispatch_data.rate),
        scheduled_yardage   = COALESCE(EXCLUDED.scheduled_yardage, dispatch_data.scheduled_yardage),
        load_size           = COALESCE(EXCLUDED.load_size, dispatch_data.load_size),
        truck_count         = COALESCE(EXCLUDED.truck_count, dispatch_data.truck_count),
        truck_class         = COALESCE(EXCLUDED.truck_class, dispatch_data.truck_class),
        sched_to_job_time   = COALESCE(EXCLUDED.sched_to_job_time, dispatch_data.sched_to_job_time),
        sched_to_plant_time = COALESCE(EXCLUDED.sched_to_plant_time, dispatch_data.sched_to_plant_time),
        loaded_plant_code   = COALESCE(EXCLUDED.loaded_plant_code, dispatch_data.loaded_plant_code),
        truck_num           = COALESCE(EXCLUDED.truck_num, dispatch_data.truck_num),
        driver_num          = COALESCE(EXCLUDED.driver_num, dispatch_data.driver_num),
        driver_name         = COALESCE(EXCLUDED.driver_name, dispatch_data.driver_name),
        ticket_time         = COALESCE(EXCLUDED.ticket_time, dispatch_data.ticket_time),
        loaded_time         = COALESCE(EXCLUDED.loaded_time, dispatch_data.loaded_time),
        -- Quantity merge: any positive value beats 0/null. Prevents a parser
        -- miss (DOA reporting 0) from overwriting a real estimate, and lets
        -- DetailDriver's load_size fallback fill in when DOA lost the row.
        quantity            = NULLIF(
                GREATEST(COALESCE(dispatch_data.quantity, 0), COALESCE(EXCLUDED.quantity, 0)),
                0
                              ),
        source_reports      = ARRAY(SELECT DISTINCT u
                                    FROM unnest(dispatch_data.source_reports || EXCLUDED.source_reports) u
                                    WHERE u IS NOT NULL
                                      AND u <> ''),
        updated_at          = NOW();
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
END;
$function$;

-- One-shot backfill for tickets currently stuck at 0/null where we have a
-- load_size estimate available. Limited to recent dates to keep the update tight.
UPDATE public.dispatch_data
SET quantity   = load_size,
    updated_at = NOW()
WHERE order_date >= CURRENT_DATE - INTERVAL '14 days'
  AND ticket_num <> ''
  AND (quantity IS NULL OR quantity = 0)
  AND load_size IS NOT NULL
  AND load_size > 0;
